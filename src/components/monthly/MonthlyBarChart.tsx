import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { fmt, round2 } from './types';

export interface ChartItem {
  month: string;
  label: string;
  inVal: number;
  outVal: number;
  revVal: number;
}

interface BarProps {
  isAr: boolean;
  data: ChartItem[];
}

export const MonthlyBarChart: React.FC<BarProps> = ({ isAr, data }) => {
  const [metric, setMetric] = useState<'volume' | 'revenue'>('volume');
  const maxVal = Math.max(1, ...data.map((d) => (metric === 'volume' ? Math.max(d.inVal, d.outVal) : d.revVal)));

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            {isAr ? 'المخطط البياني للحركة الشهرية' : 'Évolution Mensuelle'}
          </h3>
          <p className="text-[11px] text-slate-500 font-medium">
            {isAr ? 'مقارنة الوارد والصادر بالمتر شهراً بشهر' : 'Comparatif entrées et sorties en mètres'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setMetric('volume')}
            className={`px-2.5 py-1 rounded-lg transition ${metric === 'volume' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600'}`}
          >
            {isAr ? 'الكمية (م)' : 'Volume (m)'}
          </button>
          <button
            onClick={() => setMetric('revenue')}
            className={`px-2.5 py-1 rounded-lg transition ${metric === 'revenue' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600'}`}
          >
            {isAr ? 'المداخيل (دج)' : 'Revenu (DZD)'}
          </button>
        </div>
      </div>

      <div className="pt-2 pb-1">
        {data.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-medium">
            {isAr ? 'لا توجد بيانات' : 'Aucune donnée'}
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-2 h-44 border-b border-slate-200 pb-2 px-1">
              {data.map((d) => {
                const inH = Math.max(4, Math.round((d.inVal / maxVal) * 140));
                const outH = Math.max(4, Math.round((d.outVal / maxVal) * 140));
                const revH = Math.max(4, Math.round((d.revVal / maxVal) * 140));
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group relative">
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-10 z-20 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap shadow-lg">
                      <span className="font-bold">{d.label}: </span>
                      {metric === 'volume' ? <span>+{d.inVal}m / -{d.outVal}m</span> : <span>{round2(d.revVal).toLocaleString()} DZD</span>}
                    </div>
                    {metric === 'volume' ? (
                      <div className="w-full flex items-end justify-center gap-1 h-full">
                        <div style={{ height: `${inH}px` }} className="w-1/2 max-w-[16px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md hover:brightness-110" title={`In: ${d.inVal}m`} />
                        <div style={{ height: `${outH}px` }} className="w-1/2 max-w-[16px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md hover:brightness-110" title={`Out: ${d.outVal}m`} />
                      </div>
                    ) : (
                      <div style={{ height: `${revH}px` }} className="w-full max-w-[24px] bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-md hover:brightness-110" title={`${round2(d.revVal).toLocaleString()} DZD`} />
                    )}
                    <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center mt-1">{d.label.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 pt-2 text-xs font-bold text-slate-600">
              {metric === 'volume' ? (
                <>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /><span>{isAr ? 'الوارد (متر)' : 'Entrées (m)'}</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /><span>{isAr ? 'الصادر (متر)' : 'Sorties (m)'}</span></div>
                </>
              ) : (
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500" /><span>{isAr ? 'المداخيل (دج)' : 'Revenus (DZD)'}</span></div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
