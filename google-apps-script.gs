/**
 * TiscobaP Stock Manager — Google Apps Script backend
 * Supports both the current schema and the older French worksheet layout.
 * Existing rows are never cleared or migrated automatically.
 */
var CONFIG = {
  tokenProperty: 'WEBHOOK_TOKEN',
  spreadsheetIdProperty: 'SPREADSHEET_ID',
  canonicalSheets: { entree: 'Entrées', sortie: 'Sorties' },
  legacySheetNames: {
    entree: ['Feuille 1 Entrée', 'Feuille 1 Entree', 'Entrée', 'Entree'],
    sortie: ['Feuille 2 Sortie', 'Sortie']
  },
  columns: [
    'id', 'date', 'qty152Vert', 'qty152Bleu', 'qty152Noir', 'qty152KS',
    'qty152KF', 'qty152Gris', 'qty124Vert', 'qty124Bleu', 'client',
    'wilaya', 'montant', 'notes'
  ],
  quantities: [
    'qty152Vert', 'qty152Bleu', 'qty152Noir', 'qty152KS',
    'qty152KF', 'qty152Gris', 'qty124Vert', 'qty124Bleu'
  ],
  labels: {
    qty152Vert: '152 Vert',
    qty152Bleu: '152 Bleu',
    qty152Noir: '152 Noir',
    qty152KS: '152 K.S',
    qty152KF: '152 K.F',
    qty152Gris: '152 Gris',
    qty124Vert: '124 Vert',
    qty124Bleu: '124 Bleu'
  }
};

function doGet(event) {
  return handleRequest(event && event.parameter ? event.parameter : {});
}

function doPost(event) {
  try {
    var contents = event && event.postData && event.postData.contents;
    if (!contents || contents.length > 100000) {
      throw new Error('Invalid or oversized request.');
    }
    return handleRequest(JSON.parse(contents));
  } catch (error) {
    return jsonResponse({ status: 'error', error: error && error.message ? error.message : 'Invalid request.' });
  }
}

function handleRequest(request) {
  try {
    authorize(request && request.token);
    var spreadsheet = getSpreadsheet();
    var action = String(request.action || '');
    var target = { url: spreadsheet.getUrl(), name: spreadsheet.getName() };

    if (action === 'info') return jsonResponse({ status: 'ok', target: target });
    if (action === 'read') {
      var data = readInventory(spreadsheet);
      return jsonResponse({ status: 'ok', entrees: data.entrees, sorties: data.sorties, target: target });
    }

    if (['publicAdd', 'add', 'update', 'delete'].indexOf(action) === -1) {
      throw new Error('Unsupported action.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (action === 'delete') {
        var deleteKind = validKind(request.sheet);
        var deleteContext = getInventorySheet(spreadsheet, deleteKind);
        var deleteRow = findItemRow(deleteContext, request.id);
        if (deleteRow === -1) throw new Error('The inventory entry was not found. It may have been deleted on another device.');
        var deleteBefore = deleteContext.sheet.getRange(deleteRow, 1, 1, deleteContext.sheet.getLastColumn()).getValues()[0];
        deleteItem(deleteContext, request.id);
        logMutation(spreadsheet, 'delete', deleteContext.sheet.getName(), deleteBefore, null);
      } else {
        var kind = validKind(request.sheet);
        var item = normalizeItem(kind, request.item);
        var context = getInventorySheet(spreadsheet, kind);
        if (action === 'update') {
          var updateRow = findItemRow(context, item.id);
          if (updateRow === -1) throw new Error('The inventory entry was not found. It may have been changed on another device.');
          var updateBefore = context.sheet.getRange(updateRow, 1, 1, context.sheet.getLastColumn()).getValues()[0];
          updateItem(context, item);
          logMutation(spreadsheet, 'update', context.sheet.getName(), updateBefore, item);
        } else {
          appendItem(context, item);
          logMutation(spreadsheet, 'add', context.sheet.getName(), null, item);
        }
      }
      ensureSynthesis(spreadsheet);
    } finally {
      lock.releaseLock();
    }

    if (action === 'publicAdd') {
      return jsonResponse({ status: 'success', saved: true, target: target });
    }
    var fresh = readInventory(spreadsheet);
    return jsonResponse({ status: 'success', entrees: fresh.entrees, sorties: fresh.sorties, target: target });
  } catch (error) {
    return jsonResponse({ status: 'error', error: error && error.message ? error.message : 'Request failed.' });
  }
}

