import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAI, GEMINI_MODEL } from '../lib/gemini';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let ai;
    try {
      ai = getAI();
    } catch {
      return res.status(500).json({ error: 'Gemini API Key is not configured' });
    }

    const { message, history } = req.body || {};

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
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const text = response.text || '';
    return res.status(200).json({ reply: text });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate response' });
  }
}
