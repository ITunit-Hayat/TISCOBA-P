import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Initialize GoogleGenAI server-side with required User-Agent
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Chat API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!ai) {
      return res.status(500).json({ error: 'Gemini API Key is not configured' });
    }

    const systemInstruction = `أنت خبير محترف في إدارة المخزون (Gestion de stock) وجداول بيانات Google Sheets وإكسل.
تساعد المستخدم في فهم وإدارة ملف المخزون المكون من:
1. Feuille 1 (Entrée): Date, 152 Vert, 152 Bleu, 124 Vert, 124 Bleu
2. Feuille 2 (Sortie): Date, Client, 152 Vert, 152 Bleu, 124 Vert, 124 Bleu, Montant
3. Feuille 3 (Synthèse / Stock Restant): المخزون المتبقي = الوارد - الصادر

أجب بلغة واضحة ومهنية (بالعربية أو الفرنسية حسب لغة المستخدم).
قدم معادلات Google Sheets المباشرة مثل SUM, SOMME.SI, QUERY عند طلبها، وقدم نصائح للمستودعات وتدقيق الفواتير. كن ودوداً ودقيقاً.`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message || 'مرحبا' }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const text = response.text || '';
    res.json({ reply: text });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate response' });
  }
});

// Image Analysis endpoint (Analyze receipts, bills of lading, inventory count sheets)
app.post('/api/analyze-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!ai) {
      return res.status(500).json({ error: 'Gemini API Key is not configured' });
    }
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Clean base64 if prefixed
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const prompt = `حلل صورة الوصل أو الفاتورة أو ورقة الجرد المرفقة بدقة لاستخراج بيانات المخزون.
المنتجات المحددة في النظام هي 4 أصناف فقط:
- 152 Vert (152 أخضر)
- 152 Bleu (152 أزرق)
- 124 Vert (124 أخضر)
- 124 Bleu (124 أزرق)

حدد ما إذا كانت هذه الوثيقة:
- "entree" (وصل استلام بضاعة / Bon de réception / Achat)
- أو "sortie" (فاتورة بيع لعميل / Bon de livraison / Vente)

أرجع النتيجة بصيغة JSON حصراً بهذا الشكل:
{
  "type": "entree" | "sortie",
  "date": "YYYY-MM-DD",
  "client": "اسم العميل إن وجد أو فارغ",
  "qty_152_vert": رقم الكمية (أو 0),
  "qty_152_bleu": رقم الكمية (أو 0),
  "qty_124_vert": رقم الكمية (أو 0),
  "qty_124_bleu": رقم الكمية (أو 0),
  "montant": المبلغ الإجمالي إن وجد (أو 0),
  "notes": "ملاحظات وتلخيص قصير لما تم اكتشافه في الوثيقة"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsedData = {};
    try {
      parsedData = JSON.parse(text);
    } catch {
      parsedData = { rawText: text };
    }

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Analyze image error:', error);
    res.status(500).json({ error: error?.message || 'Failed to analyze image' });
  }
});

// Persistent shared spreadsheet endpoint
const DATA_DIR = path.join(__dirname, '.data');
const SHARED_FILE_PATH = path.join(DATA_DIR, 'shared_sheet.json');
const INVENTORY_FILE_PATH = path.join(DATA_DIR, 'inventory_cache.json');

app.get('/api/shared-sheet', (_req, res) => {
  try {
    if (fs.existsSync(SHARED_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(SHARED_FILE_PATH, 'utf-8'));
      return res.json({ sheet: data });
    }
  } catch (e) {
    console.warn('Error reading shared sheet config:', e);
  }
  res.json({ sheet: null });
});

app.post('/api/shared-sheet', (req, res) => {
  try {
    const { id, title, url, sharedBy, token, webhookUrl } = req.body;
    if (!id && !webhookUrl) {
      return res.status(400).json({ error: 'Spreadsheet ID or Webhook URL is required' });
    }

    let existingToken: string | undefined;
    let existingWebhook: string | undefined;
    if (fs.existsSync(SHARED_FILE_PATH)) {
      try {
        const oldData = JSON.parse(fs.readFileSync(SHARED_FILE_PATH, 'utf-8'));
        existingToken = oldData.token;
        existingWebhook = oldData.webhookUrl;
      } catch {}
    }

    const data = {
      id: id || '1YmMLdU0c547GqTnxmdxexRQri4Pv2ifWfFE9ogEknIc',
      title: title || 'Tiscobap - Gestion de Stock (152 & 124)',
      url: url || `https://docs.google.com/spreadsheets/d/${id || '1YmMLdU0c547GqTnxmdxexRQri4Pv2ifWfFE9ogEknIc'}/edit`,
      sharedBy: sharedBy || 'bansalahilyes@gmail.com',
      token: token || existingToken || undefined,
      webhookUrl: webhookUrl || existingWebhook || undefined,
      updatedAt: new Date().toISOString(),
    };
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SHARED_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, sheet: data });
  } catch (e: any) {
    console.error('Error saving shared sheet config:', e);
    res.status(500).json({ error: e?.message || 'Failed to save shared sheet config' });
  }
});