function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty(CONFIG.spreadsheetIdProperty);
  var spreadsheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Set SPREADSHEET_ID in Script Properties, or bind this script to a Google Sheet.');
  return spreadsheet;
}

function authorize(token) {
  var expected = PropertiesService.getScriptProperties().getProperty(CONFIG.tokenProperty);
  if (!expected || !token || String(token) !== expected) throw new Error('Unauthorized. Check WEBHOOK_TOKEN.');
}

function validKind(kind) {
  if (kind !== 'entree' && kind !== 'sortie') throw new Error('Invalid inventory type.');
  return kind;
}

function normalizeHeader(value) {
  return String(value == null ? '' : value).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function fieldAliases(field) {
  var aliases = {
    id: ['id'],
    date: ['date'],
    client: ['client', 'nom client', 'nom du client', 'customer'],
    wilaya: ['wilaya', 'province'],
    montant: ['montant', 'amount', 'total'],
    notes: ['notes', 'note', 'remarque', 'observations']
  };
  if (CONFIG.labels[field]) return [field, CONFIG.labels[field]];
  return aliases[field] || [field];
}

function makeHeaderMap(sheet, kind) {
  var width = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  var normalizedAliases = {};
  CONFIG.columns.forEach(function (field) {
    normalizedAliases[field] = fieldAliases(field).map(normalizeHeader);
  });
  var map = {};
  headers.forEach(function (header, index) {
    var key = normalizeHeader(header);
    if (!key) return;
    CONFIG.columns.forEach(function (field) {
      if (map[field] == null && normalizedAliases[field].indexOf(key) !== -1) map[field] = index + 1;
    });
  });
  var required = ['id', 'date'].concat(CONFIG.quantities);
  if (kind === 'sortie') required = required.concat(['client', 'montant']);
  var missing = required.filter(function (field) { return map[field] == null; });
  if (missing.length) {
    throw new Error('Unexpected columns in sheet "' + sheet.getName() + '". Missing: ' + missing.join(', ') + '. No data was changed.');
  }
  return map;
}

function findExistingTab(spreadsheet, names) {
  var allSheets = spreadsheet.getSheets();
  var accepted = names.map(normalizeHeader);
  for (var i = 0; i < allSheets.length; i++) {
    if (accepted.indexOf(normalizeHeader(allSheets[i].getName())) !== -1) return allSheets[i];
  }
  return null;
}

function ensureIdColumnIfMissing(sheet, kind) {
  var width = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  var hasId = headers.some(function (header) { return normalizeHeader(header) === 'id'; });
  if (hasId) return;

  // Validate the old header row before making the only structural change (adding IDs).
  var present = {};
  headers.forEach(function (header) {
    var key = normalizeHeader(header);
    if (!key) return;
    CONFIG.columns.forEach(function (field) {
      if (fieldAliases(field).map(normalizeHeader).indexOf(key) !== -1) present[field] = true;
    });
  });
  var required = ['date'].concat(CONFIG.quantities);
  if (kind === 'sortie') required = required.concat(['client', 'montant']);
  var missing = required.filter(function (field) { return !present[field]; });
  if (missing.length) {
    throw new Error('Unexpected columns in sheet "' + sheet.getName() + '". Missing: ' + missing.join(', ') + '. No data was changed.');
  }

  var idColumn = width + 1;
  sheet.getRange(1, idColumn).setValue('ID').setFontWeight('bold');
  sheet.getRange(2, idColumn, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var oldRows = sheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();
    var ids = oldRows.map(function (row) {
      var hasContent = row.some(function (cell) { return String(cell || '').trim() !== ''; });
      return [hasContent ? kind.charAt(0) + '-' + Utilities.getUuid().slice(0, 12) : ''];
    });
    sheet.getRange(2, idColumn, ids.length, 1).setValues(ids);
  }
  sheet.setFrozenRows(1);
}

function getInventorySheet(spreadsheet, kind) {
  var canonical = spreadsheet.getSheetByName(CONFIG.canonicalSheets[kind]);
  var legacy = findExistingTab(spreadsheet, CONFIG.legacySheetNames[kind]);
  var canonicalHasRows = canonical && canonical.getLastRow() > 1;
  var legacyHasRows = legacy && legacy.getLastRow() > 1;

  if (canonical && legacy && canonical !== legacy && canonicalHasRows && legacyHasRows) {
    throw new Error('Both "' + canonical.getName() + '" and "' + legacy.getName() + '" contain data. Rename or consolidate them manually; the script will not guess which is authoritative.');
  }
  var sheet = canonicalHasRows ? canonical : legacyHasRows ? legacy : canonical || legacy;
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.canonicalSheets[kind]);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CONFIG.columns.length).setValues([CONFIG.columns]);
    sheet.getRange(1, 1, 1, CONFIG.columns.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  ensureIdColumnIfMissing(sheet, kind);
  makeHeaderMap(sheet, kind);
  return { sheet: sheet, map: makeHeaderMap(sheet, kind), kind: kind };
}

