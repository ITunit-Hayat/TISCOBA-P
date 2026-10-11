import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAI, GEMINI_MODEL } from '../lib/gemini.js';

export const config = { maxDuration: 60 };

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : null;
    if (!body) return res.status(400).json({ error: 'Invalid request body' });

    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
    if (!imageBase64) return res.status(400).json({ error: 'Image data is required' });
    if (imageBase64.length > 4_100_000) {
      return res.status(413).json({ error: 'Image is too large. Please use an image under about 3 MB.' });
    }

    const dataUrlMime = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i)?.[1];
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : (dataUrlMime || 'image/jpeg').toLowerCase();
    if (!IMAGE_TYPES.has(mimeType)) {
      return res.status(415).json({ error: 'Unsupported image type. Use JPEG, PNG, WEBP, or GIF.' });
    }

    let ai;
    try {
      ai = getAI();
    } catch {
      return res.status(503).json({ error: 'Gemini API key is not configured. Set GEMINI_API_KEY in Vercel.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
      return res.status(400).json({ error: 'Image data is not valid base64.' });
    }

    const prompt = `حلل صورة الوصل أو الفاتورة أو ورقة الجرد بدقة. لا تخمّن الكميات غير الواضحة؛ ضع 0 وأضف ملاحظة عند تعذر القراءة.

المنتجات الثمانية هي:
- qty152Vert: 152 Vert (152 أخضر)
- qty152Bleu: 152 Bleu (152 أزرق)
- qty152Noir: 152 Noir (152 أسود)
- qty152KS: 152 K.S
- qty152KF: 152 K.F
- qty152Gris: 152 Gris (152 رمادي)
- qty124Vert: 124 Vert (124 أخضر)
- qty124Bleu: 124 Bleu (124 أزرق)

حدد kind على أنه "entree" لوثيقة استلام/شراء، أو "sortie" لوثيقة بيع/تسليم لعميل.
أعد JSON فقط بالحقول التالية، دون Markdown أو نص خارج JSON:
{
  "kind": "entree" | "sortie",
  "date": "YYYY-MM-DD أو سلسلة فارغة إذا لم يظهر التاريخ",
  "client": "اسم العميل أو سلسلة فارغة",
  "wilaya": "الولاية أو سلسلة فارغة",
  "qty152Vert": 0,
  "qty152Bleu": 0,
  "qty152Noir": 0,
  "qty152KS": 0,
  "qty152KF": 0,
  "qty152Gris": 0,
  "qty124Vert": 0,
  "qty124Bleu": 0,
  "montant": 0,
  "notes": "ملاحظات مختصرة، مع التنبيه إلى أي خانة غير واضحة"
}
يجب أن تكون الكميات والمبلغ أرقامًا، وتكون القيم غير الموجودة 0 أو سلسلة فارغة كما هو موضح.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: prompt },
        ],
      },
      config: { responseMimeType: 'application/json' },
    });

    const responseText = response.text || '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('Gemini returned non-JSON receipt analysis');
      return res.status(502).json({ error: 'تعذر تحليل الفاتورة إلى بيانات منظمة. جرّب صورة أوضح.' });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return res.status(502).json({ error: 'Gemini returned an invalid receipt result.' });
    }

    const data = parsed as Record<string, unknown>;
    if (data.kind !== 'entree' && data.kind !== 'sortie') {
      return res.status(502).json({ error: 'لم يتمكن النموذج من تحديد نوع العملية.' });
    }
    for (const key of ['qty152Vert', 'qty152Bleu', 'qty152Noir', 'qty152KS', 'qty152KF', 'qty152Gris', 'qty124Vert', 'qty124Bleu', 'montant']) {
      const value = Number(data[key] ?? 0);
      data[key] = Number.isFinite(value) && value >= 0 ? value : 0;
    }
    for (const key of ['date', 'client', 'wilaya', 'notes']) {
      data[key] = typeof data[key] === 'string' ? (data[key] as string).slice(0, key === 'notes' ? 500 : 120) : '';
    }

    return res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    console.error('Analyze image error:', error);
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to analyze image' });
  }
}
