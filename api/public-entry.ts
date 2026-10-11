import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addPublicGoogleSheetEntry } from '../lib/googleSheets.js';

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

class InputError extends Error {}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function boundedText(value: unknown, maxLength: number, required = false): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw new InputError('يرجى إدخال اسم الزبون.');
  if (text.length > maxLength) throw new InputError('أحد الحقول النصية أطول من الحد المسموح.');
  return text;
}

function nonNegativeNumber(value: unknown, max: number): number {
  if (value === undefined || value === null || value === '') return 0;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw new InputError('تحقق من الكميات والمبلغ؛ يجب أن تكون أرقامًا موجبة ضمن الحد المسموح.');
  }
  return number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'طريقة الطلب غير مدعومة.' });
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
      throw new InputError('نوع العملية غير صحيح.');
    }
    if (!validDate(body.date)) throw new InputError('يرجى اختيار تاريخ صحيح.');

    const quantities: Record<(typeof PRODUCT_KEYS)[number], number> = {
      qty152Vert: 0,
      qty152Bleu: 0,
      qty152Noir: 0,
      qty152KS: 0,
      qty152KF: 0,
      qty152Gris: 0,
      qty124Vert: 0,
      qty124Bleu: 0,
    };
    let totalQuantity = 0;
    for (const key of PRODUCT_KEYS) {
      const quantity = nonNegativeNumber(body[key], 1_000_000);
      quantities[key] = quantity;
      totalQuantity += quantity;
    }
    if (totalQuantity <= 0) {
      throw new InputError('يرجى إدخال كمية لمنتج واحد على الأقل.');
    }
    const itemBase = {
      id: `public-${crypto.randomUUID()}`,
      date: body.date,
      ...quantities,
      notes: boundedText(body.notes, 500) || undefined,
    };
    if (body.kind === 'sortie') {
      await addPublicGoogleSheetEntry('sortie', {
        ...itemBase,
        client: boundedText(body.client, 120, true),
        wilaya: boundedText(body.wilaya, 80) || undefined,
        montant: nonNegativeNumber(body.montant, 1_000_000_000),
      });
    } else {
      await addPublicGoogleSheetEntry('entree', itemBase);
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    if (error instanceof InputError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof Error && error.message.includes('is not configured')) {
      return res.status(503).json({ error: 'خدمة Google Sheets غير مهيأة. أبلغ مسؤول التطبيق.' });
    }
    console.error('Public entry Google Sheets request failed:', error);
    return res.status(502).json({ error: 'تعذر تسجيل العملية في Google Sheets.' });
  }
}