function cleanText(value, maxLength, required) {
  var text = value === undefined || value === null ? '' : String(value).trim();
  if (required && !text) throw new Error('A customer name is required for a sale.');
  if (text.length > maxLength) throw new Error('A text field exceeds its maximum length (' + maxLength + ').');
  return text;
}

function normalizeItem(kind, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid inventory entry.');
  var id = String(value.id || '').trim();
  var date = String(value.date || '').trim();
  if (!id || id.length > 120) throw new Error('A valid entry ID is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('A valid entry date is required.');
  var parsedDate = new Date(date + 'T00:00:00Z');
  if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error('A valid entry date is required.');

  var item = { id: id, date: date };
  var totalQuantity = 0;
  CONFIG.quantities.forEach(function (key) {
    var raw = value[key];
    var amount = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
    if (!isFinite(amount) || amount < 0 || amount > 1000000) throw new Error('Invalid quantity for ' + key + '.');
    item[key] = amount;
    totalQuantity += amount;
  });
  if (totalQuantity <= 0) throw new Error('Enter a positive quantity for at least one product.');
  item.client = cleanText(value.client, 120, kind === 'sortie');
  item.wilaya = cleanText(value.wilaya, 80, false);
  item.notes = cleanText(value.notes, 500, false);
  item.montant = value.montant === undefined || value.montant === null || value.montant === '' ? 0 : Number(value.montant);
  if (!isFinite(item.montant) || item.montant < 0 || item.montant > 1000000000) throw new Error('Invalid amount.');
  return item;
}

function safeCellValue(value) {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function rowForItem(context, item, existingRow) {
  var sheet = context.sheet;
  var map = context.map;
  var width = Math.max(sheet.getLastColumn(), CONFIG.columns.length);
  var row = existingRow ? existingRow.slice() : new Array(width).fill('');
  while (row.length < width) row.push('');
  Object.keys(map).forEach(function (field) {
    var value = item[field];
    if (field === 'id' || field === 'date' || CONFIG.quantities.indexOf(field) !== -1 || field === 'montant') {
      if (value === undefined || value === null || value === '') value = field.indexOf('qty') === 0 || field === 'montant' ? 0 : '';
    } else if (value === undefined || value === null) {
      value = '';
    }
    row[map[field] - 1] = safeCellValue(value);
  });
  return row;
}

function findItemRow(context, id) {
  var sheet = context.sheet;
  var idColumn = context.map.id;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, idColumn, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === String(id)) return i + 2;
  }
  return -1;
}

function appendItem(context, item) {
  if (findItemRow(context, item.id) !== -1) throw new Error('An entry with this ID already exists.');
  context.sheet.appendRow(rowForItem(context, item, null));
}

function updateItem(context, item) {
  var rowNumber = findItemRow(context, item.id);
  if (rowNumber === -1) throw new Error('The inventory entry was not found. It may have been changed on another device.');
  var sheet = context.sheet;
  var existing = sheet.getRange(rowNumber, 1, 1, Math.max(sheet.getLastColumn(), CONFIG.columns.length)).getValues()[0];
  sheet.getRange(rowNumber, 1, 1, existing.length).setValues([rowForItem(context, item, existing)]);
}

function deleteItem(context, idValue) {
  var id = String(idValue || '').trim();
  if (!id) throw new Error('Entry ID is required.');
  var rowNumber = findItemRow(context, id);
  if (rowNumber === -1) throw new Error('The inventory entry was not found. It may have been deleted on another device.');
  context.sheet.deleteRow(rowNumber);
}

