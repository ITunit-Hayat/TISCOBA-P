import { EntreeItem, SortieItem } from '../types/stock';

const QTY_KEYS: (keyof EntreeItem)[] = [
  'qty152Vert', 'qty152Bleu', 'qty152Noir', 'qty152KS',
  'qty152KF', 'qty152Gris', 'qty124Vert', 'qty124Bleu',
];
const IN_HEADER = ['Date', '152 Vert', '152 Bleu', '152 Noir', '152 K.S', '152 K.F', '152 Gris', '124 Vert', '124 Bleu', 'Notes', 'ID'];
const OUT_HEADER = ['Date', 'Client', '152 Vert', '152 Bleu', '152 Noir', '152 K.S', '152 K.F', '152 Gris', '124 Vert', '124 Bleu', 'Montant', 'Notes', 'Wilaya', 'ID'];

export interface DriveFileInfo {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
  sharedWithMe?: boolean;
  ownerEmail?: string;
}

export interface SheetMetadata {
  title: string;
  sheets: { id: number; title: string; columnCount?: number }[];
}

export interface SharedSheetConfig {
  id: string;
  title: string;
  url: string;
  sharedBy?: string;
  token?: string;
  webhookUrl?: string;
  updatedAt?: string;
}

type AppsScriptRequest = {
  action: 'sync' | 'add' | 'update' | 'delete' | 'seed';
  sheetId: string;
  sheet?: 'entree' | 'sortie';
  item?: EntreeItem | SortieItem;
  id?: string;
  entrees?: EntreeItem[];
  sorties?: SortieItem[];
};

export async function sendAppsScriptRequest(
  accessToken: string,
  request: AppsScriptRequest
): Promise<{ entrees: EntreeItem[]; sorties: SortieItem[] }> {
  const response = await fetch('/api/apps-script', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
  if (!response.ok) {
    throw new Error(result.error || 'Apps Script synchronization failed.');
  }
  if (result.status !== 'success') {
    throw new Error(result.error || result.message || 'Apps Script did not confirm the operation.');
  }
  return { entrees: result.entrees || [], sorties: result.sorties || [] };
}

export async function syncInventoryViaAppsScript(
  accessToken: string,
  spreadsheetId: string,
  entrees: EntreeItem[],
  sorties: SortieItem[]
): Promise<{ entrees: EntreeItem[]; sorties: SortieItem[] }> {
  return sendAppsScriptRequest(accessToken, {
    action: 'sync',
    sheetId: extractSpreadsheetId(spreadsheetId),
    entrees,
    sorties,
  });
}

export async function readInventoryViaAppsScript(
  accessToken: string,
  spreadsheetId: string
): Promise<{ entrees: EntreeItem[]; sorties: SortieItem[]; isLegacy4Columns: false }> {
  const response = await fetch('/api/apps-script', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'read',
      sheetId: extractSpreadsheetId(spreadsheetId),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
  if (!response.ok || result.status !== 'ok') {
    throw new Error(result.error || 'Apps Script could not read Google Sheets.');
  }
  return {
    entrees: result.entrees || [],
    sorties: result.sorties || [],
    isLegacy4Columns: false,
  };
}

/**
 * Extracts a Google Spreadsheet ID from a URL or raw ID string.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // If already an ID:
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/**
 * Fetches Google Spreadsheet metadata (title and sheet tabs)
 */
export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetMetadata> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title,sheets.properties(sheetId,title,gridProperties)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('GOOGLE_AUTH_EXPIRED');
    }
    if (res.status === 403 || res.status === 404) {
      throw new Error('GOOGLE_SHEET_NO_ACCESS');
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Impossible d’accéder au fichier Google Sheets');
  }

  const data = await res.json();
  return {
    title: data.properties?.title || 'Fichier Google Sheets',
    sheets: (data.sheets || []).map((s: any) => ({
      id: s.properties?.sheetId,
      title: s.properties?.title,
      columnCount: s.properties?.gridProperties?.columnCount || 26,
    })),
  };
}

/**
 * Creates a complete Google Spreadsheet directly in the user's Google Drive
 * with 3 interconnected sheets:
 * 1. Feuille 1 Entrée
 * 2. Feuille 2 Sortie
 * 3. Feuille 3 Synthèse (with automatic formulas)
 */
