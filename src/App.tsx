import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Layers, 
  RotateCcw,
  Cloud,
  Trash2
} from 'lucide-react';
import { User } from 'firebase/auth';
import { EntreeItem, SortieItem } from './types/stock';
import { GoogleFormView } from './components/GoogleFormView';
import { LiveGoogleSheetsDirectView } from './components/LiveGoogleSheetsDirectView';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { initAuth, getAccessToken } from './services/googleAuth';
import { writeAllDataToGoogleSheet } from './services/googleDriveSheets';

export default function App() {
  const [lang, setLang] = useState<'ar' | 'fr'>('ar');
  const [activeTab, setActiveTab] = useState<'sheets' | 'form'>('form');
  const [formPage, setFormPage] = useState<1 | 2>(1);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // Google Drive & Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeSpreadsheet, setActiveSpreadsheet] = useState<{ id: string; url: string; title: string } | null>(() => {
    try {
      const saved = localStorage.getItem('stock_active_spreadsheet_v2');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    const saved = localStorage.getItem('stock_auto_sync_v2');
    return saved !== null ? saved === 'true' : true;
  });
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Local storage persistence for active spreadsheet & autoSync
  useEffect(() => {
    if (activeSpreadsheet) {
      localStorage.setItem('stock_active_spreadsheet_v2', JSON.stringify(activeSpreadsheet));
    } else {
      localStorage.removeItem('stock_active_spreadsheet_v2');
    }
  }, [activeSpreadsheet]);

  useEffect(() => {
    localStorage.setItem('stock_auto_sync_v2', String(autoSync));
  }, [autoSync]);

  // Init Auth on load
  useEffect(() => {
    let unsub: any = null;
    try {
      unsub = initAuth(
        (user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
        },
        () => {
          setCurrentUser(null);
          setAccessToken(null);
        }
      );
    } catch (err) {
      console.warn('initAuth error:', err);
    }
    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, []);

  // Empty initial data (starts completely empty ready for real entries)
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
      qty124Vert: listE.reduce((sum, e) => sum + (Number(e?.qty124Vert) || 0), 0),
      qty124Bleu: listE.reduce((sum, e) => sum + (Number(e?.qty124Bleu) || 0), 0),
    };

    const totalOut = {
      qty152Vert: listS.reduce((sum, s) => sum + (Number(s?.qty152Vert) || 0), 0),
      qty152Bleu: listS.reduce((sum, s) => sum + (Number(s?.qty152Bleu) || 0), 0),
      qty124Vert: listS.reduce((sum, s) => sum + (Number(s?.qty124Vert) || 0), 0),
      qty124Bleu: listS.reduce((sum, s) => sum + (Number(s?.qty124Bleu) || 0), 0),
    };

    return {
      qty152Vert: Math.max(0, totalIn.qty152Vert - totalOut.qty152Vert),
      qty152Bleu: Math.max(0, totalIn.qty152Bleu - totalOut.qty152Bleu),
      qty124Vert: Math.max(0, totalIn.qty124Vert - totalOut.qty124Vert),
      qty124Bleu: Math.max(0, totalIn.qty124Bleu - totalOut.qty124Bleu),
    };
  }, [entrees, sorties]);

  // Serialize writes so rapid successive edits cannot overwrite each other.
  const queueDriveSync = (nextEntrees: EntreeItem[], nextSorties: SortieItem[]) => {
    if (!autoSync || !activeSpreadsheet?.id) return;

    syncQueueRef.current = syncQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const token = accessToken || (await getAccessToken());
        if (!token) return;
        await writeAllDataToGoogleSheet(token, activeSpreadsheet.id, nextEntrees, nextSorties);
      })
      .catch((err) => {
        console.warn('Automatic sync to Google Sheets failed:', err);
      });
  };

  const updateInventory = (nextEntrees: EntreeItem[], nextSorties: SortieItem[]) => {
    setEntrees(nextEntrees);
    setSorties(nextSorties);
    queueDriveSync(nextEntrees, nextSorties);
  };

  // All add/edit/delete operations now use the same full-sync path.
  const handleAddEntree = async (item: Omit<EntreeItem, 'id'>) => {
    const newItem: EntreeItem = { ...item, id: `entree-${Date.now()}` };
    updateInventory([newItem, ...entrees], sorties);
  };

  const handleEditEntree = (updatedItem: EntreeItem) => {
    updateInventory(entrees.map((e) => (e.id === updatedItem.id ? updatedItem : e)), sorties);
  };

  const handleDeleteEntree = (id: string) => {
    updateInventory(entrees.filter((e) => e.id !== id), sorties);
  };

  const handleAddSortie = async (item: Omit<SortieItem, 'id'>) => {
    const newItem: SortieItem = { ...item, id: `sortie-${Date.now()}` };
    updateInventory(entrees, [newItem, ...sorties]);
  };

  const handleEditSortie = (updatedItem: SortieItem) => {
    updateInventory(entrees, sorties.map((s) => (s.id === updatedItem.id ? updatedItem : s)));
  };

  const handleDeleteSortie = (id: string) => {
    updateInventory(entrees, sorties.filter((s) => s.id !== id));
  };

  const handleClearAllData = () => {
    if (
      window.confirm(
        lang === 'ar'
          ? '⚠️ هل ترغب في إفراغ جميع بيانات الجداول وتصفير المخزون بالكامل؟'
          : 'Effacer toutes les données des tableaux ?'
      )
    ) {
      updateInventory([], []);
    }
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-neutral-100/70 text-neutral-900 font-sans flex flex-col selection:bg-purple-200 selection:text-purple-900"
    >
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-neutral-900">
                    {lang === 'ar' ? 'نظام المخزون وGoogle Sheets' : 'Stock & Google Sheets'}
                  </h1>
                  <span className="hidden sm:inline-block text-[10px] bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full">
                    استمارة صفحتين
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 hidden sm:block">
                  Feuille 1 Entrée • Feuille 2 Sortie • Feuille 3 Synthèse
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('sheets')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'sheets'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? '📋 جداول المخزون والمبيعات' : 'Tables de Stock'}</span>
                {activeSpreadsheet && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? '📝 استمارة Google Forms' : 'Google Forms'}</span>
              </button>
            </nav>

            {/* Right Tools: Google Drive & Language switch */}
            <div className="flex items-center gap-2">
              {/* Google Drive Account Pill */}
              <button
                onClick={() => setIsDriveModalOpen(true)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
                  currentUser
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700'
                }`}
                title={lang === 'ar' ? 'إدارة الاتصال بـ Google Drive' : 'Gérer la connexion Google Drive'}
              >
                <Cloud className={`w-3.5 h-3.5 ${currentUser ? 'text-emerald-600' : 'text-neutral-500'}`} />
                <span>
                  {currentUser
                    ? currentUser.displayName?.split(' ')[0] || (lang === 'ar' ? 'Drive متصل' : 'Drive connecté')
                    : (lang === 'ar' ? 'ربط Google Drive' : 'Lier Drive')}
                </span>
                {activeSpreadsheet && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="ملف Sheets متصل" />
                )}
              </button>

              {/* Language Switch */}
              <button
                onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')}
                className="px-2.5 py-1.5 text-xs font-bold border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition"
                title="تغيير اللغة"
              >
                {lang === 'ar' ? 'FR' : 'عربي'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Simple quick-access bar */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-3 mb-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-neutral-700 px-2">
              {lang === 'ar' ? 'وصول سريع:' : 'Accès rapide :'}
            </span>
            <button
              type="button"
              onClick={() => { setFormPage(1); setActiveTab('form'); }}
              className="px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition"
            >
              {lang === 'ar' ? '➕ إضافة وارد' : '➕ Nouvelle entrée'}
            </button>
            <button
              type="button"
              onClick={() => { setFormPage(2); setActiveTab('form'); }}
              className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition"
            >
              {lang === 'ar' ? '➕ إضافة مبيعات' : '➕ Nouvelle sortie'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sheets')}
              className="px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition"
            >
              {lang === 'ar' ? '📊 عرض الجداول والمخزون' : '📊 Voir les tableaux'}
            </button>
            <button
              type="button"
              onClick={() => setIsDriveModalOpen(true)}
              className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-bold transition"
            >
              {lang === 'ar' ? '☁️ Google Drive' : '☁️ Google Drive'}
            </button>
          </div>
        </div>

        {activeTab === 'form' && (
          <GoogleFormView
            startPage={formPage}
            currentStock={currentStock}
            entrees={entrees}
            sorties={sorties}
            onAddEntree={handleAddEntree}
            onAddSortie={handleAddSortie}
            onEditEntree={handleEditEntree}
            onDeleteEntree={handleDeleteEntree}
            onEditSortie={handleEditSortie}
            onDeleteSortie={handleDeleteSortie}
            onClearAllData={handleClearAllData}
            onGoToSheets={() => setActiveTab('sheets')}
            onOpenDriveModal={() => setIsDriveModalOpen(true)}
            isDriveConnected={!!currentUser}
            activeSpreadsheetUrl={activeSpreadsheet?.url}
            lang={lang}
          />
        )}

        {activeTab === 'sheets' && (
          <LiveGoogleSheetsDirectView
            entrees={entrees}
            sorties={sorties}
            currentStock={currentStock}
            onUpdateEntreesAndSorties={updateInventory}
            onOpenForm={() => setActiveTab('form')}
            accessToken={accessToken}
            onOpenDriveModal={() => setIsDriveModalOpen(true)}
            activeSpreadsheet={activeSpreadsheet}
            onSpreadsheetChange={setActiveSpreadsheet}
            lang={lang}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 py-4 px-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>نظام إدارة المخزون والمبيعات • </span>
            <span className="font-semibold text-neutral-700">152 Vert, 152 Bleu, 124 Vert, 124 Bleu</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearAllData}
              className="hover:text-red-600 transition flex items-center gap-1 text-neutral-500"
            >
              <Trash2 className="w-3 h-3" />
              <span>{lang === 'ar' ? 'إفراغ الجداول وتصفير المخزون' : 'Vider les tableaux'}</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setIsDriveModalOpen(true)}
              className="text-emerald-700 hover:underline font-medium flex items-center gap-1"
            >
              <Cloud className="w-3 h-3" />
              <span>{lang === 'ar' ? 'حساب Google Drive' : 'Google Drive'}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Google Drive Integration Modal */}
      <GoogleDriveSyncModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        currentUser={currentUser}
        accessToken={accessToken}
        onUserChange={(user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
        }}
        activeSpreadsheet={activeSpreadsheet}
        onSpreadsheetChange={setActiveSpreadsheet}
        entrees={entrees}
        sorties={sorties}
        autoSync={autoSync}
        onToggleAutoSync={setAutoSync}
        lang={lang}
      />
    </div>
  );
}
