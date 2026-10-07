import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
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