export async function createInventorySpreadsheet(
  accessToken: string,
  entrees: EntreeItem[],
  sorties: SortieItem[],
  customTitle?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const title = customTitle || `Gestion de Stock (152 & 124) - ${new Date().toISOString().split('T')[0]}`;

  // 1. Create Spreadsheet with 3 sheets
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: 'Feuille 1 Entrée',
            gridProperties: { rowCount: 500, columnCount: 20 },
          },
        },
        {
          properties: {
            title: 'Feuille 2 Sortie',
            gridProperties: { rowCount: 500, columnCount: 20 },
          },
        },
        {
          properties: {
            title: 'Feuille 3 Synthèse',
            gridProperties: { rowCount: 100, columnCount: 20 },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json();
    throw new Error(errorData.error?.message || 'Erreur lors de la création du fichier Google Sheets');
  }

  const createData = await createRes.json();
  const spreadsheetId = createData.spreadsheetId;
  const spreadsheetUrl = createData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Populate data
  await writeAllDataToGoogleSheet(accessToken, spreadsheetId, entrees, sorties);

  return { spreadsheetId, spreadsheetUrl, title };
}

/**
 * Ensures that the spreadsheet has all 3 required sheets (Feuille 1 Entrée, Feuille 2 Sortie, Feuille 3 Synthèse).
 * If a sheet is missing or the spreadsheet only has a generic "Sheet1", it adds/renames tabs safely via batchUpdate.
 */
export async function ensureSpreadsheetTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<{ entreeTitle: string; sortieTitle: string; syntheseTitle: string }> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingSheets = meta.sheets || [];
  const existingTitles = existingSheets.map((s) => s.title);

  let entreeTitle = existingTitles.find((t) => /entr[eé]|وارد|in/i.test(t));
  let sortieTitle = existingTitles.find((t) => /sort[ií]e|صادر|مبيع|out/i.test(t));
  let syntheseTitle = existingTitles.find((t) => /synth[eèé]se|ملخص|stock/i.test(t));

  const requests: any[] = [];

  // Ensure grid size has at least 20 columns so all 12 products/notes columns fit cleanly
  existingSheets.forEach((s) => {
    if (s.columnCount && s.columnCount < 15) {
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: s.id,
            gridProperties: {
              columnCount: 20,
            },
          },
          fields: 'gridProperties.columnCount',
        },
      });
    }
  });

  // Case 1: Fresh or single-sheet file with generic name
  if (existingSheets.length === 1 && !entreeTitle && !sortieTitle && !syntheseTitle) {
    const firstSheetId = existingSheets[0].id;
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: firstSheetId,
          title: 'Feuille 1 Entrée',
        },
        fields: 'title',
      },
    });
    requests.push({
      addSheet: { properties: { title: 'Feuille 2 Sortie' } },
    });
    requests.push({
      addSheet: { properties: { title: 'Feuille 3 Synthèse' } },
    });
    entreeTitle = 'Feuille 1 Entrée';
    sortieTitle = 'Feuille 2 Sortie';
    syntheseTitle = 'Feuille 3 Synthèse';
  } else {
    // Case 2: Ensure any missing sheet tab is created
    if (!entreeTitle) {
      if (existingTitles.length > 0 && !existingTitles.includes('Feuille 1 Entrée')) {
        requests.push({
          addSheet: { properties: { title: 'Feuille 1 Entrée' } },
        });
        entreeTitle = 'Feuille 1 Entrée';
      } else {
        entreeTitle = existingTitles[0] || 'Feuille 1 Entrée';
      }
    }

    if (!sortieTitle) {
      if (!existingTitles.includes('Feuille 2 Sortie')) {
        requests.push({
          addSheet: { properties: { title: 'Feuille 2 Sortie' } },
        });
      }
      sortieTitle = 'Feuille 2 Sortie';
    }

    if (!syntheseTitle) {
      if (!existingTitles.includes('Feuille 3 Synthèse')) {
        requests.push({
          addSheet: { properties: { title: 'Feuille 3 Synthèse' } },
        });
      }
      syntheseTitle = 'Feuille 3 Synthèse';
    }
  }

  if (requests.length > 0) {
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests }),
        }
      );
    } catch (e) {
      console.warn('Failed to ensure spreadsheet tabs via batchUpdate:', e);
    }
  }

  return {
    entreeTitle: entreeTitle || 'Feuille 1 Entrée',
    sortieTitle: sortieTitle || 'Feuille 2 Sortie',
    syntheseTitle: syntheseTitle || 'Feuille 3 Synthèse',
  };
}