// Helper to push values via Google Apps Script Webhook
async function syncViaWebhook(webhookUrl: string, entrees: any[], sorties: any[]) {
  try {
    const payload = JSON.stringify({ entrees, sorties, timestamp: new Date().toISOString() });
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
      redirect: 'follow',
    });
    const text = await res.text();
    console.log('Webhook response status:', res.status, text.slice(0, 200));
    if (res.ok && (text.includes('success') || res.status === 200)) {
      console.log('Successfully synced via Google Apps Script Webhook!');
      return true;
    }
  } catch (err) {
    console.warn('Webhook sync error:', err);
  }
  return false;
}

// Helper to push values directly to Google Sheets via Sheets API v4
async function syncDataToGoogleSheets(sheetId: string, token: string, entrees: any[], sorties: any[]) {
  // CRITICAL SAFETY SHIELD: NEVER wipe Google Sheets if both entrees and sorties are empty
  if (!Array.isArray(entrees) || !Array.isArray(sorties) || (entrees.length === 0 && sorties.length === 0)) {
    console.warn('PROTECTION ACTIVE: Skipped syncing empty inventory to Google Sheets');
    return false;
  }
  try {
    // 1. Fetch metadata to inspect tabs
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      console.warn('Cannot fetch sheet metadata on server:', metaRes.status);
      return false;
    }
    const meta = await metaRes.json();
    const existingSheets = meta.sheets || [];
    const titles: string[] = existingSheets.map((s: any) => s.properties?.title || '');

    let entreeTitle = titles.find((t) => /entr[eé]|وارد|in/i.test(t));
    let sortieTitle = titles.find((t) => /sort[ií]e|صادر|مبيع|out/i.test(t));
    let syntheseTitle = titles.find((t) => /synth[eèé]se|ملخص|stock/i.test(t));

    const requests: any[] = [];

    // If 1 generic sheet, rename to Feuille 1 Entrée and add other 2
    if (existingSheets.length === 1 && !entreeTitle && !sortieTitle && !syntheseTitle) {
      const firstId = existingSheets[0].properties?.sheetId;
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: firstId, title: 'Feuille 1 Entrée' },
          fields: 'title',
        },
      });
      requests.push({ addSheet: { properties: { title: 'Feuille 2 Sortie' } } });
      requests.push({ addSheet: { properties: { title: 'Feuille 3 Synthèse' } } });
      entreeTitle = 'Feuille 1 Entrée';
      sortieTitle = 'Feuille 2 Sortie';
      syntheseTitle = 'Feuille 3 Synthèse';
    } else {
      if (!entreeTitle) {
        if (!titles.includes('Feuille 1 Entrée')) {
          requests.push({ addSheet: { properties: { title: 'Feuille 1 Entrée' } } });
          entreeTitle = 'Feuille 1 Entrée';
        } else {
          entreeTitle = 'Feuille 1 Entrée';
        }
      }
      if (!sortieTitle) {
        if (!titles.includes('Feuille 2 Sortie')) {
          requests.push({ addSheet: { properties: { title: 'Feuille 2 Sortie' } } });
        }
        sortieTitle = 'Feuille 2 Sortie';
      }
      if (!syntheseTitle) {
        if (!titles.includes('Feuille 3 Synthèse')) {
          requests.push({ addSheet: { properties: { title: 'Feuille 3 Synthèse' } } });
        }
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
      ['Date', '152 Vert', '152 Bleu', '152 Noir', '152 K.S', '152 K.F', '152 Gris', '124 Vert', '124 Bleu', 'Notes'],
      ...entrees.map((item: any) => [
        item.date || '',
        Number(item.qty152Vert) || 0,
        Number(item.qty152Bleu) || 0,
        Number(item.qty152Noir) || 0,
        Number(item.qty152KS) || 0,
        Number(item.qty152KF) || 0,
        Number(item.qty152Gris) || 0,
        Number(item.qty124Vert) || 0,
        Number(item.qty124Bleu) || 0,
        item.notes || '',
      ]),
    ];

    const sortieRows = [
      ['Date', 'Client', 'Wilaya', '152 Vert', '152 Bleu', '152 Noir', '152 K.S', '152 K.F', '152 Gris', '124 Vert', '124 Bleu', 'Montant', 'Notes'],
      ...sorties.map((item: any) => [
        item.date || '',
        item.client || '',
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
      ]),
    ];

    const syntheseRows = [
      ['Produit', 'Total Entrées', 'Total Sorties', 'Stock Restant', 'Statut du Stock'],
      ['152 Vert', `=SUM('${finalEntree}'!B2:B)`, `=SUM('${finalSortie}'!D2:D)`, '=B2 - C2', '=IF(D2<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 Bleu', `=SUM('${finalEntree}'!C2:C)`, `=SUM('${finalSortie}'!E2:E)`, '=B3 - C3', '=IF(D3<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 Noir', `=SUM('${finalEntree}'!D2:D)`, `=SUM('${finalSortie}'!F2:F)`, '=B4 - C4', '=IF(D4<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 K.S', `=SUM('${finalEntree}'!E2:E)`, `=SUM('${finalSortie}'!G2:G)`, '=B5 - C5', '=IF(D5<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 K.F', `=SUM('${finalEntree}'!F2:F)`, `=SUM('${finalSortie}'!H2:H)`, '=B6 - C6', '=IF(D6<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['152 Gris', `=SUM('${finalEntree}'!G2:G)`, `=SUM('${finalSortie}'!I2:I)`, '=B7 - C7', '=IF(D7<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['124 Vert', `=SUM('${finalEntree}'!H2:H)`, `=SUM('${finalSortie}'!J2:J)`, '=B8 - C8', '=IF(D8<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['124 Bleu', `=SUM('${finalEntree}'!I2:I)`, `=SUM('${finalSortie}'!K2:K)`, '=B9 - C9', '=IF(D9<=10, "⚠️ Stock Faible", "✅ Disponible")'],
      ['', '', '', '', ''],
      ['Chiffre d’affaires Total (Montant)', `=SUM('${finalSortie}'!L2:L)`, 'DZD', '', ''],
    ];

    // Clear old ranges first to avoid leftovers
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchClear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: [`'${finalEntree}'!A1:Z500`, `'${finalSortie}'!A1:Z500`, `'${finalSynthese}'!A1:Z50`],
      }),
    }).catch(() => {});

    // Write updated data
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
    } else {
      console.warn('Batch write failed:', await batchRes.json().catch(() => ({})));
      return false;
    }
  } catch (err) {
    console.warn('Server Google Sheets sync error:', err);
    return false;
  }
}

