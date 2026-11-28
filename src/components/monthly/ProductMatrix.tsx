import React from 'react';
import { Package } from 'lucide-react';
import { fmt, MonthDetailRow, ProductConfig, PRODUCTS_LIST } from './types';

interface MatrixProps {
  isAr: boolean;
  allRows: MonthDetailRow[];
  selectedMonth: string;
  selectedProduct: string;
  onSelectProduct: (key: string) => void;
}

export const ProductMatrix: React.FC<MatrixProps> = ({
  isAr,
  allRows,
  selectedMonth,
  selectedProduct,
  onSelectProduct,
}) => {
  return (
    <div>
      <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-purple-600" />
        {isAr ? 'بطاقات أداء المنتجات الثمانية (152 و 124)' : 'Synthèse par Produit (152 & 124)'}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {PRODUCTS_LIST.map((prod: ProductConfig) => {
          const rowsForProd = allRows.filter(
            (r) => r.productKey === prod.key && (selectedMonth === 'all' || r.month === selectedMonth)
          );
          const pIn = rowsForProd.reduce((acc, r) => acc + r.entree, 0);
          const pOut = rowsForProd.reduce((acc, r) => acc + r.sortie, 0);
          const pBal = pIn - pOut;

          const isSelected = selectedProduct === prod.key;

          return (
            <div
              key={prod.key}
              onClick={() => onSelectProduct(isSelected ? 'all' : prod.key)}
              className={`p-3 rounded-2xl border transition cursor-pointer select-none ${
                isSelected
                  ? 'border-purple-600 bg-purple-50/60 shadow-sm ring-2 ring-purple-300'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-slate-900">{prod.code}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: prod.color }} />
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate mb-2">
                {isAr ? prod.nameAr : prod.nameFr}
              </div>

              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex justify-between text-emerald-700">
                  <span className="font-sans text-[10px] text-slate-400">{isAr ? 'وارد' : 'In'}</span>
                  <span className="font-bold">{fmt(pIn)}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span className="font-sans text-[10px] text-slate-400">{isAr ? 'صادر' : 'Out'}</span>
                  <span className="font-bold">{fmt(pOut)}</span>
                </div>
                <div className={`flex justify-between font-black pt-1 border-t border-slate-100 ${pBal < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  <span className="font-sans text-[10px] text-slate-400">{isAr ? 'رصيد' : 'Bal'}</span>
                  <span>{fmt(pBal)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