async function getRowsById(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  idColumn: string
): Promise<{ ids: string[]; header: string[] }> {
  const headerRange = encodeURIComponent(`'${sheetTitle}'!A1:${idColumn}1`);
  const idRange = encodeURIComponent(`'${sheetTitle}'!${idColumn}2:${idColumn}`);
  const [headerRes, idsRes] = await Promise.all([
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${idRange}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  if (headerRes.status === 401 || idsRes.status === 401) {
    throw new Error('GOOGLE_AUTH_EXPIRED');
  }
  if (!headerRes.ok || !idsRes.ok) {
    const response = !headerRes.ok ? headerRes : idsRes;
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'تعذر قراءة صفوف Google Sheets');
  }

  const [headerData, idsData] = await Promise.all([headerRes.json(), idsRes.json()]);
  return {
    header: (headerData.values?.[0] || []).map((value: unknown) => String(value).trim()),
    ids: (idsData.values || []).map((row: unknown[]) => String(row[0] || '').trim()),
  };
}

async function ensureExpectedHeader(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  endColumn: string,
  expectedHeader: string[],
  currentHeader: string[]
): Promise<void> {
  if (currentHeader.length === 0) {
    const range = encodeURIComponent(`'${sheetTitle}'!A1:${endColumn}1`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [expectedHeader] }),
      }
    );
    if (response.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'تعذر إنشاء عناوين أعمدة Google Sheets');
    }
    return;
  }

  if (currentHeader.join('|') !== expectedHeader.join('|')) {
    throw new Error(`بنية ورقة "${sheetTitle}" غير متوافقة؛ أوقفنا الكتابة لحماية بياناتك.`);
  }
}

async function writeRowsById(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  idColumn: string,
  endColumn: string,
  expectedHeader: string[],
  rows: unknown[][],
  prefix: 'e' | 's'
): Promise<void> {
  const { ids, header } = await getRowsById(accessToken, spreadsheetId, sheetTitle, idColumn);
  await ensureExpectedHeader(accessToken, spreadsheetId, sheetTitle, endColumn, expectedHeader, header);

  const updates: { range: string; values: unknown[][] }[] = [];
  const additions: unknown[][] = [];
  const rowsById = new Map<string, number>();
  ids.forEach((id, index) => {
    if (id && !rowsById.has(id)) rowsById.set(id, index + 2);
  });

  rows.forEach((row) => {
    const id = String(row[row.length - 1] || '').trim();
    if (!id) throw new Error('كل سجل يحتاج إلى معرّف ID قبل حفظه في Google Sheets.');

    const rowNumber = rowsById.get(id);

    if (rowNumber) {
      updates.push({
        range: `'${sheetTitle}'!A${rowNumber}:${endColumn}${rowNumber}`,
        values: [row],
      });
      rowsById.set(id, rowNumber);
    } else {
      if (new RegExp(`^${prefix}-\\d+-`).test(id)) {
        throw new Error('GOOGLE_SHEET_ROW_NOT_FOUND');
      }
      additions.push(row);
    }
  });

  if (updates.length > 0) {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates }),
      }
    );
    if (response.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `تعذر تحديث سجلات "${sheetTitle}"`);
    }
  }

  if (additions.length > 0) {
    const range = encodeURIComponent(`'${sheetTitle}'!A:${endColumn}`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: additions }),
      }
    );
    if (response.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `تعذر إضافة سجلات إلى "${sheetTitle}"`);
    }
  }
}

async function findRecordRow(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  idColumn: string,
  expectedHeader: string[],
  id: string
): Promise<number> {
  if (!id.trim()) throw new Error('معرّف السجل ID مطلوب.');
  const { ids, header } = await getRowsById(accessToken, spreadsheetId, sheetTitle, idColumn);
  if (header.join('|') !== expectedHeader.join('|')) {
    throw new Error(`بنية ورقة "${sheetTitle}" غير متوافقة؛ أوقفنا العملية لحماية بياناتك.`);
  }

  const exactIndex = ids.findIndex((value) => value === id);
  if (exactIndex >= 0) return exactIndex + 2;

  throw new Error('GOOGLE_SHEET_ROW_NOT_FOUND');
}

async function deleteRecordRow(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  idColumn: string,
  expectedHeader: string[],
  id: string
): Promise<void> {
  const rowNumber = await findRecordRow(accessToken, spreadsheetId, sheetTitle, idColumn, expectedHeader, id);
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const sheet = meta.sheets.find((item) => item.title === sheetTitle);
  if (!sheet) throw new Error(`ورقة "${sheetTitle}" غير موجودة في Google Sheets.`);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheet.id,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        }],
      }),
    }
  );
  if (response.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `تعذر حذف السجل من "${sheetTitle}"`);
  }
}

