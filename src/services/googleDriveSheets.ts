import { EntreeItem, SortieItem } from '../types/stock';

export interface DriveFileInfo {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface SheetMetadata {
  title: string;
  sheets: { id: number; title: string }[];
}

/**
 * Extracts a Google Spreadsheet ID from a URL or raw ID string.
 */
export function extractSpreadsheetId(input: string): string {
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
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'Impossible d’accéder au fichier Google Sheets');
  }

  const data = await res.json();
  return {
    title: data.properties?.title || 'Fichier Google Sheets',
    sheets: (data.sheets || []).map((s: any) => ({
      id: s.properties?.sheetId,
      title: s.properties?.title,
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
            gridProperties: { rowCount: 200, columnCount: 10 },
          },
        },
        {
          properties: {
            title: 'Feuille 2 Sortie',
            gridProperties: { rowCount: 200, columnCount: 10 },
          },
        },
        {
          properties: {
            title: 'Feuille 3 Synthèse',
            gridProperties: { rowCount: 50, columnCount: 10 },
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
 * Writes or updates all 3 sheets with the latest data and real Google Sheets formulas
 */
export async function writeAllDataToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  entrees: EntreeItem[],
  sorties: SortieItem[]
): Promise<void> {
  // 1. Clear old values in the 3 sheets to wipe out any previous #REF! errors and stale cells
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
            "'Feuille 1 Entrée'!A1:Z500",
            "'Feuille 2 Sortie'!A1:Z500",
            "'Feuille 3 Synthèse'!A1:Z50",
          ],
        }),
      }
    );
  } catch (clearErr) {
    console.warn('Clear range warning:', clearErr);
  }

  // Feuille 1 Entrée Values (pure data rows, no circular total row in data stream)
  const entreeRows: any[][] = [
    ['Date', '152 Vert', '152 Bleu', '124 Vert', '124 Bleu', 'Notes'],
  ];
  entrees.forEach((e) => {
    entreeRows.push([
      e.date,
      Number(e.qty152Vert) || 0,
      Number(e.qty152Bleu) || 0,
      Number(e.qty124Vert) || 0,
      Number(e.qty124Bleu) || 0,
      e.notes || '',
    ]);
  });

  // Feuille 2 Sortie Values (pure data rows, no circular total row in data stream)
  const sortieRows: any[][] = [
    ['Date', 'Client', '152 Vert', '152 Bleu', '124 Vert', '124 Bleu', 'Montant', 'Notes'],
  ];
  sorties.forEach((s) => {
    sortieRows.push([
      s.date,
      s.client || 'Client',
      Number(s.qty152Vert) || 0,
      Number(s.qty152Bleu) || 0,
      Number(s.qty124Vert) || 0,
      Number(s.qty124Bleu) || 0,
      Number(s.montant) || 0,
      s.notes || '',
    ]);
  });

  // Feuille 3 Synthèse Values with standard English Google Sheets formulas and commas
  const syntheseRows: any[][] = [
    ['Produit', 'Total Entrées', 'Total Sorties', 'Stock Restant', 'Statut du Stock'],
    [
      '152 Vert',
      "=SUM('Feuille 1 Entrée'!B2:B)",
      "=SUM('Feuille 2 Sortie'!C2:C)",
      '=B2 - C2',
      '=IF(D2<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '152 Bleu',
      "=SUM('Feuille 1 Entrée'!C2:C)",
      "=SUM('Feuille 2 Sortie'!D2:D)",
      '=B3 - C3',
      '=IF(D3<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '124 Vert',
      "=SUM('Feuille 1 Entrée'!D2:D)",
      "=SUM('Feuille 2 Sortie'!E2:E)",
      '=B4 - C4',
      '=IF(D4<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    [
      '124 Bleu',
      "=SUM('Feuille 1 Entrée'!E2:E)",
      "=SUM('Feuille 2 Sortie'!F2:F)",
      '=B5 - C5',
      '=IF(D5<=10, "⚠️ Stock Faible", "✅ Disponible")',
    ],
    ['', '', '', '', ''],
    ['Chiffre d’affaires Total (Montant)', "=SUM('Feuille 2 Sortie'!G2:G)", 'DZD', '', ''],
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
            range: "'Feuille 1 Entrée'!A1",
            values: entreeRows,
          },
          {
            range: "'Feuille 2 Sortie'!A1",
            values: sortieRows,
          },
          {
            range: "'Feuille 3 Synthèse'!A1",
            values: syntheseRows,
          },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    const err = await batchRes.json();
    console.warn('Batch update values failed:', err);
    throw new Error(err.error?.message || 'Erreur lors de la mise à jour des feuilles Google Sheets');
  }
}

