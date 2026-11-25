import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Download, Package, RefreshCw, TrendingUp } from 'lucide-react';
import { readInventory } from '../services/googleSheetsApi';
import { EntreeItem, SortieItem } from '../types/stock';

type Lang = 'ar' | 'fr';

const PRODUCT_KEYS = [
  'qty152Vert', 'qty152Bleu', 'qty152Noir', 'qty152KS',
  'qty152KF', 'qty152Gris', 'qty124Vert', 'qty124Bleu',
] as const;

const PRODUCT_LABELS: Record<string, string> = {
  qty152Vert: '152 Vert', qty152Bleu: '152 Bleu', qty152Noir: '152 Noir',
  qty152KS: '152 K.S', qty152KF: '152 K.F', qty152Gris: '152 Gris',
  qty124Vert: '124 Vert', qty124Bleu: '124 Bleu',
};

function round2(v: number): number { return Math.round((v || 0) * 100) / 100; }
function fmt(v: number): string { const r = round2(v); return r === 0 ? '0.00' : r.toFixed(2); }
function monthOf(date: string): string { return (date || '').slice(0, 7); }
function monthLabel(m: string, lang: Lang): string {
  if (!m) return '';
  const [y, mm] = m.split('-');
  const names = lang === 'ar'
    ? ['ظٹظ†ط§ظٹط±','ظپط¨ط±ط§ظٹط±','ظ…ط§ط±ط³','ط£ط¨ط±ظٹظ„','ظ…ط§ظٹظˆ','ظٹظˆظ†ظٹظˆ','ظٹظˆظ„ظٹظˆ','ط£ط؛ط³ط·ط³','ط³ط¨طھظ…ط¨ط±','ط£ظƒطھظˆط¨ط±','ظ†ظˆظپظ…ط¨ط±','ط¯ظٹط³ظ…ط¨ط±']
    : ['Janvier','Fأ©vrier','Mars','Avril','Mai','Juin','Juillet','Aoأ»t','Septembre','Octobre','Novembre','Dأ©cembre'];
  const idx = parseInt(mm, 10) - 1;
  return `${names[idx] ?? mm} ${y}`;
}

interface MonthRow {
  month: string; productKey: string; productLabel: string;
  entree: number; sortie: number; balance: number; revenue: number; salesCount: number;
}

