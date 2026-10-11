import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet,
  CheckCircle2, 
} from 'lucide-react';
import { EntreeItem, SortieItem } from './types/stock';
import { InventoryDashboard } from './components/InventoryDashboard';
import { mutateInventory, readInventory } from './services/googleSheetsApi';

type InventorySheetMutation =
  | { action: 'add'; sheet: 'entree'; item: EntreeItem }
  | { action: 'update'; sheet: 'entree'; item: EntreeItem }
  | { action: 'delete'; sheet: 'entree'; id: string }
  | { action: 'add'; sheet: 'sortie'; item: SortieItem }
  | { action: 'update'; sheet: 'sortie'; item: SortieItem }
  | { action: 'delete'; sheet: 'sortie'; id: string };

export default function App() {
  const [lang, setLang] = useState<'ar' | 'fr'>('ar');

  // Database status indicators
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSyncToast, setAutoSyncToast] = useState<string | null>(null);
  const lastSavedHash = useRef('');

  // Keep cached records in sync across browser tabs.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stock_entrees_v2' && e.newValue) {
        try {
          setEntrees(JSON.parse(e.newValue));
        } catch {}
      }
      if (e.key === 'stock_sorties_v2' && e.newValue) {
        try {
          setSorties(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Entrees & Sorties state
  const [entrees, setEntrees] = useState<EntreeItem[]>(() => {
    try {
      const saved = localStorage.getItem('stock_entrees_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sorties, setSorties] = useState<SortieItem[]>(() => {
    try {
      const saved = localStorage.getItem('stock_sorties_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('stock_entrees_v2', JSON.stringify(entrees));
    } catch {}
  }, [entrees]);

  useEffect(() => {
    try {
      localStorage.setItem('stock_sorties_v2', JSON.stringify(sorties));
    } catch {}
  }, [sorties]);

  // Compute live stock
  const currentStock = useMemo(() => {
    const listE = Array.isArray(entrees) ? entrees : [];
    const listS = Array.isArray(sorties) ? sorties : [];

    const totalIn = {
      qty152Vert: listE.reduce((sum, e) => sum + (Number(e?.qty152Vert) || 0), 0),
      qty152Bleu: listE.reduce((sum, e) => sum + (Number(e?.qty152Bleu) || 0), 0),
      qty152Noir: listE.reduce((sum, e) => sum + (Number(e?.qty152Noir) || 0), 0),
      qty152KS: listE.reduce((sum, e) => sum + (Number(e?.qty152KS) || 0), 0),
      qty152KF: listE.reduce((sum, e) => sum + (Number(e?.qty152KF) || 0), 0),
      qty152Gris: listE.reduce((sum, e) => sum + (Number(e?.qty152Gris) || 0), 0),
      qty124Vert: listE.reduce((sum, e) => sum + (Number(e?.qty124Vert) || 0), 0),
      qty124Bleu: listE.reduce((sum, e) => sum + (Number(e?.qty124Bleu) || 0), 0),
    };

    const totalOut = {
      qty152Vert: listS.reduce((sum, s) => sum + (Number(s?.qty152Vert) || 0), 0),
      qty152Bleu: listS.reduce((sum, s) => sum + (Number(s?.qty152Bleu) || 0), 0),
      qty152Noir: listS.reduce((sum, s) => sum + (Number(s?.qty152Noir) || 0), 0),
      qty152KS: listS.reduce((sum, s) => sum + (Number(s?.qty152KS) || 0), 0),
      qty152KF: listS.reduce((sum, s) => sum + (Number(s?.qty152KF) || 0), 0),
      qty152Gris: listS.reduce((sum, s) => sum + (Number(s?.qty152Gris) || 0), 0),
      qty124Vert: listS.reduce((sum, s) => sum + (Number(s?.qty124Vert) || 0), 0),
      qty124Bleu: listS.reduce((sum, s) => sum + (Number(s?.qty124Bleu) || 0), 0),
    };

    return {
      qty152Vert: Math.max(0, totalIn.qty152Vert - totalOut.qty152Vert),
      qty152Bleu: Math.max(0, totalIn.qty152Bleu - totalOut.qty152Bleu),
      qty152Noir: Math.max(0, totalIn.qty152Noir - totalOut.qty152Noir),
      qty152KS: Math.max(0, totalIn.qty152KS - totalOut.qty152KS),
      qty152KF: Math.max(0, totalIn.qty152KF - totalOut.qty152KF),
      qty152Gris: Math.max(0, totalIn.qty152Gris - totalOut.qty152Gris),
      qty124Vert: Math.max(0, totalIn.qty124Vert - totalOut.qty124Vert),
      qty124Bleu: Math.max(0, totalIn.qty124Bleu - totalOut.qty124Bleu),
    };
  }, [entrees, sorties]);

  // Load the shared inventory for every visitor.
  useEffect(() => {
    let isSubscribed = true;
    const fetchFromGoogleSheets = async () => {
      setIsSyncingCloud(true);
      try {
        const { entrees: sheetE, sorties: sheetS } = await readInventory();
        if (!isSubscribed) return;

        setEntrees(sheetE);
        setSorties(sheetS);
        try {
          localStorage.setItem('stock_entrees_v2', JSON.stringify(sheetE));
          localStorage.setItem('stock_sorties_v2', JSON.stringify(sheetS));
        } catch {}
        setLastSyncTime(new Date());
        lastSavedHash.current = `${sheetE.length}_${sheetS.length}_${JSON.stringify(sheetE[0] || {})}_${JSON.stringify(sheetS[0] || {})}`;
        if (sheetE.length > 0 || sheetS.length > 0) {
          setAutoSyncToast(
            lang === 'ar'
              ? `✓ تم تحميل Google Sheets (${sheetE.length + sheetS.length} عملية)`
              : `✓ Google Sheets chargé (${sheetE.length + sheetS.length} lignes)`
          );
          setTimeout(() => setAutoSyncToast(null), 3000);
        }
      } catch (err: any) {
        console.error('Initial load from Google Sheets:', err);
        if (isSubscribed) {
          setAutoSyncToast(err?.message || 'تعذر الاتصال بجدول Google Sheets');
          setTimeout(() => setAutoSyncToast(null), 5000);
        }
      } finally {
        if (isSubscribed) setIsSyncingCloud(false);
      }
    };

    fetchFromGoogleSheets();
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Apply an edit or deletion to only its matching row; never rewrite a whole sheet.
  const handleUpdateEntreesAndSorties = async (
    newE: EntreeItem[],
    newS: SortieItem[],
    mutation: InventorySheetMutation
  ) => {
    setEntrees(newE);
    setSorties(newS);

    setIsSyncingCloud(true);
    try {
      const latest = await mutateInventory(null, mutation);
      setEntrees(latest.entrees);
      setSorties(latest.sorties);

      lastSavedHash.current = `${newE.length}_${newS.length}_${JSON.stringify(newE[0] || {})}_${JSON.stringify(newS[0] || {})}`;
      setLastSyncTime(new Date());
      setAutoSyncToast(
        lang === 'ar'
          ? '💾 تم حفظ التغيير في Google Sheets ✓'
          : '💾 Modification enregistrée dans Google Sheets ✓'
      );
      setTimeout(() => setAutoSyncToast(null), 2500);
    } catch (err: any) {
      setEntrees(entrees);
      setSorties(sorties);
      console.error('Google Sheets row update failed:', err);
      setAutoSyncToast(err.message || 'تعذر حفظ التغيير في Google Sheets');
      setTimeout(() => setAutoSyncToast(null), 4000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Manual trigger if user wants instant sync right now
  const handleManualSyncNow = async () => {
    setIsSyncingCloud(true);
    try {
      const data = await readInventory();
      setEntrees(data.entrees);
      setSorties(data.sorties);
      localStorage.setItem('stock_entrees_v2', JSON.stringify(data.entrees));
      localStorage.setItem('stock_sorties_v2', JSON.stringify(data.sorties));
      lastSavedHash.current = `${data.entrees.length}_${data.sorties.length}_${JSON.stringify(data.entrees[0] || {})}_${JSON.stringify(data.sorties[0] || {})}`;
      setLastSyncTime(new Date());
      setAutoSyncToast(
        lang === 'ar'
          ? `✅ تم تحديث ${data.entrees.length + data.sorties.length} عملية من Google Sheets.`
          : `✅ ${data.entrees.length + data.sorties.length} lignes actualisées depuis Google Sheets.`
      );
      setTimeout(() => setAutoSyncToast(null), 3000);
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      setAutoSyncToast(err.message || 'خطأ أثناء الاتصال بقاعدة البيانات');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Handlers for adding/editing/deleting rows
  const handleAddEntree = async (newItem: EntreeItem) => {
    setEntrees((prev) => [newItem, ...prev]);
    setIsSyncingCloud(true);
    try {
      const latest = await mutateInventory(null, {
        action: 'add', sheet: 'entree', item: newItem,
      });
      setEntrees(latest.entrees);
      setSorties(latest.sorties);
      setLastSyncTime(new Date());
      setAutoSyncToast(lang === 'ar' ? '✅ تم حفظ الاستلام في Google Sheets.' : '✅ Entrée enregistrée dans Google Sheets.');
      setTimeout(() => setAutoSyncToast(null), 3000);
    } catch (err: any) {
      setEntrees(entrees);
      setSorties(sorties);
      console.error('Append entree failed:', err);
      setAutoSyncToast(err.message || 'تعذر حفظ الاستلام في Google Sheets');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleEditEntree = (updatedItem: EntreeItem) => {
    const nextEntrees = entrees.map((e) => (e.id === updatedItem.id ? updatedItem : e));
    handleUpdateEntreesAndSorties(nextEntrees, sorties, { action: 'update', sheet: 'entree', item: updatedItem });
  };

  const handleDeleteEntree = (id: string) => {
    const nextEntrees = entrees.filter((e) => e.id !== id);
    handleUpdateEntreesAndSorties(nextEntrees, sorties, { action: 'delete', sheet: 'entree', id });
  };

  const handleAddSortie = async (newItem: SortieItem) => {
    setSorties((prev) => [newItem, ...prev]);
    setIsSyncingCloud(true);
    try {
      const latest = await mutateInventory(null, {
        action: 'add', sheet: 'sortie', item: newItem,
      });
      setEntrees(latest.entrees);
      setSorties(latest.sorties);
      setLastSyncTime(new Date());
      setAutoSyncToast(lang === 'ar' ? '✅ تم حفظ البيع في Google Sheets.' : '✅ Vente enregistrée dans Google Sheets.');
      setTimeout(() => setAutoSyncToast(null), 3000);
    } catch (err: any) {
      setEntrees(entrees);
      setSorties(sorties);
      console.error('Append sortie failed:', err);
      setAutoSyncToast(err.message || 'تعذر حفظ البيع في Google Sheets');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleEditSortie = (updatedItem: SortieItem) => {
    const nextSorties = sorties.map((s) => (s.id === updatedItem.id ? updatedItem : s));
    handleUpdateEntreesAndSorties(entrees, nextSorties, { action: 'update', sheet: 'sortie', item: updatedItem });
  };

  const handleDeleteSortie = (id: string) => {
    const nextSorties = sorties.filter((s) => s.id !== id);
    handleUpdateEntreesAndSorties(entrees, nextSorties, { action: 'delete', sheet: 'sortie', id });
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-neutral-100/70 text-neutral-900 font-sans flex flex-col selection:bg-purple-200 selection:text-purple-900"
    >
      {/* Top Header - Clean, Uncluttered, Accessible */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                  {lang === 'ar' ? 'إدارة المخزون والمبيعات' : 'Gestion de Stock & Ventes'}
                </h1>
                <p className="text-[11px] text-neutral-500 font-medium leading-tight">
                  {lang === 'ar'
                    ? '152 & 124 • وحدة قياس المخزون والمبيعات: بالمتر (م)'
                    : '152 & 124 • Unité de mesure : en mètres (m)'}
                </p>
              </div>
            </div>

            {/* Database status and language */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'Google Sheets' : 'Google Sheets'}
              </span>
              <span className="hidden sm:inline-flex items-center rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                {lang === 'ar' ? 'لوحة عامة' : 'Tableau public'}
              </span>

              {/* Language Switch */}
              <button
                onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')}
                className="px-2.5 py-1.5 text-xs font-bold border border-neutral-200 rounded-xl text-neutral-700 hover:bg-neutral-50 transition"
                title="تغيير اللغة"
              >
                {lang === 'ar' ? 'FR' : 'عربي'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating database notification */}
      {autoSyncToast && (
        <div className="fixed top-20 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-full shadow-lg text-xs font-bold border border-neutral-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{autoSyncToast}</span>
          </div>
        </div>
      )}

      {/* Main Container - Clear, Simple, All-in-One Dashboard */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <InventoryDashboard
          entrees={entrees}
          sorties={sorties}
          currentStock={currentStock}
          onUpdateEntreesAndSorties={handleUpdateEntreesAndSorties}
          onAddEntree={handleAddEntree}
          onAddSortie={handleAddSortie}
          isAutoSyncing={isSyncingCloud}
          lastSyncTime={lastSyncTime}
          onManualSyncNow={handleManualSyncNow}
          lang={lang}
        />
      </main>

      {/* Simple Footer */}
      <footer className="bg-white border-t border-neutral-200/80 py-4 px-4 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>{lang === 'ar' ? 'نظام إدارة المخزون بالمتر (م) • ' : 'Gestion de Stock en mètres (m) • '}</span>
            <span className="font-semibold text-neutral-700">152 & 124</span>
          </div>
          <span className="font-medium text-emerald-700">
            {lang === 'ar' ? 'الحفظ التلقائي: Google Sheets' : 'Enregistrement : Google Sheets'}
          </span>
        </div>
      </footer>
    </div>
  );
}
