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

    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Clean base64 if prefixed
    const cleanBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z]+;base64,/, '');

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
      model: GEMINI_MODEL,
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

    return res.status(200).json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Analyze image error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to analyze image' });
  }
}
