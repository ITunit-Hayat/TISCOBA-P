export interface EntreeItem {
  id: string;
  date: string;
  qty152Vert: number;
  qty152Bleu: number;
  qty152Noir?: number;
  qty152KS?: number;
  qty152KF?: number;
  qty152Gris?: number;
  qty124Vert: number;
  qty124Bleu: number;
  notes?: string;
}

export interface SortieItem {
  id: string;
  date: string;
  client: string;
  wilaya?: string;
  qty152Vert: number;
  qty152Bleu: number;
  qty152Noir?: number;
  qty152KS?: number;
  qty152KF?: number;
  qty152Gris?: number;
  qty124Vert: number;
  qty124Bleu: number;
  montant: number;
  notes?: string;
}

export type ProductKey = 
  | '152_vert' 
  | '152_bleu' 
  | '152_noir' 
  | '152_ks' 
  | '152_kf' 
  | '152_gris' 
  | '124_vert' 
  | '124_bleu';

export interface ProductMeta {
  key: ProductKey;
  code: string;
  nameAr: string;
  nameFr: string;
  colorHex: string;
  accentClass: string;
}

export const PRODUCTS: ProductMeta[] = [
  {
    key: '152_vert',
    code: '152 Vert',
    nameAr: '152 أخضر',
    nameFr: '152 Vert',
    colorHex: '#16a34a',
    accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
  {
    key: '152_bleu',
    code: '152 Bleu',
    nameAr: '152 أزرق',
    nameFr: '152 Bleu',
    colorHex: '#2563eb',
    accentClass: 'bg-blue-50 text-blue-700 border-blue-300',
  },
  {
    key: '152_noir',
    code: '152 Noir',
    nameAr: '152 أسود',
    nameFr: '152 Noir',
    colorHex: '#18181b',
    accentClass: 'bg-neutral-100 text-neutral-900 border-neutral-300',
  },
  {
    key: '152_ks',
    code: '152 K.S',
    nameAr: '152 K.S',
    nameFr: '152 K.S',
    colorHex: '#b45309',
    accentClass: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  {
    key: '152_kf',
    code: '152 K.F',
    nameAr: '152 K.F',
    nameFr: '152 K.F',
    colorHex: '#78350f',
    accentClass: 'bg-orange-50 text-orange-950 border-orange-300',
  },
  {
    key: '152_gris',
    code: '152 Gris',
    nameAr: '152 رمادي',
    nameFr: '152 Gris',
    colorHex: '#475569',
    accentClass: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  {
    key: '124_vert',
    code: '124 Vert',
    nameAr: '124 أخضر',
    nameFr: '124 Vert',
    colorHex: '#059669',
    accentClass: 'bg-teal-50 text-teal-700 border-teal-300',
  },
  {
    key: '124_bleu',
    code: '124 Bleu',
    nameAr: '124 أزرق',
    nameFr: '124 Bleu',
    colorHex: '#0284c7',
    accentClass: 'bg-sky-50 text-sky-700 border-sky-300',
  },
];