function dateForClient(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value == null ? '' : value);
}

function readSheet(context) {
  var sheet = context.sheet;
  var map = context.map;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var width = Math.max(sheet.getLastColumn(), CONFIG.columns.length);
  var rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  return rows.filter(function (row) { return row[map.id - 1] !== '' && row[map.id - 1] != null; }).map(function (row) {
    var item = { id: String(row[map.id - 1]), date: dateForClient(row[map.date - 1]) };
    CONFIG.quantities.forEach(function (key) { item[key] = map[key] ? Number(row[map[key] - 1]) || 0 : 0; });
    item.client = map.client ? String(row[map.client - 1] || '') : '';
    item.wilaya = map.wilaya ? String(row[map.wilaya - 1] || '') : '';
    item.montant = map.montant ? Number(row[map.montant - 1]) || 0 : 0;
    item.notes = map.notes ? String(row[map.notes - 1] || '') : '';
    return item;
  });
}

function readInventory(spreadsheet) {
  var entreeContext = getInventorySheet(spreadsheet, 'entree');
  var sortieContext = getInventorySheet(spreadsheet, 'sortie');
  return {
    entrees: readSheet(entreeContext),
    sorties: readSheet(sortieContext)
  };
}

function logMutation(spreadsheet, action, sheetName, before, after) {
  var journal = spreadsheet.getSheetByName('Journal');
  if (!journal) journal = spreadsheet.insertSheet('Journal');
  if (journal.getLastRow() === 0) {
    journal.getRange(1, 1, 1, 5).setValues([['Horodatage', 'Action', 'Feuille', 'Avant', 'Après']]);
    journal.getRange(1, 1, 1, 5).setFontWeight('bold');
    journal.setFrozenRows(1);
  }
  journal.appendRow([
    new Date(),
    action,
    sheetName,
    before == null ? '' : JSON.stringify(before),
    after == null ? '' : JSON.stringify(after)
  ]);
}

function columnLetter(columnNumber) {
  var number = columnNumber;
  var letters = '';
  while (number > 0) {
    var remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }
  return letters;
}

function quoteSheetName(name) {
  return "'" + String(name).replace(/'/g, "''") + "'";
}

function ensureSynthesis(spreadsheet) {
  var summary = spreadsheet.getSheetByName('Feuille 3 Synthèse') ||
    spreadsheet.getSheetByName('Feuille 3 Synthese') ||
    spreadsheet.getSheetByName('Synthèse') ||
    spreadsheet.getSheetByName('Synthese');
  if (summary && summary.getLastRow() > 0) return; // Never overwrite an existing summary.

  var entree = getInventorySheet(spreadsheet, 'entree');
  var sortie = getInventorySheet(spreadsheet, 'sortie');
  if (!summary) {
    var legacyNaming = normalizeHeader(entree.sheet.getName()).indexOf('feuille') === 0;
    summary = spreadsheet.insertSheet(legacyNaming ? 'Feuille 3 Synthèse' : 'Synthèse');
  }

  var rows = [['Produit', 'Total Entrées', 'Total Sorties', 'Stock Restant', 'Statut du Stock']];
  CONFIG.quantities.forEach(function (key, index) {
    var label = CONFIG.labels[key];
    var rowNumber = index + 2;
    var inCol = columnLetter(entree.map[key]);
    var outCol = columnLetter(sortie.map[key]);
    rows.push([
      label,
      '=SUM(' + quoteSheetName(entree.sheet.getName()) + '!' + inCol + '2:' + inCol + ')',
      '=SUM(' + quoteSheetName(sortie.sheet.getName()) + '!' + outCol + '2:' + outCol + ')',
      '=B' + rowNumber + '-C' + rowNumber,
      '=IF(D' + rowNumber + '<=10, "⚠️ Stock Faible", "✅ Disponible")'
    ]);
  });
  rows.push(['', '', '', '', '']);
  rows.push([
    'Chiffre d’affaires Total',
    '=SUM(' + quoteSheetName(sortie.sheet.getName()) + '!' + columnLetter(sortie.map.montant) + '2:' + columnLetter(sortie.map.montant) + ')',
    'DZD', '', ''
  ]);
  summary.getRange(1, 1, rows.length, 5).setValues(rows);
  summary.getRange(1, 1, 1, 5).setFontWeight('bold');
  summary.setFrozenRows(1);
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