export default function MonthlyReportPage() {
  const [lang, setLang] = useState<Lang>('ar');
  const [entrees, setEntrees] = useState<EntreeItem[]>([]);
  const [sorties, setSorties] = useState<SortieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const isAr = lang === 'ar';

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await readInventory();
      setEntrees(Array.isArray(data.entrees) ? data.entrees : []);
      setSorties(Array.isArray(data.sorties) ? data.sorties : []);
    } catch (e: any) {
      setError(e?.message || (isAr ? 'طھط¹ط°ط± طھط­ظ…ظٹظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ' : 'Impossible de charger les donnأ©es'));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const months = useMemo(() => {
    const set = new Set<string>();
    entrees.forEach((e) => set.add(monthOf(e.date)));
    sorties.forEach((s) => set.add(monthOf(s.date)));
    return Array.from(set).filter(Boolean).sort().reverse();
  }, [entrees, sorties]);

  const rows: MonthRow[] = useMemo(() => {
    const map = new Map<string, MonthRow>();
    const key = (m: string, p: string) => `${m}|${p}`;
    for (const p of PRODUCT_KEYS) for (const m of months) map.set(key(m, p), { month: m, productKey: p, productLabel: PRODUCT_LABELS[p], entree: 0, sortie: 0, balance: 0, revenue: 0, salesCount: 0 });
    entrees.forEach((e) => {
      const m = monthOf(e.date);
      for (const p of PRODUCT_KEYS) {
        const q = Number((e as any)[p]) || 0;
        if (q <= 0) continue;
        const r = map.get(key(m, p));
        if (r) { r.entree += q; r.balance += q; }
      }
    });
    sorties.forEach((s) => {
      const m = monthOf(s.date);
      for (const p of PRODUCT_KEYS) {
        const q = Number((s as any)[p]) || 0;
        if (q <= 0) continue;
        const r = map.get(key(m, p));
        if (r) { r.sortie += q; r.balance -= q; r.salesCount += 1; }
      }
    });
    const revenueMap = new Map<string, number>();
    sorties.forEach((s) => {
      const m = monthOf(s.date);
      const saleQty = PRODUCT_KEYS.reduce((a, p) => a + (Number((s as any)[p]) || 0), 0);
      const montant = Number(s.montant) || 0;
      for (const p of PRODUCT_KEYS) {
        const q = Number((s as any)[p]) || 0;
        if (q <= 0 || saleQty <= 0) continue;
        const share = montant * (q / saleQty);
        const k = key(m, p);
        revenueMap.set(k, (revenueMap.get(k) || 0) + share);
      }
    });
    revenueMap.forEach((v, k) => { const r = map.get(k); if (r) r.revenue = v; });
    let result = Array.from(map.values()).filter((r) => r.entree > 0 || r.sortie > 0);
    if (selectedProduct !== 'all') result = result.filter((r) => r.productKey === selectedProduct);
    if (selectedMonth !== 'all') result = result.filter((r) => r.month === selectedMonth);
    result.sort((a, b) => b.month.localeCompare(a.month) || a.productLabel.localeCompare(b.productLabel));
    return result;
  }, [entrees, sorties, months, selectedProduct, selectedMonth]);

  const totals = useMemo(() => {
    const t = { entree: 0, sortie: 0, revenue: 0 };
    rows.forEach((r) => { t.entree += r.entree; t.sortie += r.sortie; t.revenue += r.revenue; });
    return t;
  }, [rows]);

  const exportCSV = () => {
    const header = isAr ? ['ط§ظ„ط´ظ‡ط±','ط§ظ„ظ…ظ†طھط¬','ظˆط§ط±ط¯ (ظ…)','طµط§ط¯ط± (ظ…)','ط§ظ„ط±طµظٹط¯ (ظ…)','ط§ظ„ظ…ط¯ط§ط®ظٹظ„ (ط¯ط¬)'] : ['Mois','Produit','Entrأ©e (m)','Sortie (m)','Solde (m)','Revenu (DZD)'];
    const lines = [header.join(',')];
    rows.forEach((r) => { lines.push([monthLabel(r.month, lang), r.productLabel, fmt(r.entree), fmt(r.sortie), fmt(r.balance), round2(r.revenue).toFixed(2)].join(',')); });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rapport-mensuel-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-neutral-100/70 text-neutral-900 font-sans">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="w-9 h-9 rounded-xl bg-neutral-200 text-neutral-700 flex items-center justify-center hover:bg-neutral-300 transition" title={isAr ? 'ط±ط¬ظˆط¹' : 'Retour'}>
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                {isAr ? 'طھظ‚ط±ظٹط± ط´ظ‡ط±ظٹ â€” ظ†طھط§ط¦ط¬ ظˆطھظپط§طµظٹظ„ ظƒظ„ ظ…ظ†طھط¬' : 'Rapport mensuel â€” rأ©sultats et dأ©tails par produit'}
              </h1>
              <p className="text-[11px] text-neutral-500 font-medium leading-tight">
                {isAr ? '8 ظ…ظ†طھط¬ط§طھ â€¢ 152 & 124' : '8 produits â€¢ 152 & 124'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(isAr ? 'fr' : 'ar')} className="px-2.5 py-1.5 text-xs font-bold border border-neutral-200 rounded-xl text-neutral-700 hover:bg-neutral-50 transition">
              {isAr ? 'FR' : 'ط¹ط±ط¨ظٹ'}
            </button>
            <button onClick={load} disabled={loading} className="px-2.5 py-1.5 text-xs font-bold border border-neutral-200 rounded-xl text-neutral-700 hover:bg-neutral-50 transition flex items-center gap-1 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {isAr ? 'طھط­ط¯ظٹط«' : 'Actualiser'}
            </button>
            <button onClick={exportCSV} className="px-2.5 py-1.5 text-xs font-bold border border-emerald-200 bg-emerald-50 rounded-xl text-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">{isAr ? 'المنتج' : 'Produit'}</label>
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-medium">
              <option value="all">{isAr ? 'جميع المنتجات' : 'Tous les produits'}</option>
              {PRODUCT_KEYS.map((p) => <option key={p} value={p}>{PRODUCT_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">{isAr ? 'الشهر' : 'Mois'}</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-medium">
              <option value="all">{isAr ? 'جميع الأشهر' : 'Tous les mois'}</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m, lang)}</option>)}
            </select>
          </div>
          <div className="flex-1" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <div className="text-[10px] font-bold text-emerald-800">{isAr ? 'وارد' : 'Entrée'}</div>
              <div className="text-sm font-black text-emerald-700 font-mono">{fmt(totals.entree)} m</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <div className="text-[10px] font-bold text-blue-800">{isAr ? 'صادر' : 'Sortie'}</div>
              <div className="text-sm font-black text-blue-700 font-mono">{fmt(totals.sortie)} m</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <div className="text-[10px] font-bold text-amber-800">{isAr ? 'مداخيل' : 'Revenu'}</div>
              <div className="text-sm font-black text-amber-900 font-mono">{round2(totals.revenue).toLocaleString()} دج</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="px-3 py-2.5 text-start font-bold">{isAr ? 'ط§ظ„ط´ظ‡ط±' : 'Mois'}</th>
                  <th className="px-3 py-2.5 text-start font-bold">{isAr ? 'ط§ظ„ظ…ظ†طھط¬' : 'Produit'}</th>
                  <th className="px-3 py-2.5 text-end font-bold">{isAr ? 'ظˆط§ط±ط¯ (ظ…)' : 'Entrأ©e (m)'}</th>
                  <th className="px-3 py-2.5 text-end font-bold">{isAr ? 'طµط§ط¯ط± (ظ…)' : 'Sortie (m)'}</th>
                  <th className="px-3 py-2.5 text-end font-bold">{isAr ? 'ط§ظ„ط±طµظٹط¯ (ظ…)' : 'Solde (m)'}</th>
                  <th className="px-3 py-2.5 text-end font-bold">{isAr ? 'ظ…ط¯ط§ط®ظٹظ„ (ط¯ط¬)' : 'Revenu (DZD)'}</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-neutral-500">{isAr ? 'ط¬ط§ط±ظچ ط§ظ„طھط­ظ…ظٹظ„...' : 'Chargement...'}</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-neutral-500">{isAr ? 'ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ' : 'Aucune donnأ©e'}</td></tr>}
                {rows.map((r, i) => (
                  <tr key={`${r.month}-${r.productKey}-${i}`} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-2 font-medium">{monthLabel(r.month, lang)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-neutral-400" />
                        {r.productLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-emerald-700">{fmt(r.entree)}</td>
                    <td className="px-3 py-2 text-end font-mono text-blue-700">{fmt(r.sortie)}</td>
                    <td className={`px-3 py-2 text-end font-mono font-bold ${round2(r.balance) < 0 ? 'text-red-600' : 'text-neutral-800'}`}>{fmt(r.balance)}</td>
                    <td className="px-3 py-2 text-end font-mono text-amber-900">{round2(r.revenue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-neutral-100 font-bold">
                  <tr>
                    <td colSpan={2} className="px-3 py-2.5">{isAr ? 'ط§ظ„ظ…ط¬ظ…ظˆط¹' : 'Total'}</td>
                    <td className="px-3 py-2.5 text-end font-mono text-emerald-700">{fmt(totals.entree)}</td>
                    <td className="px-3 py-2.5 text-end font-mono text-blue-700">{fmt(totals.sortie)}</td>
                    <td className="px-3 py-2.5 text-end font-mono">{fmt(totals.entree - totals.sortie)}</td>
                    <td className="px-3 py-2.5 text-end font-mono text-amber-900">{round2(totals.revenue).toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        <div className="text-xs text-neutral-500 text-center flex items-center justify-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          {isAr ? 'ط§ظ„ظ…ط¯ط§ط®ظٹظ„ ظ…ظˆط²ظ‘ط¹ط© طھظ†ط§ط³ط¨ظٹط§ظ‹ ط­ط³ط¨ ظƒظ…ظٹط© ظƒظ„ ظ…ظ†طھط¬ within ظƒظ„ ط¹ظ…ظ„ظٹط© ط¨ظٹط¹.' : 'Revenus rأ©partis proportionnellement أ  la quantitأ© de chaque produit par vente.'}
        </div>
      </main>
    </div>
  );
}
