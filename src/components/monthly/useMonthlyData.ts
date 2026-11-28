import { useEffect, useMemo, useState } from 'react';
import { readInventory } from '../../services/googleSheetsApi';
import { EntreeItem, SortieItem } from '../../types/stock';
import { fmt, Lang, MonthDetailRow, monthLabel, monthOf, PRODUCTS_LIST, round2 } from './types';
import { ChartItem } from './MonthlyBarChart';
import { ProductDistItem } from './MonthlyDonutChart';

export function useMonthlyData() {
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem('lang') as Lang) || 'ar'; } catch { return 'ar'; }
  });
  useEffect(() => { try { localStorage.setItem('lang', lang); } catch {} }, [lang]);

  const [entrees, setEntrees] = useState<EntreeItem[]>([]);
  const [sorties, setSorties] = useState<SortieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const isAr = lang === 'ar';

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const data = await readInventory();
      setEntrees(Array.isArray(data.entrees) ? data.entrees : []);
      setSorties(Array.isArray(data.sorties) ? data.sorties : []);
    } catch (err: any) {
      setError(err?.message || (isAr ? 'تعذر تحميل البيانات' : 'Erreur de chargement'));
    } finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  const months = useMemo(() => {
    const s = new Set<string>();
    entrees.forEach(e => { if (e.date) s.add(monthOf(e.date)); });
    sorties.forEach(x => { if (x.date) s.add(monthOf(x.date)); });
    return Array.from(s).filter(Boolean).sort().reverse();
  }, [entrees, sorties]);

  const allRows = useMemo(() => {
    const map = new Map<string, MonthDetailRow>();
    const k = (m: string, p: string) => `${m}|${p}`;
    months.forEach(m => PRODUCTS_LIST.forEach(p => map.set(k(m, p.key), { month: m, productKey: p.key, product: p, entree: 0, sortie: 0, balance: 0, revenue: 0, rate: 0 })));

    entrees.forEach(e => {
      const m = monthOf(e.date); if (!m) return;
      PRODUCTS_LIST.forEach(p => {
        const q = Number((e as any)[p.key]) || 0;
        if (q > 0) { const r = map.get(k(m, p.key)); if (r) { r.entree += q; r.balance += q; } }
      });
    });

    sorties.forEach(s => {
      const m = monthOf(s.date); if (!m) return;
      PRODUCTS_LIST.forEach(p => {
        const q = Number((s as any)[p.key]) || 0;
        if (q > 0) { const r = map.get(k(m, p.key)); if (r) { r.sortie += q; r.balance -= q; } }
      });
      const totQ = PRODUCTS_LIST.reduce((a, p) => a + (Number((s as any)[p.key]) || 0), 0);
      const mont = Number(s.montant) || 0;
      if (totQ > 0 && mont > 0) {
        PRODUCTS_LIST.forEach(p => {
          const q = Number((s as any)[p.key]) || 0;
          if (q > 0) { const r = map.get(k(m, p.key)); if (r) r.revenue += mont * (q / totQ); }
        });
      }
    });

    map.forEach(r => { r.rate = r.entree > 0 ? Math.min(100, Math.round((r.sortie / r.entree) * 100)) : 0; });
    return Array.from(map.values()).filter(r => r.entree > 0 || r.sortie > 0).sort((a, b) => b.month.localeCompare(a.month) || a.product.code.localeCompare(b.product.code));
  }, [months, entrees, sorties]);

  const filteredRows = useMemo(() => allRows.filter(r => (selectedProduct === 'all' || r.productKey === selectedProduct) && (selectedMonth === 'all' || r.month === selectedMonth)), [allRows, selectedProduct, selectedMonth]);

  const totals = useMemo(() => {
    const t = { entree: 0, sortie: 0, balance: 0, revenue: 0 };
    filteredRows.forEach(r => { t.entree += r.entree; t.sortie += r.sortie; t.revenue += r.revenue; });
    t.balance = t.entree - t.sortie;
    return t;
  }, [filteredRows]);

  const monthlyChartData: ChartItem[] = useMemo(() => [...months].reverse().slice(-12).map(m => {
    const mRows = allRows.filter(r => r.month === m && (selectedProduct === 'all' || r.productKey === selectedProduct));
    return { month: m, label: monthLabel(m, lang), inVal: round2(mRows.reduce((a, r) => a + r.entree, 0)), outVal: round2(mRows.reduce((a, r) => a + r.sortie, 0)), revVal: round2(mRows.reduce((a, r) => a + r.revenue, 0)) };
  }), [months, allRows, selectedProduct, lang]);

  const distributionData: ProductDistItem[] = useMemo(() => {
    const tRows = selectedMonth === 'all' ? allRows : allRows.filter(r => r.month === selectedMonth);
    const sum = tRows.reduce((a, r) => a + r.sortie, 0) || 1;
    return PRODUCTS_LIST.map(p => {
      const val = tRows.filter(r => r.productKey === p.key).reduce((a, r) => a + r.sortie, 0);
      return { key: p.key, code: p.code, color: p.color, val: round2(val), percent: Math.round((val / sum) * 100) };
    }).filter(p => p.val > 0).sort((a, b) => b.val - a.val);
  }, [allRows, selectedMonth]);

  const handleExportCSV = () => {
    const h = isAr ? ['الشهر','كود المنتج','الاسم','وارد','صادر','الرصيد','المداخيل'] : ['Mois','Code','Nom','Entree','Sortie','Solde','Revenu'];
    const lines = [h.join(',')];
    filteredRows.forEach(r => lines.push([`"${monthLabel(r.month, lang)}"`,`"${r.product.code}"`,`"${isAr ? r.product.nameAr : r.product.nameFr}"`,fmt(r.entree),fmt(r.sortie),fmt(r.balance),round2(r.revenue).toFixed(2)].join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rapport-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return { lang, setLang, isAr, loading, error, loadData, months, allRows, filteredRows, totals, sortiesCount: sorties.length, selectedProduct, setSelectedProduct, selectedMonth, setSelectedMonth, monthlyChartData, distributionData, handleExportCSV };
}