/**
 * Writes or updates all 3 sheets with the latest data and real Google Sheets formulas
 */
export async function writeAllDataToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  entrees: EntreeItem[],
  sorties: SortieItem[]
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);

  // CRITICAL SAFETY SHIELD: NEVER wipe or clear Google Sheets if both entrees and sorties are empty!
  if (!entrees || !sorties || (entrees.length === 0 && sorties.length === 0)) {
    console.warn('PROTECTION ACTIVE: Blocked writeAllDataToGoogleSheet with empty dataset to prevent accidental data loss.');
    return;
  }

  // Guarantee that all required tabs exist in the spreadsheet before writing
  const { entreeTitle, sortieTitle, syntheseTitle } = await ensureSpreadsheetTabs(
    accessToken,
    cleanId
  );

  const entreeSheetTitle = entreeTitle;
  const sortieSheetTitle = sortieTitle;
  const syntheseSheetTitle = syntheseTitle;

  // Feuille 1 Entrée Values — ترتيب أعمدة GAS: Date | 8 products | Notes | ID
  const entreeRows: any[][] = [
    IN_HEADER,
  ];
  entrees.forEach((e) => {
    entreeRows.push([
      e.date,
      Number(e.qty152Vert) || 0,
      Number(e.qty152Bleu) || 0,
      Number(e.qty152Noir) || 0,
      Number(e.qty152KS) || 0,
      Number(e.qty152KF) || 0,
      Number(e.qty152Gris) || 0,
      Number(e.qty124Vert) || 0,
      Number(e.qty124Bleu) || 0,
      e.notes || '',
      e.id || '',  // عمود ID ليطابق GAS
    ]);
  });

  // Feuille 2 Sortie Values — ترتيب أعمدة GAS: Date | Client | 8 products | Montant | Notes | Wilaya | ID
  const sortieRows: any[][] = [
    OUT_HEADER,
  ];
  sorties.forEach((s) => {
    sortieRows.push([
      s.date,
      s.client || 'Client',
      Number(s.qty152Vert) || 0,
      Number(s.qty152Bleu) || 0,
      Number(s.qty152Noir) || 0,
      Number(s.qty152KS) || 0,
      Number(s.qty152KF) || 0,
      Number(s.qty152Gris) || 0,
      Number(s.qty124Vert) || 0,
      Number(s.qty124Bleu) || 0,
      Number(s.montant) || 0,
      s.notes || '',
      s.wilaya || '',  // Wilaya بعد Notes كما في GAS
      s.id || '',      // عمود ID ليطابق GAS
    ]);
  });

  // Feuille 3 Synthèse Values — معادلات تطابق ترتيب GAS الجديد (بدون Wilaya في البداية)
  // Sortie: B=Client, C=152Vert, D=152Bleu, E=152Noir, F=152KS, G=152KF, H=152Gris, I=124Vert, J=124Bleu, K=Montant
  const syntheseRows: any[][] = [
    ['Produit', 'Total Entrées', 'Total Sorties', 'Stock Restant', 'Statut du Stock'],
    [
      '152 Vert',
      `=SUM('${entreeSheetTitle}'!B2:B)`,
      `=SUM('${sortieSheetTitle}'!C2:C)`,
      '=B2 - C2',
      '=IF(D2<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 Bleu',
      `=SUM('${entreeSheetTitle}'!C2:C)`,
      `=SUM('${sortieSheetTitle}'!D2:D)`,
      '=B3 - C3',
      '=IF(D3<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 Noir',
      `=SUM('${entreeSheetTitle}'!D2:D)`,
      `=SUM('${sortieSheetTitle}'!E2:E)`,
      '=B4 - C4',
      '=IF(D4<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 K.S',
      `=SUM('${entreeSheetTitle}'!E2:E)`,
      `=SUM('${sortieSheetTitle}'!F2:F)`,
      '=B5 - C5',
      '=IF(D5<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 K.F',
      `=SUM('${entreeSheetTitle}'!F2:F)`,
      `=SUM('${sortieSheetTitle}'!G2:G)`,
      '=B6 - C6',
      '=IF(D6<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 Gris',
      `=SUM('${entreeSheetTitle}'!G2:G)`,
      `=SUM('${sortieSheetTitle}'!H2:H)`,
      '=B7 - C7',
      '=IF(D7<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '124 Vert',
      `=SUM('${entreeSheetTitle}'!H2:H)`,
      `=SUM('${sortieSheetTitle}'!I2:I)`,
      '=B8 - C8',
      '=IF(D8<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '124 Bleu',
      `=SUM('${entreeSheetTitle}'!I2:I)`,
      `=SUM('${sortieSheetTitle}'!J2:J)`,
      '=B9 - C9',
      '=IF(D9<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    ['', '', '', '', ''],
    ['Chiffre d’affaires Total (Montant)', `=SUM('${sortieSheetTitle}'!K2:K)`, 'DZD', '', ''],
  ];

  await Promise.all([
    writeRowsById(accessToken, cleanId, entreeSheetTitle, 'K', 'K', IN_HEADER, entreeRows.slice(1), 'e'),
    writeRowsById(accessToken, cleanId, sortieSheetTitle, 'N', 'N', OUT_HEADER, sortieRows.slice(1), 's'),
  ]);

  const syntheseRange = encodeURIComponent("'" + syntheseSheetTitle + "'!A1:E11");
  const batchRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + cleanId + '/values/' + syntheseRange + '?valueInputOption=USER_ENTERED', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: syntheseRows }),
  });

  if (batchRes.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
  if (!batchRes.ok) {
    const err = await batchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update Google Sheets');
  }
}

