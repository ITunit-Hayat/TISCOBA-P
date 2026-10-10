/**
 * Sync inventory data to Google Sheets via Sheets API v4.
 * Extracted from the original Express server to run as a Vercel helper
 * (no persistent filesystem needed).
 */

const QTY_KEYS = [
  'qty152Vert', 'qty152Bleu', 'qty152Noir', 'qty152KS',
  'qty152KF', 'qty152Gris', 'qty124Vert', 'qty124Bleu',
];

// ترتيب أعمدة GAS: Date | 8 products | Notes | ID
const IN_HEAD = ['Date', '152 Vert', '152 Bleu', '152 Noir', '152 K.S', '152 K.F', '152 Gris', '124 Vert', '124 Bleu', 'Notes', 'ID'];
// ترتيب أعمدة GAS: Date | Client | 8 products | Montant | Notes | Wilaya | ID
const OUT_HEAD = ['Date', 'Client', '152 Vert', '152 Bleu', '152 Noir', '152 K.S', '152 K.F', '152 Gris', '124 Vert', '124 Bleu', 'Montant', 'Notes', 'Wilaya', 'ID'];

function norm(t: string): string {
  return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export async function syncDataToGoogleSheets(
  sheetId: string,
  token: string,
  entrees: any[],
  sorties: any[]
): Promise<boolean> {
  // CRITICAL SAFETY SHIELD: NEVER wipe Google Sheets if both lists are empty
  if (!Array.isArray(entrees) || !Array.isArray(sorties) || (entrees.length === 0 && sorties.length === 0)) {
    console.warn('PROTECTION ACTIVE: Skipped syncing empty inventory to Google Sheets');
    return false;
  }

  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      console.warn('Cannot fetch sheet metadata:', metaRes.status);
      return false;
    }
    const meta = await metaRes.json();
    const titles: string[] = (meta.sheets || []).map((s: any) => s.properties?.title || '');

    let entreeTitle = titles.find((t) => /entree|وارد/i.test(norm(t)));
    let sortieTitle = titles.find((t) => /sortie|صادر|مبيع/i.test(norm(t)));
    let syntheseTitle = titles.find((t) => /synthese|ملخص|stock/i.test(norm(t)));

    const requests: any[] = [];
    if (titles.length === 1 && !entreeTitle && !sortieTitle && !syntheseTitle) {
      const firstId = meta.sheets[0].properties?.sheetId;
      requests.push({ updateSheetProperties: { properties: { sheetId: firstId, title: 'Feuille 1 Entrée' }, fields: 'title' } });
      requests.push({ addSheet: { properties: { title: 'Feuille 2 Sortie' } } });
      requests.push({ addSheet: { properties: { title: 'Feuille 3 Synthèse' } } });
      entreeTitle = 'Feuille 1 Entrée';
      sortieTitle = 'Feuille 2 Sortie';
      syntheseTitle = 'Feuille 3 Synthèse';
    } else {
      if (!entreeTitle) {
        if (!titles.includes('Feuille 1 Entrée')) requests.push({ addSheet: { properties: { title: 'Feuille 1 Entrée' } } });
        entreeTitle = 'Feuille 1 Entrée';
      }
      if (!sortieTitle) {
        if (!titles.includes('Feuille 2 Sortie')) requests.push({ addSheet: { properties: { title: 'Feuille 2 Sortie' } } });
        sortieTitle = 'Feuille 2 Sortie';
      }
      if (!syntheseTitle) {
        if (!titles.includes('Feuille 3 Synthèse')) requests.push({ addSheet: { properties: { title: 'Feuille 3 Synthèse' } } });
        syntheseTitle = 'Feuille 3 Synthèse';
      }
    }

    if (requests.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }).catch(() => {});
    }

    const finalEntree = entreeTitle || 'Feuille 1 Entrée';
    const finalSortie = sortieTitle || 'Feuille 2 Sortie';
    const finalSynthese = syntheseTitle || 'Feuille 3 Synthèse';

    const entreeRows = [
      IN_HEAD,
      ...entrees.map((item: any) =>
        [item.date || ''].concat(QTY_KEYS.map((k) => Number(item[k]) || 0)).concat([item.notes || '', item.id || ''])
      ),
    ];

    const sortieRows = [
      OUT_HEAD,
      ...sorties.map((item: any) =>
        // Date | Client | 8 products | Montant | Notes | Wilaya | ID
        [item.date || '', item.client || '']
          .concat(QTY_KEYS.map((k) => Number(item[k]) || 0))
          .concat([Number(item.montant) || 0, item.notes || '', item.wilaya || '', item.id || ''])
      ),
    ];

    const syntheseRows = [
      ['Produit', 'Total Entrées', 'Total Sorties', 'Stock Restant', 'Statut du Stock'],
      ['152 Vert', `=SUM('${finalEntree}'!B2:B)`, `=SUM('${finalSortie}'!C2:C)`, '=B2 - C2', '=IF(D2<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 Bleu', `=SUM('${finalEntree}'!C2:C)`, `=SUM('${finalSortie}'!D2:D)`, '=B3 - C3', '=IF(D3<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 Noir', `=SUM('${finalEntree}'!D2:D)`, `=SUM('${finalSortie}'!E2:E)`, '=B4 - C4', '=IF(D4<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 K.S', `=SUM('${finalEntree}'!E2:E)`, `=SUM('${finalSortie}'!F2:F)`, '=B5 - C5', '=IF(D5<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 K.F', `=SUM('${finalEntree}'!F2:F)`, `=SUM('${finalSortie}'!G2:G)`, '=B6 - C6', '=IF(D6<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 Gris', `=SUM('${finalEntree}'!G2:G)`, `=SUM('${finalSortie}'!H2:H)`, '=B7 - C7', '=IF(D7<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['124 Vert', `=SUM('${finalEntree}'!H2:H)`, `=SUM('${finalSortie}'!I2:I)`, '=B8 - C8', '=IF(D8<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['124 Bleu', `=SUM('${finalEntree}'!I2:I)`, `=SUM('${finalSortie}'!J2:J)`, '=B9 - C9', '=IF(D9<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['', '', '', '', ''],
      ['Chiffre d’affaires Total (Montant)', `=SUM('${finalSortie}'!K2:K)`, 'DZD', '', ''],
    ];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchClear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: [`'${finalEntree}'!A1:Z500`, `'${finalSortie}'!A1:Z500`, `'${finalSynthese}'!A1:Z50`],
      }),
    }).catch(() => {});

    const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${finalEntree}'!A1`, values: entreeRows },
          { range: `'${finalSortie}'!A1`, values: sortieRows },
          { range: `'${finalSynthese}'!A1`, values: syntheseRows },
        ],
      }),
    });

    if (batchRes.ok) {
      console.log('Successfully synced inventory to Google Sheets!');
      return true;
    }
    console.warn('Batch write failed:', await batchRes.json().catch(() => ({})));
    return false;
  } catch (err) {
    console.warn('Google Sheets sync error:', err);
    return false;
  }
}