/**
 * Reads live data from Google Sheets directly (pulls Entrées and Sorties)
 */
export async function readAllSheetsData(
  accessToken: string,
  spreadsheetId: string
): Promise<{ entrees: EntreeItem[]; sorties: SortieItem[] }> {
  // Fetch up to 500 rows across full column ranges
  const range1 = encodeURIComponent("'Feuille 1 Entrée'!A2:F500");
  const range2 = encodeURIComponent("'Feuille 2 Sortie'!A2:H500");

  const [res1, res2] = await Promise.all([
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range1}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range2}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const entrees: EntreeItem[] = [];
  const sorties: SortieItem[] = [];

  if (res1.ok) {
    const data1 = await res1.json();
    const rows: any[][] = data1.values || [];
    rows.forEach((r, idx) => {
      // Ignore empty or header rows
      if (!r[0] || String(r[0]).toUpperCase().includes('TOTAL') || String(r[0]).toUpperCase().includes('DATE')) {
        return;
      }
      entrees.push({
        id: `drive-entree-${idx}-${Date.now()}`,
        date: String(r[0]),
        qty152Vert: Number(r[1]) || 0,
        qty152Bleu: Number(r[2]) || 0,
        qty124Vert: Number(r[3]) || 0,
        qty124Bleu: Number(r[4]) || 0,
        notes: r[5] ? String(r[5]) : '',
      });
    });
  }

  if (res2.ok) {
    const data2 = await res2.json();
    const rows: any[][] = data2.values || [];
    rows.forEach((r, idx) => {
      if (!r[0] || String(r[0]).toUpperCase().includes('TOTAL') || String(r[0]).toUpperCase().includes('DATE')) {
        return;
      }
      sorties.push({
        id: `drive-sortie-${idx}-${Date.now()}`,
        date: String(r[0]),
        client: r[1] ? String(r[1]) : 'Client',
        qty152Vert: Number(r[2]) || 0,
        qty152Bleu: Number(r[3]) || 0,
        qty124Vert: Number(r[4]) || 0,
        qty124Bleu: Number(r[5]) || 0,
        montant: Number(r[6]) || 0,
        notes: r[7] ? String(r[7]) : '',
      });
    });
  }

  return { entrees, sorties };
}

/**
 * Appends a new Entrée row to existing Google Spreadsheet
 */
export async function appendEntreeRow(
  accessToken: string,
  spreadsheetId: string,
  item: EntreeItem
): Promise<void> {
  const row = [
    item.date,
    Number(item.qty152Vert) || 0,
    Number(item.qty152Bleu) || 0,
    Number(item.qty124Vert) || 0,
    Number(item.qty124Bleu) || 0,
    item.notes || '',
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Feuille 1 Entrée'!A:F:append?valueInputOption=USER_ENTERED`,
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
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'Erreur lors de l’ajout de l’entrée dans Google Sheets');
  }
}

/**
 * Appends a new Sortie row to existing Google Spreadsheet
 */
export async function appendSortieRow(
  accessToken: string,
  spreadsheetId: string,
  item: SortieItem
): Promise<void> {
  const row = [
    item.date,
    item.client || 'Client',
    Number(item.qty152Vert) || 0,
    Number(item.qty152Bleu) || 0,
    Number(item.qty124Vert) || 0,
    Number(item.qty124Bleu) || 0,
    Number(item.montant) || 0,
    item.notes || '',
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Feuille 2 Sortie'!A:H:append?valueInputOption=USER_ENTERED`,
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
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'Erreur lors de l’ajout de la sortie dans Google Sheets');
  }
}

/**
 * Lists user's spreadsheets in Google Drive
 */
export async function listDriveSpreadsheets(accessToken: string): Promise<DriveFileInfo[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedTime desc&pageSize=15`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.files || [];
}
