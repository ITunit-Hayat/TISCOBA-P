import React from 'react';
import { Calendar, Package } from 'lucide-react';
import { Lang, monthLabel, ProductConfig, PRODUCTS_LIST } from './types';

interface Props {
  isAr: boolean;
  lang: Lang;
  months: string[];
  selectedMonth: string;
  selectedProduct: string;
  onSelectMonth: (m: string) => void;
  onSelectProduct: (p: string) => void;
  totalCount: number;
}

export const MonthlyFilterBar: React.FC<Props> = ({
  isAr,
  lang,
  months,
  selectedMonth,
  selectedProduct,
  onSelectMonth,
  onSelectProduct,
  totalCount,
}) => {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <label className="text-xs font-bold text-slate-700">{isAr ? 'الشهر:' : 'Mois:'}</label>
          <select
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
          >
            <option value="all">{isAr ? '📅 جميع الأشهر' : '📅 Tous les mois'}</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m, lang)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-400 shrink-0" />
          <label className="text-xs font-bold text-slate-700">{isAr ? 'المنتج:' : 'Produit:'}</label>
          <select
            value={selectedProduct}
            onChange={(e) => onSelectProduct(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
          >
            <option value="all">{isAr ? '📦 جميع المنتجات' : '📦 Tous les produits'}</option>
            {PRODUCTS_LIST.map((p: ProductConfig) => (
              <option key={p.key} value={p.key}>{p.code} ({isAr ? p.nameAr : p.nameFr})</option>
            ))}
          </select>
        </div>

        {(selectedMonth !== 'all' || selectedProduct !== 'all') && (
          <button
            onClick={() => {
              onSelectMonth('all');
              onSelectProduct('all');
            }}
            className="text-xs text-purple-700 hover:text-purple-900 font-bold underline px-2 py-1"
          >
            {isAr ? 'إعادة ضبط' : 'Réinitialiser'}
          </button>
        )}
      </div>

      <div className="text-xs font-semibold text-slate-500">
        {isAr ? `عرض ${totalCount} سجل مفصل` : `${totalCount} lignes`}
      </div>
    </div>
  );
};