/**
 * Reads live data from Google Sheets directly (pulls Entrées and Sorties).
 * Acts as the master database reader.
 */
export async function readAllSheetsData(
  accessToken: string,
  spreadsheetId: string
): Promise<{ entrees: EntreeItem[]; sorties: SortieItem[]; isLegacy4Columns?: boolean }> {
  try {
    let entreeSheetTitle = 'Feuille 1 Entrée';
    let sortieSheetTitle = 'Feuille 2 Sortie';

    try {
      const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
      const sheetTitles = meta.sheets.map((s) => s.title);
      
      const foundEntree = sheetTitles.find((t) => /entr[eé]|وارد|in/i.test(t));
      if (foundEntree) entreeSheetTitle = foundEntree;
      else if (sheetTitles[0]) entreeSheetTitle = sheetTitles[0];

      const foundSortie = sheetTitles.find((t) => /sort[ií]e|صادر|مبيع|out/i.test(t));
      if (foundSortie) sortieSheetTitle = foundSortie;
      else if (sheetTitles[1]) sortieSheetTitle = sheetTitles[1];
    } catch (metaErr) {
      console.warn('Could not fetch sheet metadata, falling back to standard tab names:', metaErr);
    }

    // Fetch up to 1000 rows across full column ranges
    const range1 = encodeURIComponent(`'${entreeSheetTitle}'!A1:Z1000`);
    const range2 = encodeURIComponent(`'${sortieSheetTitle}'!A1:Z1000`);

    const [res1, res2] = await Promise.all([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range1}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range2}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    if (res1.status === 401 || res2.status === 401) {
      const err = new Error('GOOGLE_AUTH_EXPIRED');
      (err as any).status = 401;
      throw err;
    }
    const entrees: EntreeItem[] = [];
    const sorties: SortieItem[] = [];
    let isLegacy4Columns = false;

    if (res1.ok) {
      const data1 = await res1.json();
      const allRows: any[][] = data1.values || [];
      const headerRow1: string[] = (allRows[0] || []).map((c: any) => String(c).trim().toLowerCase());
      const is8Products = headerRow1.some((c) => /noir|k\.s|k\.f|gris/i.test(c)) || headerRow1.length >= 9;
      if (headerRow1.length > 0 && !is8Products) {
        isLegacy4Columns = true;
      }

      // الكشف الديناميكي عن موضع أعمدة Entrée
      const eColIdx = (pattern: RegExp) => headerRow1.findIndex((c) => pattern.test(c));
      const e152V  = eColIdx(/^152 vert$/i);
      const e152B  = eColIdx(/^152 bleu$/i);
      const e152N  = eColIdx(/^152 noir$/i);
      const e152KS = eColIdx(/^152 k\.s$/i);
      const e152KF = eColIdx(/^152 k\.f$/i);
      const e152G  = eColIdx(/^152 gris$/i);
      const e124V  = eColIdx(/^124 vert$/i);
      const e124B  = eColIdx(/^124 bleu$/i);
      const eNotes = eColIdx(/^notes$/i);
      const eId    = eColIdx(/^id$/i);

      const dataRows = allRows.slice(1);

      dataRows.forEach((r, idx) => {
        if (!r || !r[0] || String(r[0]).trim() === '') return;
        const firstCol = String(r[0]).trim().toUpperCase();
        if (firstCol.includes('TOTAL') || firstCol.includes('DATE') || firstCol.includes('CHIFFRE')) {
          return;
        }

        const dateVal = String(r[0]).trim();
        const pf = (i: number) => i >= 0 ? parseFloat(String(r[i] ?? '0').replace(/[^0-9.-]/g, '')) || 0 : 0;

        let q152V = 0, q152B = 0, q152N = 0, q152KS = 0, q152KF = 0, q152G = 0, q124V = 0, q124B = 0, notesVal = '';

        if (e152V >= 0) {
          // قراءة ديناميكية بناءً على الرأس (النظام الجديد وGAS)
          q152V  = pf(e152V);
          q152B  = pf(e152B);
          q152N  = pf(e152N);
          q152KS = pf(e152KS);
          q152KF = pf(e152KF);
          q152G  = pf(e152G);
          q124V  = pf(e124V);
          q124B  = pf(e124B);
          notesVal = eNotes >= 0 && r[eNotes] ? String(r[eNotes]).trim() : '';
        } else if (is8Products) {
          // Legacy 8-product sans rأs reconnu (positions fixes)
          q152V = pf(1); q152B = pf(2); q152N = pf(3); q152KS = pf(4);
          q152KF = pf(5); q152G = pf(6); q124V = pf(7); q124B = pf(8);
          notesVal = r[9] ? String(r[9]).trim() : '';
        } else {
          // Old 4 products layout
          q152V = pf(1); q152B = pf(2); q124V = pf(3); q124B = pf(4);
          notesVal = r[5] ? String(r[5]).trim() : '';
        }

        // If all quantities are zero and no notes, skip empty row
        if (q152V === 0 && q152B === 0 && q152N === 0 && q152KS === 0 && q152KF === 0 && q152G === 0 && q124V === 0 && q124B === 0 && !notesVal) {
          return;
        }

        // قراءة ID من الجدول إن وُجد (GAS يكتب ID في آخر عمود)
        const existingId = eId >= 0 && r[eId] ? String(r[eId]).trim() : '';
        const itemId = existingId || `e-${idx}-${dateVal.replace(/[^a-zA-Z0-9]/g, '')}`;

        entrees.push({
          id: itemId,
          date: dateVal,
          qty152Vert: q152V,
          qty152Bleu: q152B,
          qty152Noir: q152N,
          qty152KS: q152KS,
          qty152KF: q152KF,
          qty152Gris: q152G,
          qty124Vert: q124V,
          qty124Bleu: q124B,
          notes: notesVal,
        });
      });
    }

    if (res2.ok) {
      const data2 = await res2.json();
      const allRows: any[][] = data2.values || [];
      const headerRow: string[] = (allRows[0] || []).map((c: any) => String(c).trim().toLowerCase());
      const is8Products = headerRow.some((c) => /noir|k\.s|k\.f|gris/i.test(c)) || headerRow.length >= 11;
      if (headerRow.length > 0 && !is8Products) {
        isLegacy4Columns = true;
      }

      // الكشف الديناميكي عن موضع كل عمود من الرأس
      const colIdx = (pattern: RegExp) => headerRow.findIndex((c) => pattern.test(c));
      const iDate   = 0;
      const iClient = colIdx(/^client$/i);
      // Wilaya يمكن أن تكون في العمود C (القديم) أو بعد Notes (الجديد / GAS)
      const iWilaya = colIdx(/wilaya|ولاية/i);

      // منتجات Sortie — قراءة من الرأس
      const i152V  = colIdx(/^152 vert$/i);
      const i152B  = colIdx(/^152 bleu$/i);
      const i152N  = colIdx(/^152 noir$/i);
      const i152KS = colIdx(/^152 k\.s$/i);
      const i152KF = colIdx(/^152 k\.f$/i);
      const i152G  = colIdx(/^152 gris$/i);
      const i124V  = colIdx(/^124 vert$/i);
      const i124B  = colIdx(/^124 bleu$/i);
      const iMontant = colIdx(/^montant$/i);
      const iNotes   = colIdx(/^notes$/i);
      const iId      = colIdx(/^id$/i);

      const dataRows = allRows.slice(1);

      dataRows.forEach((r, idx) => {
        if (!r || !r[0] || String(r[0]).trim() === '') return;
        const firstCol = String(r[0]).trim().toUpperCase();
        if (firstCol.includes('TOTAL') || firstCol.includes('DATE') || firstCol.includes('CHIFFRE')) {
          return;
        }

        const dateVal   = String(r[iDate] ?? '').trim();
        const clientVal = iClient >= 0 && r[iClient] ? String(r[iClient]).trim() : 'Client';
        const wilayaVal = iWilaya >= 0 && r[iWilaya] ? String(r[iWilaya]).trim() : '';

        const pf = (i: number) => i >= 0 ? parseFloat(String(r[i] ?? '0').replace(/[^0-9.-]/g, '')) || 0 : 0;

        // إذا لم يكن هناك رأس قابل للتعرف (legacy) — نستخدم موضع ثابت
        const useDynamicCols = i152V >= 0;

        let q152V = 0, q152B = 0, q152N = 0, q152KS = 0, q152KF = 0, q152G = 0, q124V = 0, q124B = 0, montantVal = 0, notesVal = '';

        if (useDynamicCols) {
          q152V      = pf(i152V);
          q152B      = pf(i152B);
          q152N      = pf(i152N);
          q152KS     = pf(i152KS);
          q152KF     = pf(i152KF);
          q152G      = pf(i152G);
          q124V      = pf(i124V);
          q124B      = pf(i124B);
          montantVal = pf(iMontant);
          notesVal   = iNotes >= 0 && r[iNotes] ? String(r[iNotes]).trim() : '';
        } else if (is8Products) {
          // Legacy 8-product sans rأs reconnu
          q152V = pf(2); q152B = pf(3); q152N = pf(4); q152KS = pf(5);
          q152KF = pf(6); q152G = pf(7); q124V = pf(8); q124B = pf(9);
          montantVal = pf(10); notesVal = r[11] ? String(r[11]).trim() : '';
        } else {
          // Old 4 products layout
          q152V = pf(2); q152B = pf(3); q124V = pf(4); q124B = pf(5);
          montantVal = pf(6); notesVal = r[7] ? String(r[7]).trim() : '';
        }

        // قراءة ID من الجدول إن وُجد، وإلا نولّد واحدًا
        const existingId = iId >= 0 && r[iId] ? String(r[iId]).trim() : '';
        const itemId = existingId || `s-${idx}-${dateVal.replace(/[^a-zA-Z0-9]/g, '')}`;

        if (q152V === 0 && q152B === 0 && q152N === 0 && q152KS === 0 && q152KF === 0 && q152G === 0 && q124V === 0 && q124B === 0 && montantVal === 0 && !notesVal) {
          return;
        }

        sorties.push({
          id: itemId,
          date: dateVal,
          client: clientVal,
          wilaya: wilayaVal || undefined,
          qty152Vert: q152V,
          qty152Bleu: q152B,
          qty152Noir: q152N,
          qty152KS: q152KS,
          qty152KF: q152KF,
          qty152Gris: q152G,
          qty124Vert: q124V,
          qty124Bleu: q124B,
          montant: montantVal,
          notes: notesVal,
        });
      });
    }

    return { entrees, sorties, isLegacy4Columns };
  } catch (err: any) {
    if (err?.message === 'GOOGLE_AUTH_EXPIRED' || err?.message === 'GOOGLE_SHEET_NO_ACCESS') {
      throw err;
    }
    console.error('Failed to read data from Google Sheets:', err);
    return { entrees: [], sorties: [] };
  }
}

