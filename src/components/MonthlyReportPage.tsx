import React from 'react';
import { ArrowLeft, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { useMonthlyData } from './monthly/useMonthlyData';
import { MonthlyKpiCards } from './monthly/MonthlyKpiCards';
import { MonthlyFilterBar } from './monthly/MonthlyFilterBar';
import { MonthlyBarChart } from './monthly/MonthlyBarChart';
import { MonthlyDonutChart } from './monthly/MonthlyDonutChart';
import { ProductMatrix } from './monthly/ProductMatrix';
import { MonthlyLedgerTable } from './monthly/MonthlyLedgerTable';

export default function MonthlyReportPage() {
  const d = useMonthlyData();

  return (
    <div dir={d.isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50/70 text-slate-900 font-sans selection:bg-purple-200">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-18 gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition border border-slate-200"
              title={d.isAr ? 'الرجوع' : 'Retour'}
            >
              <ArrowLeft className={`w-5 h-5 ${d.isAr ? 'rotate-180' : ''}`} />
            </a>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {d.isAr ? 'لوحة المتابعة والنتائج الشهرية' : 'Tableau de Bord & Bilan Mensuel'}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  <TrendingUp className="w-3 h-3" />
                  {d.isAr ? 'تحليل شامل' : 'Analytics'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                {d.isAr ? 'متابعة تفصيلية لحركة المخزون والمبيعات لكل شهر ولكل منتج (152 و 124)' : 'Suivi mensuel par produit (152 & 124)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => d.setLang(d.isAr ? 'fr' : 'ar')}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
            >
              {d.isAr ? 'Français' : 'العربية'}
            </button>
            <button
              onClick={d.loadData}
              disabled={d.loading}
              className="p-2 sm:px-3 sm:py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${d.loading ? 'animate-spin text-purple-600' : ''}`} />
              <span className="hidden sm:inline">{d.isAr ? 'تحديث' : 'Actualiser'}</span>
            </button>
            <button
              onClick={d.handleExportCSV}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{d.isAr ? 'تصدير Excel / CSV' : 'Export CSV'}</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {d.error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {d.error}
          </div>
        )}

        <MonthlyKpiCards isAr={d.isAr} totals={d.totals} sortiesCount={d.sortiesCount} />

        <MonthlyFilterBar
          isAr={d.isAr}
          lang={d.lang}
          months={d.months}
          selectedMonth={d.selectedMonth}
          selectedProduct={d.selectedProduct}
          onSelectMonth={d.setSelectedMonth}
          onSelectProduct={d.setSelectedProduct}
          totalCount={d.filteredRows.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <MonthlyBarChart isAr={d.isAr} data={d.monthlyChartData} />
          </div>
          <div>
            <MonthlyDonutChart isAr={d.isAr} data={d.distributionData} totalSortie={d.totals.sortie} />
          </div>
        </div>

        <ProductMatrix
          isAr={d.isAr}
          allRows={d.allRows}
          selectedMonth={d.selectedMonth}
          selectedProduct={d.selectedProduct}
          onSelectProduct={d.setSelectedProduct}
        />

        <MonthlyLedgerTable
          isAr={d.isAr}
          lang={d.lang}
          loading={d.loading}
          rows={d.filteredRows}
          totals={d.totals}
          onExportCSV={d.handleExportCSV}
        />

        <div className="text-xs text-slate-500 text-center flex items-center justify-center gap-2 py-3">
          <TrendingUp className="w-4 h-4 text-purple-600 shrink-0" />
          <span>
            {d.isAr
              ? 'تُحسب المداخيل لكل منتج تناسبياً بناءً على كميته داخل كل وصل بيع.'
              : 'Revenus ventilés proportionnellement à la quantité dans chaque bon de vente.'}
          </span>
        </div>
      </main>
    </div>
  );
}
