const CONFIG = {
  tokenProperty: 'WEBHOOK_TOKEN',
  spreadsheetIdProperty: 'SPREADSHEET_ID',
  sheets: {
    entree: 'Entrées',
    sortie: 'Sorties',
  },
  columns: [
    'id',
    'date',
    'qty152Vert',
    'qty152Bleu',
    'qty152Noir',
    'qty152KS',
    'qty152KF',
    'qty152Gris',
    'qty124Vert',
    'qty124Bleu',
    'client',
    'wilaya',
    'montant',
    'notes',
  ],
  quantities: [
    'qty152Vert',
    'qty152Bleu',
    'qty152Noir',
    'qty152KS',
    'qty152KF',
    'qty152Gris',
    'qty124Vert',
    'qty124Bleu',
  ],
};

function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  return handleRequest(parameters);
}

function doPost(event) {
  try {
    const contents = event && event.postData && event.postData.contents;
    if (!contents || contents.length > 10000) {
      throw new Error('Invalid or oversized request.');
    }
    return handleRequest(JSON.parse(contents));
  } catch (error) {
    return jsonResponse({ status: 'error', error: error.message || 'Invalid request.' });
  }
}

function handleRequest(request) {
  try {
    authorize(request.token);
    const spreadsheetId = PropertiesService.getScriptProperties()
      .getProperty(CONFIG.spreadsheetIdProperty);
    const spreadsheet = spreadsheetId
      ? SpreadsheetApp.openById(spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('Set SPREADSHEET_ID in the Apps Script properties.');
    const action = String(request.action || '');
    const target = { url: spreadsheet.getUrl() };

    if (action === 'info') {
      return jsonResponse({ status: 'ok', target: target });
    }
    if (action === 'read') {
      return jsonResponse(Object.assign(
        { status: 'ok', target: target },
        readInventory(spreadsheet)
      ));
    }
    if (action === 'publicAdd' || action === 'add' || action === 'update') {
      const kind = validKind(request.sheet);
      const item = normalizeItem(kind, request.item);
      const sheet = getInventorySheet(spreadsheet, kind);
      if (action === 'update') {
        updateItem(sheet, item);
      } else {
        appendItem(sheet, item);
      }
      if (action === 'publicAdd') {
        return jsonResponse({ status: 'success', saved: true, target: target });
      }
      return jsonResponse(Object.assign(
        { status: 'success', target: target },
        readInventory(spreadsheet)
      ));
    }
    if (action === 'delete') {
      const kind = validKind(request.sheet);
      deleteItem(getInventorySheet(spreadsheet, kind), request.id);
      return jsonResponse(Object.assign(
        { status: 'success', target: target },
        readInventory(spreadsheet)
      ));
    }
    throw new Error('Unsupported action.');
  } catch (error) {
    return jsonResponse({ status: 'error', error: error.message || 'Request failed.' });
  }
}

function authorize(token) {
  const expected = PropertiesService.getScriptProperties().getProperty(CONFIG.tokenProperty);
  if (!expected || !token || String(token) !== expected) {
    throw new Error('Unauthorized.');
  }
}

function validKind(kind) {
  if (kind !== 'entree' && kind !== 'sortie') throw new Error('Invalid inventory type.');
  return kind;
}

function getInventorySheet(spreadsheet, kind) {
  const name = CONFIG.sheets[kind];
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CONFIG.columns.length).setValues([CONFIG.columns]);
  } else {
    const headers = sheet.getRange(1, 1, 1, CONFIG.columns.length).getDisplayValues()[0];
    if (CONFIG.columns.some(function (column, index) { return headers[index] !== column; })) {
      throw new Error('Unexpected columns in sheet "' + name + '". Keep the header row created by this app.');
    }
  }
  return sheet;
}

function normalizeItem(kind, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid inventory entry.');
  }
  const id = String(value.id || '').trim();
  const date = String(value.date || '').trim();
  if (!id || id.length > 120) throw new Error('A valid entry ID is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T00:00:00Z'))) {
    throw new Error('A valid entry date is required.');
  }

  const item = { id: id, date: date };
  CONFIG.quantities.forEach(function (key) {
    const number = value[key] === undefined || value[key] === null || value[key] === ''
      ? 0
      : Number(value[key]);
    if (!isFinite(number) || number < 0 || number > 1000000) {
      throw new Error('Invalid quantity for ' + key + '.');
    }
    item[key] = number;
  });

  item.client = cleanText(value.client, 120);
  item.wilaya = cleanText(value.wilaya, 80);
  item.notes = cleanText(value.notes, 500);
  item.montant = value.montant === undefined || value.montant === null || value.montant === ''
    ? 0
    : Number(value.montant);
  if (!isFinite(item.montant) || item.montant < 0 || item.montant > 1000000000) {
    throw new Error('Invalid amount.');
  }
  if (kind === 'sortie' && !item.client) throw new Error('A customer name is required for a sale.');
  return item;
}

function cleanText(value, maxLength) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text.length > maxLength) throw new Error('A text field exceeds its maximum length.');
  return text;
}

function appendItem(sheet, item) {
  if (findItemRow(sheet, item.id) !== -1) throw new Error('An entry with this ID already exists.');
  sheet.appendRow(rowForItem(item));
}

function updateItem(sheet, item) {
  const row = findItemRow(sheet, item.id);
  if (row === -1) throw new Error('The inventory entry was not found.');
  sheet.getRange(row, 1, 1, CONFIG.columns.length).setValues([rowForItem(item)]);
}

function deleteItem(sheet, id) {
  const row = findItemRow(sheet, id);
  if (row === -1) throw new Error('The inventory entry was not found.');
  sheet.deleteRow(row);
}

function findItemRow(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < ids.length; index++) {
    if (ids[index][0] === String(id)) return index + 2;
  }
  return -1;
}

function rowForItem(item) {
  return CONFIG.columns.map(function (column) {
    const value = item[column] === undefined ? '' : item[column];
    if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
    return value;
  });
}

function readInventory(spreadsheet) {
  return {
    entrees: readSheet(getInventorySheet(spreadsheet, 'entree')),
    sorties: readSheet(getInventorySheet(spreadsheet, 'sortie')),
  };
}

function readSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, CONFIG.columns.length).getValues();
  return rows.filter(function (row) { return row[0] !== ''; }).map(function (row) {
    const item = {};
    CONFIG.columns.forEach(function (column, index) {
      item[column] = row[index];
    });
    item.id = String(item.id);
    item.date = item.date instanceof Date
      ? Utilities.formatDate(item.date, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(item.date);
    CONFIG.quantities.forEach(function (key) { item[key] = Number(item[key]) || 0; });
    item.montant = Number(item.montant) || 0;
    return item;
  });
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
