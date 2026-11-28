export type Lang = 'ar' | 'fr';

export interface ProductConfig {
  key: string;
  code: string;
  nameAr: string;
  nameFr: string;
  color: string;
  bgLight: string;
  borderLight: string;
  textLight: string;
}

export const PRODUCTS_LIST: ProductConfig[] = [
  { key: 'qty152Vert', code: '152 Vert', nameAr: '152 أخضر', nameFr: '152 Vert', color: '#16a34a', bgLight: 'bg-emerald-50', borderLight: 'border-emerald-200', textLight: 'text-emerald-800' },
  { key: 'qty152Bleu', code: '152 Bleu', nameAr: '152 أزرق', nameFr: '152 Bleu', color: '#2563eb', bgLight: 'bg-blue-50', borderLight: 'border-blue-200', textLight: 'text-blue-800' },
  { key: 'qty152Noir', code: '152 Noir', nameAr: '152 أسود', nameFr: '152 Noir', color: '#18181b', bgLight: 'bg-neutral-100', borderLight: 'border-neutral-300', textLight: 'text-neutral-900' },
  { key: 'qty152KS',   code: '152 K.S',  nameAr: '152 K.S',  nameFr: '152 K.S',  color: '#d97706', bgLight: 'bg-amber-50', borderLight: 'border-amber-200', textLight: 'text-amber-800' },
  { key: 'qty152KF',   code: '152 K.F',  nameAr: '152 K.F',  nameFr: '152 K.F',  color: '#ea580c', bgLight: 'bg-orange-50', borderLight: 'border-orange-200', textLight: 'text-orange-900' },
  { key: 'qty152Gris', code: '152 Gris', nameAr: '152 رمادي', nameFr: '152 Gris', color: '#475569', bgLight: 'bg-slate-100', borderLight: 'border-slate-300', textLight: 'text-slate-800' },
  { key: 'qty124Vert', code: '124 Vert', nameAr: '124 أخضر', nameFr: '124 Vert', color: '#0d9488', bgLight: 'bg-teal-50', borderLight: 'border-teal-200', textLight: 'text-teal-800' },
  { key: 'qty124Bleu', code: '124 Bleu', nameAr: '124 أزرق', nameFr: '124 Bleu', color: '#0284c7', bgLight: 'bg-sky-50', borderLight: 'border-sky-200', textLight: 'text-sky-800' },
];

export function round2(v: number): number {
  return Math.round((v || 0) * 100) / 100;
}

export function fmt(v: number): string {
  const r = round2(v);
  return r === 0 ? '0.00' : r.toFixed(2);
}

export function monthOf(d: string): string {
  return (d || '').slice(0, 7);
}

export function monthLabel(m: string, lang: Lang): string {
  if (!m) return '';
  const [y, mm] = m.split('-');
  const ar = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const fr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const idx = parseInt(mm, 10) - 1;
  const name = lang === 'ar' ? ar[idx] ?? mm : fr[idx] ?? mm;
  return `${name} ${y}`;
}

export interface MonthDetailRow {
  month: string;
  productKey: string;
  product: ProductConfig;
  entree: number;
  sortie: number;
  balance: number;
  revenue: number;
  rate: number;
}
