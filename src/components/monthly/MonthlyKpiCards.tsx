import React from 'react';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Layers, Package, Wallet } from 'lucide-react';
import { fmt, round2 } from './types';

interface KpiProps {
  isAr: boolean;
  totals: {
    entree: number;
    sortie: number;
    balance: number;
    revenue: number;
  };
  sortiesCount: number;
}

export const MonthlyKpiCards: React.FC<KpiProps> = ({ isAr, totals, sortiesCount }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Entrées */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'الوارد الإجمالي' : 'Total Entrées'}</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight">
          {fmt(totals.entree)} <span className="text-xs font-bold text-slate-400 font-sans">{isAr ? 'م' : 'm'}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg w-fit">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{isAr ? 'استلام المخزون' : 'Stock reçu'}</span>
        </div>
      </div>

      {/* 2. Sorties */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-blue-100 shadow-xs relative overflow-hidden group hover:border-blue-300 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'الصادر والمبيعات' : 'Total Sorties'}</span>
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-3xl font-black text-blue-700 font-mono tracking-tight">
          {fmt(totals.sortie)} <span className="text-xs font-bold text-slate-400 font-sans">{isAr ? 'م' : 'm'}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-800 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg w-fit">
          <Package className="w-3.5 h-3.5" />
          <span>{isAr ? 'كميات مباعة' : 'Quantités vendues'}</span>
        </div>
      </div>

      {/* 3. Net Balance */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100 shadow-xs relative overflow-hidden group hover:border-purple-300 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'الرصيد الصافي' : 'Solde Net'}</span>
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className={`text-xl sm:text-3xl font-black font-mono tracking-tight ${totals.balance < 0 ? 'text-red-600' : 'text-purple-700'}`}>
          {fmt(totals.balance)} <span className="text-xs font-bold text-slate-400 font-sans">{isAr ? 'م' : 'm'}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-purple-800 font-semibold bg-purple-50 px-2.5 py-1 rounded-lg w-fit">
          <span>{totals.balance >= 0 ? (isAr ? '✅ رصيد إيجابي' : '✅ En stock') : (isAr ? '⚠️ عجز بالمخزون' : '⚠️ Déficitaire')}</span>
        </div>
      </div>

      {/* 4. Revenue */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-100 shadow-xs relative overflow-hidden group hover:border-amber-300 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500">{isAr ? 'إجمالي المداخيل' : 'Chiffre d’Affaires'}</span>
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-3xl font-black text-amber-900 font-mono tracking-tight">
          {round2(totals.revenue).toLocaleString()} <span className="text-xs font-bold text-amber-700 font-sans">{isAr ? 'دج' : 'DZD'}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-900 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg w-fit">
          <span>{isAr ? `${sortiesCount} عملية بيع مسجلة` : `${sortiesCount} ventes enregistrées`}</span>
        </div>
      </div>
    </div>
  );
};
