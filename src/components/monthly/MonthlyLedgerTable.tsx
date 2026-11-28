import React from 'react';
import { Calendar, Download, Package, RefreshCw } from 'lucide-react';
import { fmt, Lang, MonthDetailRow, monthLabel, round2 } from './types';

interface Props {
  isAr: boolean;
  lang: Lang;
  loading: boolean;
  rows: MonthDetailRow[];
  totals: { entree: number; sortie: number; balance: number; revenue: number };
  onExportCSV: () => void;
}

export const MonthlyLedgerTable: React.FC<Props> = ({ isAr, lang, loading, rows, totals, onExportCSV }) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            {isAr ? 'جدول المتابعة الشهرية المفصل' : 'Tableau Détaillé'}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {isAr ? 'سجل تفصيلي لحركة المخزون والمبيعات لكل شهر ولكل صنف' : 'Suivi complet par mois et par article'}
          </p>
        </div>
        <button
          onClick={onExportCSV}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isAr ? 'تحميل جدول المتابعة (CSV)' : 'Télécharger (CSV)'}</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-start">{isAr ? 'الشهر' : 'Mois'}</th>
              <th className="px-4 py-3 text-start">{isAr ? 'المنتج' : 'Produit'}</th>
              <th className="px-4 py-3 text-end text-emerald-800">{isAr ? 'الوارد (م)' : 'Entrée (m)'}</th>
              <th className="px-4 py-3 text-end text-blue-800">{isAr ? 'الصادر (م)' : 'Sortie (m)'}</th>
              <th className="px-4 py-3 text-end">{isAr ? 'الرصيد (م)' : 'Solde (m)'}</th>
              <th className="px-4 py-3 text-end text-amber-900">{isAr ? 'المداخيل (دج)' : 'Revenu (DZD)'}</th>
              <th className="px-4 py-3 text-center">{isAr ? 'الاستهلاك' : 'Taux'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{isAr ? 'جارٍ التحميل...' : 'Chargement...'}</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{isAr ? 'لا توجد بيانات' : 'Aucune donnée'}</td></tr>
            )}
            {!loading && rows.map((r, idx) => (
              <tr key={`${r.month}-${r.productKey}-${idx}`} className="hover:bg-purple-50/30 transition">
                <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{monthLabel(r.month, lang)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${r.product.bgLight} ${r.product.textLight} ${r.product.borderLight}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.product.color }} />
                    <span>{r.product.code}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-end font-mono font-bold text-emerald-700">{fmt(r.entree)}</td>
                <td className="px-4 py-3 text-end font-mono font-bold text-blue-700">{fmt(r.sortie)}</td>
                <td className="px-4 py-3 text-end font-mono font-black">
                  <span className={r.balance < 0 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded-lg' : 'text-slate-900'}>{fmt(r.balance)}</span>
                </td>
                <td className="px-4 py-3 text-end font-mono font-black text-amber-900">{round2(r.revenue).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">{r.rate}%</span>
                </td>
              </tr>
            ))}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-200">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-base">{isAr ? 'المجموع' : 'Total'}</td>
                <td className="px-4 py-3 text-end font-mono text-emerald-700">{fmt(totals.entree)} m</td>
                <td className="px-4 py-3 text-end font-mono text-blue-700">{fmt(totals.sortie)} m</td>
                <td className="px-4 py-3 text-end font-mono text-purple-900">{fmt(totals.balance)} m</td>
                <td className="px-4 py-3 text-end font-mono text-amber-950">{round2(totals.revenue).toLocaleString()} DZD</td>
                <td className="px-4 py-3 text-center text-xs font-mono text-slate-500">
                  {totals.entree > 0 ? `${Math.round((totals.sortie / totals.entree) * 100)}%` : '-'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
