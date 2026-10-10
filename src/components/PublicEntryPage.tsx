import { FormEvent, useState } from 'react';
import { CheckCircle2, Loader2, PackagePlus, Send } from 'lucide-react';
import { submitPublicEntryToSheet } from '../services/googleDriveSheets';

const PRODUCTS = [
  { key: 'qty152Vert', label: '152 أخضر' },
  { key: 'qty152Bleu', label: '152 أزرق' },
  { key: 'qty152Noir', label: '152 أسود' },
  { key: 'qty152KS', label: '152 K.S' },
  { key: 'qty152KF', label: '152 K.F' },
  { key: 'qty152Gris', label: '152 رمادي' },
  { key: 'qty124Vert', label: '124 أخضر' },
  { key: 'qty124Bleu', label: '124 أزرق' },
] as const;

type ProductKey = (typeof PRODUCTS)[number]['key'];
type FormValues = Record<ProductKey, string> & {
  date: string;
  kind: 'entree' | 'sortie';
  client: string;
  wilaya: string;
  montant: string;
  notes: string;
  website: string;
};

function localDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function emptyForm(): FormValues {
  return {
    date: localDate(),
    kind: 'entree',
    client: '',
    wilaya: '',
    montant: '',
    notes: '',
    website: '',
    qty152Vert: '',
    qty152Bleu: '',
    qty152Noir: '',
    qty152KS: '',
    qty152KF: '',
    qty152Gris: '',
    qty124Vert: '',
    qty124Bleu: '',
  };
}

export default function PublicEntryPage() {
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const quantities = Object.fromEntries(
      PRODUCTS.map(({ key }) => [key, Number(form[key]) || 0])
    ) as Record<ProductKey, number>;
    if (!Object.values(quantities).some((quantity) => quantity > 0)) {
      setMessage({ type: 'error', text: 'يرجى إدخال كمية لمنتج واحد على الأقل.' });
      return;
    }
    if (form.kind === 'sortie' && !form.client.trim()) {
      setMessage({ type: 'error', text: 'يرجى إدخال اسم الزبون.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await submitPublicEntryToSheet(form.kind, {
        id: `public-${Date.now()}`,
        date: form.date,
        ...quantities,
        ...(form.kind === 'sortie'
          ? {
              client: form.client.trim(),
              wilaya: form.wilaya.trim() || undefined,
              montant: Number(form.montant) || 0,
            }
          : {}),
        notes: form.notes.trim() || undefined,
      });
      setForm(emptyForm());
      setMessage({ type: 'success', text: 'تم حفظ العملية مباشرة في Google Sheets بنجاح.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر الحفظ في Google Sheets؛ حاول مجددًا.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <PackagePlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">تسجيل حركة المخزون</h1>
          <p className="mt-2 text-sm text-slate-600">تُحفظ البيانات مباشرة في Google Sheets.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>نوع العملية</span>
              <select
                className={inputClass}
                value={form.kind}
                onChange={(event) => update('kind', event.target.value as FormValues['kind'])}
              >
                <option value="entree">استلام (دخول للمخزون)</option>
                <option value="sortie">بيع (خروج من المخزون)</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>التاريخ</span>
              <input
                required
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(event) => update('date', event.target.value)}
              />
            </label>
          </div>

          {form.kind === 'sortie' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>اسم الزبون</span>
                <input
                  required
                  maxLength={120}
                  className={inputClass}
                  value={form.client}
                  onChange={(event) => update('client', event.target.value)}
                  placeholder="اسم الزبون"
                />
              </label>
              <label>
                <span className={labelClass}>الولاية (اختياري)</span>
                <input
                  maxLength={80}
                  className={inputClass}
                  value={form.wilaya}
                  onChange={(event) => update('wilaya', event.target.value)}
                  placeholder="الولاية"
                />
              </label>
            </div>
          )}

          <fieldset>
            <legend className="mb-3 text-sm font-bold text-slate-800">الكميات</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRODUCTS.map(({ key, label }) => (
                <label key={key}>
                  <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    step="any"
                    inputMode="decimal"
                    className={inputClass}
                    value={form[key]}
                    onChange={(event) => update(key, event.target.value)}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {form.kind === 'sortie' && (
            <label>
              <span className={labelClass}>المبلغ (دج)</span>
              <input
                type="number"
                min="0"
                max="1000000000"
                step="any"
                className={inputClass}
                value={form.montant}
                onChange={(event) => update('montant', event.target.value)}
                placeholder="0"
              />
            </label>
          )}

          <label>
            <span className={labelClass}>ملاحظات (اختياري)</span>
            <textarea
              maxLength={500}
              rows={3}
              className={inputClass}
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="ملاحظات إضافية"
            />
          </label>

          <label className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
            اترك هذا الحقل فارغًا
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => update('website', event.target.value)}
            />
          </label>

          {message && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded-xl px-3 py-3 text-sm ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ العملية'}
          </button>
          <p className="text-center text-xs text-slate-500">لا تحتاج إلى تسجيل الدخول للإرسال.</p>
        </form>
      </div>
    </main>
  );
}