// Endpoint to explicitly push latest inventory cache to Google Sheets
app.post('/api/sync-now', async (req, res) => {
  try {
    const { token } = req.body;
    if (!fs.existsSync(SHARED_FILE_PATH)) {
      return res.status(400).json({ error: 'No shared sheet configured yet' });
    }
    const sheetCfg = JSON.parse(fs.readFileSync(SHARED_FILE_PATH, 'utf-8'));
    const effectiveToken = token || sheetCfg.token;

    let inventory = { entrees: [], sorties: [] };
    if (fs.existsSync(INVENTORY_FILE_PATH)) {
      inventory = JSON.parse(fs.readFileSync(INVENTORY_FILE_PATH, 'utf-8'));
    }

    let webhookSuccess = false;
    if (sheetCfg?.webhookUrl) {
      webhookSuccess = await syncViaWebhook(sheetCfg.webhookUrl, inventory.entrees || [], inventory.sorties || []);
    }

    let apiSuccess = false;
    if (sheetCfg?.id && effectiveToken) {
      if (token) {
        sheetCfg.token = token;
        fs.writeFileSync(SHARED_FILE_PATH, JSON.stringify(sheetCfg, null, 2), 'utf-8');
      }
      apiSuccess = await syncDataToGoogleSheets(sheetCfg.id, effectiveToken, inventory.entrees || [], inventory.sorties || []);
    }

    if (webhookSuccess || apiSuccess) {
      return res.json({ 
        success: true, 
        webhook: webhookSuccess, 
        api: apiSuccess,
        count: (inventory.entrees?.length || 0) + (inventory.sorties?.length || 0) 
      });
    }

    if (!effectiveToken && !sheetCfg?.webhookUrl) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED' });
    }

    return res.status(500).json({ error: 'Failed to write to Google Sheets' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Sync error' });
  }
});

// Shared inventory data sync across team members
app.get('/api/inventory', (_req, res) => {
  try {
    if (fs.existsSync(INVENTORY_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(INVENTORY_FILE_PATH, 'utf-8'));
      return res.json({ success: true, data });
    }
  } catch (e) {
    console.warn('Error reading inventory cache:', e);
  }
  res.json({ success: true, data: null });
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { entrees, sorties, author, token } = req.body;
    const data = {
      entrees: Array.isArray(entrees) ? entrees : [],
      sorties: Array.isArray(sorties) ? sorties : [],
      author: author || 'Team',
      updatedAt: new Date().toISOString(),
    };
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(INVENTORY_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');

    // Optional webhook notification (non-destructive)
    if (fs.existsSync(SHARED_FILE_PATH)) {
      try {
        const sheetCfg = JSON.parse(fs.readFileSync(SHARED_FILE_PATH, 'utf-8'));
        if (token && token !== sheetCfg.token) {
          sheetCfg.token = token;
          sheetCfg.updatedAt = new Date().toISOString();
          fs.writeFileSync(SHARED_FILE_PATH, JSON.stringify(sheetCfg, null, 2), 'utf-8');
        }
        if (sheetCfg?.webhookUrl && (data.entrees.length > 0 || data.sorties.length > 0)) {
          syncViaWebhook(sheetCfg.webhookUrl, data.entrees, data.sorties);
        }
      } catch (syncErr) {
        console.warn('Sync warning on inventory post:', syncErr);
      }
    }

    res.json({ success: true, data });
  } catch (e: any) {
    console.error('Error saving inventory cache:', e);
    res.status(500).json({ error: e?.message || 'Failed to save inventory cache' });
  }
});

// Setup Vite dev server or static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
