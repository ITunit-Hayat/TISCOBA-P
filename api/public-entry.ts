import type { VercelRequest, VercelResponse } from '@vercel/node';

const PRODUCT_KEYS = [
  'qty152Vert',
  'qty152Bleu',
  'qty152Noir',
  'qty152KS',
  'qty152KF',
  'qty152Gris',
  'qty124Vert',
  'qty124Bleu',
] as const;

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function boundedText(value: unknown, maxLength: number, required = false): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw new Error('يرجى إدخال اسم الزبون.');
  if (text.length > maxLength) throw new Error('أحد الحقول النصية أطول من الحد المسموح.');
  return text;
}

function nonNegativeNumber(value: unknown, max: number): number {
  if (value === undefined || value === null || value === '') return 0;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw new Error('تحقق من الكميات والمبلغ؛ يجب أن تكون أرقامًا موجبة ضمن الحد المسموح.');
  }
  return number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'طريقة الطلب غير مدعومة.' });
  }

  const webhookUrl = process.env.SHARED_SHEET_WEBHOOK;
  const webhookToken = process.env.SHARED_SHEET_WEBHOOK_TOKEN;
  const sheetId = process.env.SHARED_SHEET_ID;
  if (!webhookUrl || !webhookToken || !sheetId) {
    return res.status(503).json({ error: 'خدمة الحفظ غير مهيأة بعد. أبلغ مسؤول التطبيق.' });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return res.status(500).json({ error: 'رابط Apps Script غير صالح.' });
  }
  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(parsedUrl.pathname)
  ) {
    return res.status(500).json({ error: 'رابط Apps Script غير صالح.' });
  }

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : null;
  if (!body) return res.status(400).json({ error: 'البيانات المرسلة غير صحيحة.' });

  try {
    if (JSON.stringify(body).length > 10_000) {
      return res.status(413).json({ error: 'حجم البيانات أكبر من المسموح.' });
    }
    if (body.website) return res.status(200).json({ status: 'success' });
    if (body.kind !== 'entree' && body.kind !== 'sortie') {
      return res.status(400).json({ error: 'نوع العملية غير صحيح.' });
    }
    if (!validDate(body.date)) return res.status(400).json({ error: 'يرجى اختيار تاريخ صحيح.' });

    const item: Record<string, string | number> = {
      id: `public-${crypto.randomUUID()}`,
      date: body.date,
    };
    let totalQuantity = 0;
    for (const key of PRODUCT_KEYS) {
      const quantity = nonNegativeNumber(body[key], 1_000_000);
      item[key] = quantity;
      totalQuantity += quantity;
    }
    if (totalQuantity <= 0) {
      return res.status(400).json({ error: 'يرجى إدخال كمية لمنتج واحد على الأقل.' });
    }
    item.notes = boundedText(body.notes, 500);

    if (body.kind === 'sortie') {
      item.client = boundedText(body.client, 120, true);
      item.wilaya = boundedText(body.wilaya, 80);
      item.montant = nonNegativeNumber(body.montant, 1_000_000_000);
    }

    const targetUrl = new URL(parsedUrl);
    targetUrl.searchParams.set('token', webhookToken);
    const infoUrl = new URL(targetUrl);
    infoUrl.searchParams.set('action', 'info');
    const infoResponse = await fetch(infoUrl, { method: 'GET', redirect: 'follow' });
    const info = await infoResponse.json().catch(() => null);
    const infoTargetUrl = String(info?.target?.url || '');
    const infoTargetId = infoTargetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!infoResponse.ok || info?.status !== 'ok' || infoTargetId !== sheetId) {
      console.error('Public entry Apps Script target check failed.');
      return res.status(502).json({ error: 'تعذر التحقق من جدول Google Sheets المرتبط.' });
    }

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'publicAdd',
        sheet: body.kind,
        item,
        token: webhookToken,
      }),
    });
    const result = await upstream.json().catch(() => null);
    const resultTargetUrl = String(result?.target?.url || '');
    const resultTargetId = resultTargetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!upstream.ok || result?.status !== 'success' || !result?.saved || resultTargetId !== sheetId) {
      console.error('Public entry Apps Script write failed:', upstream.status, result?.error || 'invalid response');
      return res.status(502).json({ error: 'لم يؤكد Google Sheets حفظ العملية.' });
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('fetch')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Public entry Apps Script request failed:', error);
    return res.status(502).json({ error: 'تعذر الاتصال بخدمة Google Sheets.' });
  }
}
