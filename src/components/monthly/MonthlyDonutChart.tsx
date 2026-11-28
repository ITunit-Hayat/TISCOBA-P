import React from 'react';
import { PieChart } from 'lucide-react';
import { fmt } from './types';

export interface ProductDistItem {
  key: string;
  code: string;
  color: string;
  val: number;
  percent: number;
}

interface DonutProps {
  isAr: boolean;
  data: ProductDistItem[];
  totalSortie: number;
}

export const MonthlyDonutChart: React.FC<DonutProps> = ({ isAr, data, totalSortie }) => {
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-purple-600" />
          {isAr ? 'توزيع المبيعات حسب الصنف' : 'Répartition des Ventes'}
        </h3>
        <p className="text-[11px] text-slate-500 font-medium">{isAr ? 'نسبة كل صنف من إجمالي المبيعات' : 'Part de chaque produit'}</p>
      </div>

      <div className="relative flex items-center justify-center py-2">
        <svg viewBox="0 0 160 160" className="w-32 h-32 transform -rotate-90">
          <circle cx="80" cy="80" r="58" fill="none" stroke="#f1f5f9" strokeWidth="22" />
          {(() => {
            let acc = 0;
            const circum = 2 * Math.PI * 58;
            return data.map((item) => {
              const dash = `${(item.percent / 100) * circum} ${circum}`;
              const offset = -((acc / 100) * circum);
              acc += item.percent;
              return (
                <circle
                  key={item.key}
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="22"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                />
              );
            });
          })()}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[9px] font-bold text-slate-400 uppercase">{isAr ? 'المجموع' : 'Total'}</span>
          <span className="text-sm font-black text-slate-900 font-mono leading-none">{fmt(totalSortie)}</span>
          <span className="text-[9px] font-bold text-slate-500">{isAr ? 'م' : 'm'}</span>
        </div>
      </div>

      <div className="space-y-1 mt-1 max-h-36 overflow-y-auto pe-1">
        {data.map((item) => (
          <div key={item.key} className="flex items-center justify-between text-xs py-0.5 border-b border-slate-100 last:border-none">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="font-bold text-slate-800">{item.code}</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-500 text-[11px]">{fmt(item.val)} m</span>
              <span className="font-bold text-slate-900 text-[11px] px-1 rounded-md bg-slate-100">{item.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