/**
 * Appends a new Entrée row to existing Google Spreadsheet safely without touching existing data
 */
function entreeRow(item: EntreeItem): unknown[] {
  return [item.date || '', ...QTY_KEYS.map((key) => Number(item[key as keyof EntreeItem]) || 0), item.notes || '', item.id];
}

function sortieRow(item: SortieItem): unknown[] {
  return [
    item.date || '', item.client || 'Client',
    ...QTY_KEYS.map((key) => Number(item[key as keyof SortieItem]) || 0),
    Number(item.montant) || 0, item.notes || '', item.wilaya || '', item.id,
  ];
}

export async function appendEntreeRow(
  accessToken: string,
  spreadsheetId: string,
  item: EntreeItem
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const { entreeTitle } = await ensureSpreadsheetTabs(accessToken, cleanId);
  await writeRowsById(accessToken, cleanId, entreeTitle, 'K', 'K', IN_HEADER, [entreeRow(item)], 'e');
}

export async function updateEntreeRow(
  accessToken: string,
  spreadsheetId: string,
  item: EntreeItem
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const { entreeTitle } = await ensureSpreadsheetTabs(accessToken, cleanId);
  const rowNumber = await findRecordRow(accessToken, cleanId, entreeTitle, 'K', IN_HEADER, item.id);
  const range = encodeURIComponent("'" + entreeTitle + "'!A" + rowNumber + ':K' + rowNumber);
  const response = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + cleanId + '/values/' + range + '?valueInputOption=USER_ENTERED',
    {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [entreeRow(item)] }),
    }
  );
  if (response.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to update row in Google Sheets');
  }
}

