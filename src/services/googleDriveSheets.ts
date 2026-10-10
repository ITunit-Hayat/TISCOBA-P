import { EntreeItem, SortieItem } from '../types/stock';

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

  // Clear previous data rows (preserving row 1 headers) only when real data is being written
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ranges: [
            `'${entreeSheetTitle}'!A2:Z1000`,
            `'${sortieSheetTitle}'!A2:Z1000`,
            `'${syntheseSheetTitle}'!A2:Z100`,
          ],
        }),
      }
    );
  } catch (clearErr) {
    console.warn('Clear range warning:', clearErr);
  }

  // Feuille 1 Entrée Values (pure data rows, no circular total row in data stream)
  const entreeRows: any[][] = [
    ['Date', '152 Vert', '152 Bleu', '152 Noir', '152 K.S', '152 K.F', '152 Gris', '124 Vert', '124 Bleu', 'Notes'],
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
    ]);
  });

  // Feuille 2 Sortie Values (pure data rows, no circular total row in data stream)
  const sortieRows: any[][] = [
    ['Date', 'Client', 'Wilaya', '152 Vert', '152 Bleu', '152 Noir', '152 K.S', '152 K.F', '152 Gris', '124 Vert', '124 Bleu', 'Montant', 'Notes'],
  ];
  sorties.forEach((s) => {
    sortieRows.push([
      s.date,
      s.client || 'Client',
      s.wilaya || '',
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
    ]);
  });

  // Feuille 3 Synthèse Values with standard English Google Sheets formulas dynamic to sheet titles
  const syntheseRows: any[][] = [
    ['Produit', 'Total Entrées', 'Total Sorties', 'Stock Restant', 'Statut du Stock'],
    [
      '152 Vert',
      `=SUM('${entreeSheetTitle}'!B2:B)`,
      `=SUM('${sortieSheetTitle}'!D2:D)`,
      '=B2 - C2',
      '=IF(D2<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 Bleu',
      `=SUM('${entreeSheetTitle}'!C2:C)`,
      `=SUM('${sortieSheetTitle}'!E2:E)`,
      '=B3 - C3',
      '=IF(D3<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 Noir',
      `=SUM('${entreeSheetTitle}'!D2:D)`,
      `=SUM('${sortieSheetTitle}'!F2:F)`,
      '=B4 - C4',
      '=IF(D4<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 K.S',
      `=SUM('${entreeSheetTitle}'!E2:E)`,
      `=SUM('${sortieSheetTitle}'!G2:G)`,
      '=B5 - C5',
      '=IF(D5<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 K.F',
      `=SUM('${entreeSheetTitle}'!F2:F)`,
      `=SUM('${sortieSheetTitle}'!H2:H)`,
      '=B6 - C6',
      '=IF(D6<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 Gris',
      `=SUM('${entreeSheetTitle}'!G2:G)`,
      `=SUM('${sortieSheetTitle}'!I2:I)`,
      '=B7 - C7',
      '=IF(D7<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '124 Vert',
      `=SUM('${entreeSheetTitle}'!H2:H)`,
      `=SUM('${sortieSheetTitle}'!J2:J)`,
      '=B8 - C8',
      '=IF(D8<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '124 Bleu',
      `=SUM('${entreeSheetTitle}'!I2:I)`,
      `=SUM('${sortieSheetTitle}'!K2:K)`,
      '=B9 - C9',
      '=IF(D9<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    ['', '', '', '', ''],
    ['Chiffre d’affaires Total (Montant)', `=SUM('${sortieSheetTitle}'!L2:L)`, 'DZD', '', ''],
  ];

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'${entreeSheetTitle}'!A1`,
            values: entreeRows,
          },
          {
            range: `'${sortieSheetTitle}'!A1`,
            values: sortieRows,
          },
          {
            range: `'${syntheseSheetTitle}'!A1`,
            values: syntheseRows,
          },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    if (batchRes.status === 401) {
      throw new Error('GOOGLE_AUTH_EXPIRED');
    }
    const err = await batchRes.json().catch(() => ({}));
    console.warn('Batch update values failed:', err);
    throw new Error(err.error?.message || 'Erreur lors de la mise à jour des feuilles Google Sheets');
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
      const headerRow = allRows[0] || [];
      const is8Products = headerRow.some((cell: any) => /noir|k\.s|k\.f|gris/i.test(String(cell))) || headerRow.length >= 9;
      if (headerRow.length > 0 && !is8Products) {
        isLegacy4Columns = true;
      }
      const dataRows = allRows.slice(1);

      dataRows.forEach((r, idx) => {
        if (!r || !r[0] || String(r[0]).trim() === '') return;
        const firstCol = String(r[0]).trim().toUpperCase();
        if (firstCol.includes('TOTAL') || firstCol.includes('DATE') || firstCol.includes('CHIFFRE')) {
          return;
        }

        const dateVal = String(r[0]).trim();
        let q152V = 0, q152B = 0, q152N = 0, q152KS = 0, q152KF = 0, q152G = 0, q124V = 0, q124B = 0, notesVal = '';

        if (is8Products) {
          q152V = parseFloat(String(r[1] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152B = parseFloat(String(r[2] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152N = parseFloat(String(r[3] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152KS = parseFloat(String(r[4] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152KF = parseFloat(String(r[5] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152G = parseFloat(String(r[6] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124V = parseFloat(String(r[7] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124B = parseFloat(String(r[8] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          notesVal = r[9] ? String(r[9]).trim() : '';
        } else {
          // Old 4 products layout
          q152V = parseFloat(String(r[1] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152B = parseFloat(String(r[2] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124V = parseFloat(String(r[3] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124B = parseFloat(String(r[4] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          notesVal = r[5] ? String(r[5]).trim() : '';
        }

        // If all quantities are zero and no notes, skip empty row
        if (q152V === 0 && q152B === 0 && q152N === 0 && q152KS === 0 && q152KF === 0 && q152G === 0 && q124V === 0 && q124B === 0 && !notesVal) {
          return;
        }

        entrees.push({
          id: `drive-entree-${idx}-${dateVal.replace(/[^a-zA-Z0-9]/g, '')}`,
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
      const headerRow = allRows[0] || [];
      const is8Products = headerRow.some((cell: any) => /noir|k\.s|k\.f|gris/i.test(String(cell))) || headerRow.length >= 11;
      if (headerRow.length > 0 && !is8Products) {
        isLegacy4Columns = true;
      }
      const hasWilayaCol = headerRow.some((cell: any) => /wilaya|ولاية/i.test(String(cell)));
      const dataRows = allRows.slice(1);

      dataRows.forEach((r, idx) => {
        if (!r || !r[0] || String(r[0]).trim() === '') return;
        const firstCol = String(r[0]).trim().toUpperCase();
        if (firstCol.includes('TOTAL') || firstCol.includes('DATE') || firstCol.includes('CHIFFRE')) {
          return;
        }

        const dateVal = String(r[0]).trim();
        const clientVal = r[1] ? String(r[1]).trim() : 'Client';
        let wilayaVal = '';
        let q152V = 0, q152B = 0, q152N = 0, q152KS = 0, q152KF = 0, q152G = 0, q124V = 0, q124B = 0, montantVal = 0, notesVal = '';

        if (hasWilayaCol) {
          wilayaVal = r[2] ? String(r[2]).trim() : '';
          q152V = parseFloat(String(r[3] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152B = parseFloat(String(r[4] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152N = parseFloat(String(r[5] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152KS = parseFloat(String(r[6] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152KF = parseFloat(String(r[7] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152G = parseFloat(String(r[8] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124V = parseFloat(String(r[9] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124B = parseFloat(String(r[10] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          montantVal = parseFloat(String(r[11] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          notesVal = r[12] ? String(r[12]).trim() : '';
        } else if (is8Products) {
          q152V = parseFloat(String(r[2] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152B = parseFloat(String(r[3] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152N = parseFloat(String(r[4] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152KS = parseFloat(String(r[5] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152KF = parseFloat(String(r[6] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152G = parseFloat(String(r[7] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124V = parseFloat(String(r[8] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124B = parseFloat(String(r[9] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          montantVal = parseFloat(String(r[10] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          notesVal = r[11] ? String(r[11]).trim() : '';
        } else {
          // Old 4 products layout
          q152V = parseFloat(String(r[2] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q152B = parseFloat(String(r[3] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124V = parseFloat(String(r[4] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          q124B = parseFloat(String(r[5] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          montantVal = parseFloat(String(r[6] ?? '0').replace(/[^0-9.-]/g, '')) || 0;
          notesVal = r[7] ? String(r[7]).trim() : '';
        }

        if (q152V === 0 && q152B === 0 && q152N === 0 && q152KS === 0 && q152KF === 0 && q152G === 0 && q124V === 0 && q124B === 0 && montantVal === 0 && !notesVal) {
          return;
        }

        sorties.push({
          id: `drive-sortie-${idx}-${dateVal.replace(/[^a-zA-Z0-9]/g, '')}`,
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
export async function appendEntreeRow(
  accessToken: string,
  spreadsheetId: string,
  item: EntreeItem
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const { entreeTitle } = await ensureSpreadsheetTabs(accessToken, cleanId);

  const row = [
    item.date || new Date().toISOString().split('T')[0],
    Number(item.qty152Vert) || 0,
    Number(item.qty152Bleu) || 0,
    Number(item.qty152Noir) || 0,
    Number(item.qty152KS) || 0,
    Number(item.qty152KF) || 0,
    Number(item.qty152Gris) || 0,
    Number(item.qty124Vert) || 0,
    Number(item.qty124Bleu) || 0,
    item.notes || '',
  ];

  const range = encodeURIComponent(`'${entreeTitle}'!A:J`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erreur lors de l’ajout de l’entrée dans Google Sheets');
  }
}

/**
 * Appends a new Sortie row to existing Google Spreadsheet safely without touching existing data
 */
export async function appendSortieRow(
  accessToken: string,
  spreadsheetId: string,
  item: SortieItem
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const { sortieTitle } = await ensureSpreadsheetTabs(accessToken, cleanId);

  const row = [
    item.date || new Date().toISOString().split('T')[0],
    item.client || 'Client',
    item.wilaya || '',
    Number(item.qty152Vert) || 0,
    Number(item.qty152Bleu) || 0,
    Number(item.qty152Noir) || 0,
    Number(item.qty152KS) || 0,
    Number(item.qty152KF) || 0,
    Number(item.qty152Gris) || 0,
    Number(item.qty124Vert) || 0,
    Number(item.qty124Bleu) || 0,
    Number(item.montant) || 0,
    item.notes || '',
  ];

  const range = encodeURIComponent(`'${sortieTitle}'!A:M`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Erreur lors de l’ajout de la sortie dans Google Sheets');
  }
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