export async function deleteEntreeRow(
  accessToken: string,
  spreadsheetId: string,
  id: string
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const { entreeTitle } = await ensureSpreadsheetTabs(accessToken, cleanId);
  await deleteRecordRow(accessToken, cleanId, entreeTitle, 'K', IN_HEADER, id);
}

export async function appendSortieRow(
  accessToken: string,
  spreadsheetId: string,
  item: SortieItem
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const { sortieTitle } = await ensureSpreadsheetTabs(accessToken, cleanId);
  await writeRowsById(accessToken, cleanId, sortieTitle, 'N', 'N', OUT_HEADER, [sortieRow(item)], 's');
}

export async function updateSortieRow(
  accessToken: string,
  spreadsheetId: string,
  item: SortieItem
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const { sortieTitle } = await ensureSpreadsheetTabs(accessToken, cleanId);
  const rowNumber = await findRecordRow(accessToken, cleanId, sortieTitle, 'N', OUT_HEADER, item.id);
  const range = encodeURIComponent("'" + sortieTitle + "'!A" + rowNumber + ':N' + rowNumber);
  const response = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + cleanId + '/values/' + range + '?valueInputOption=USER_ENTERED',
    {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [sortieRow(item)] }),
    }
  );
  if (response.status === 401) throw new Error('GOOGLE_AUTH_EXPIRED');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to update row in Google Sheets');
  }
}

export async function deleteSortieRow(
  accessToken: string,
  spreadsheetId: string,
  id: string
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const { sortieTitle } = await ensureSpreadsheetTabs(accessToken, cleanId);
  await deleteRecordRow(accessToken, cleanId, sortieTitle, 'N', OUT_HEADER, id);
}

/**
 * Lists user's spreadsheets in Google Drive (both owned files and files shared with them)
 */
export async function listDriveSpreadsheets(accessToken: string): Promise<DriveFileInfo[]> {
  try {
    // 1. Files in user's Drive
    const q1 = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const p1 = fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q1}&fields=files(id,name,webViewLink,modifiedTime,sharedWithMe,owners)&orderBy=modifiedTime desc&pageSize=25&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    ).then((r) => (r.ok ? r.json() : { files: [] })).catch(() => ({ files: [] }));

    // 2. Files explicitly shared with the user via email
    const q2 = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and sharedWithMe=true");
    const p2 = fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q2}&fields=files(id,name,webViewLink,modifiedTime,sharedWithMe,owners)&orderBy=modifiedTime desc&pageSize=25&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    ).then((r) => (r.ok ? r.json() : { files: [] })).catch(() => ({ files: [] }));

    const [data1, data2] = await Promise.all([p1, p2]);

    const map = new Map<string, DriveFileInfo>();
    const processFile = (f: any, isExplicitShared = false) => {
      if (!f?.id) return;
      const owner = f.owners?.[0]?.emailAddress;
      const isShared = Boolean(f.sharedWithMe || isExplicitShared);
      map.set(f.id, {
        id: f.id,
        name: f.name || 'Feuille sans titre',
        webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
        modifiedTime: f.modifiedTime,
        sharedWithMe: isShared,
        ownerEmail: owner,
      });
    };

    (data2.files || []).forEach((f: any) => processFile(f, true));
    (data1.files || []).forEach((f: any) => processFile(f, false));

    return Array.from(map.values());
  } catch (err) {
    console.warn('Failed to list spreadsheets:', err);
    return [];
  }
}

/**
 * Gets the active shared spreadsheet configured for the team/organization
 */
export async function getSharedSheetConfig(): Promise<SharedSheetConfig | null> {
  try {
    const res = await fetch('/api/shared-sheet');
    if (!res.ok) return null;
    const data = await res.json();
    return data.sheet || null;
  } catch {
    return null;
  }
}

/**
 * Saves the active shared spreadsheet to the backend so all team members can connect automatically
 */
export async function saveSharedSheetConfig(
  sheet: { id: string; title: string; url: string },
  sharedBy?: string,
  token?: string,
  webhookUrl?: string
): Promise<void> {
  try {
    await fetch('/api/shared-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sheet.id,
        title: sheet.title,
        url: sheet.url,
        sharedBy: sharedBy || 'Admin',
        token,
        webhookUrl,
      }),
    });
  } catch (err) {
    console.warn('Failed to save shared sheet config:', err);
  }
}
