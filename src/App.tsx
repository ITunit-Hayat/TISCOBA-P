import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchInventory, sendInventoryOp, InventoryOp } from './services/inventoryApi';
import { 
  FileSpreadsheet, 
  Cloud, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  ExternalLink
} from 'lucide-react';
import { User } from 'firebase/auth';
import { EntreeItem, SortieItem } from './types/stock';
import { LiveGoogleSheetsDirectView } from './components/LiveGoogleSheetsDirectView';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { initAuth, getAccessToken, googleSignIn, isAccessDeniedError } from './services/googleAuth';
import { 
  createInventorySpreadsheet, 
  listDriveSpreadsheets,
  getSpreadsheetMetadata,
  extractSpreadsheetId,
  getSharedSheetConfig,
  saveSharedSheetConfig,
  SharedSheetConfig
} from './services/googleDriveSheets';

export default function App() {
  const [lang, setLang] = useState<'ar' | 'fr'>('ar');
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [sharedTeamSheet, setSharedTeamSheet] = useState<SharedSheetConfig | null>(null);

  // Google Drive & Auth State - Permanently remembered from localStorage
  const [currentUser, setCurrentUser] = useState<User | any | null>(() => {
    try {
      const saved = localStorage.getItem('gdrive_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('gdrive_access_token');
    } catch {
      return null;
    }
  });

  const [activeSpreadsheet, setActiveSpreadsheet] = useState<{ id: string; url: string; title: string; webhookUrl?: string } | null>(() => {
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

  // Auto-sync status indicators
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSyncToast, setAutoSyncToast] = useState<string | null>(null);
  const [tokenNeedsRefresh, setTokenNeedsRefresh] = useState(false);
  const [hasLegacyColumns, setHasLegacyColumns] = useState(false);
  const isFetchingFromRemote = useRef(false);
  const lastSavedHash = useRef('');

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

  // Load team shared sheet config & URL parameters on mount
  useEffect(() => {
    getSharedSheetConfig().then((cfg) => {
      if (cfg) {
        setSharedTeamSheet(cfg);
        setActiveSpreadsheet((curr) => ({
          id: cfg.id || curr?.id || '1YmMLdU0c547GqTnxmdxexRQri4Pv2ifWfFE9ogEknIc',
          title: cfg.title || curr?.title || 'Tiscobap - Gestion de Stock (152 & 124)',
          url: cfg.url || curr?.url || `https://docs.google.com/spreadsheets/d/${cfg.id}/edit`,
          webhookUrl: cfg.webhookUrl || curr?.webhookUrl,
        }));
      }
    });

    try {
      const params = new URLSearchParams(window.location.search);
      const urlSheetId = params.get('sheetId');
      if (urlSheetId) {
        const cleanId = extractSpreadsheetId(urlSheetId);
        if (cleanId) {
          setSharedTeamSheet((prev) => ({
            id: cleanId,
            title: prev?.id === cleanId ? prev.title : 'Feuille Partagée (URL)',
            url: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
          }));
        }
      }
    } catch {}
  }, []);

  // Init Auth on load (preserves permanent localStorage connection)
  useEffect(() => {
    let unsub: any = null;
    try {
      unsub = initAuth(
        (user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
          if (token) {
            getSharedSheetConfig().then((cfg) => {
              if (cfg?.id) {
                saveSharedSheetConfig(cfg, user?.email || 'User', token);
              }
            });
          }
        },
        () => {
          // Only clear if localStorage has no token
          if (!localStorage.getItem('gdrive_access_token')) {
            setCurrentUser(null);
            setAccessToken(null);
          }
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

  // Real-time cross-tab auto synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stock_auto_sync_v2' && e.newValue) {
        setAutoSync(e.newValue === 'true');
      }
      if (e.key === 'stock_active_spreadsheet_v2') {
        try {
          setActiveSpreadsheet(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Entrees & Sorties: NEVER read from localStorage. The Google Sheet is the only source of truth.
  const [entrees, setEntrees] = useState<EntreeItem[]>([]);
  const [sorties, setSorties] = useState<SortieItem[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dataReadyRef = useRef(false);
  const [localOnly, setLocalOnly] = useState<{ e: EntreeItem[]; s: SortieItem[] } | null>(null);
  const migrationChecked = useRef(false);
  const entreesRef = useRef<EntreeItem[]>([]);
  const sortiesRef = useRef<SortieItem[]>([]);
  entreesRef.current = entrees;
  sortiesRef.current = sorties;

  const loadFromSheet = async (): Promise<boolean> => {
    try {
      const data = await fetchInventory();
      setEntrees(data.entrees);
      setSorties(data.sorties);
      dataReadyRef.current = true;
      setDataReady(true);
      // One-time check: rows that exist only in this browser (old versions kept them in localStorage)
      if (!migrationChecked.current) {
        migrationChecked.current = true;
        try {
          if (localStorage.getItem('stock_migration_ignored_v3') !== '1') {
            const le = JSON.parse(localStorage.getItem('stock_entrees_v2') || '[]');
            const ls = JSON.parse(localStorage.getItem('stock_sorties_v2') || '[]');
            const eIds = new Set(data.entrees.map((x) => x.id));
            const sIds = new Set(data.sorties.map((x) => x.id));
            const e = Array.isArray(le) ? le.filter((x: any) => x && x.id && !eIds.has(x.id)) : [];
            const sl = Array.isArray(ls) ? ls.filter((x: any) => x && x.id && !sIds.has(x.id)) : [];
            if (e.length || sl.length) setLocalOnly({ e, s: sl });
          }
        } catch {}
      }
      setLoadError(null);
      setLastSyncTime(new Date());
      return true;
    } catch (err: any) {
      // Keep what is already displayed (it came from the sheet); only report if we never loaded.
      if (!dataReadyRef.current) setLoadError(err?.message || 'SHEET_READ_FAILED');
      return false;
    }
  };

  // Load on open (any browser / phone), refresh when the tab becomes visible, and poll every 30s
  useEffect(() => {
    loadFromSheet();
    const timer = setInterval(() => loadFromSheet(), 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadFromSheet();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);

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

  // Connect Google Drive in 1 single click & immediately pull data!
  const handleConnectDriveOnce = async () => {
    try {
      setIsConnectingDrive(true);
      const result = await googleSignIn();
      if (!result) return;

      setCurrentUser(result.user);
      setAccessToken(result.accessToken);
      setTokenNeedsRefresh(false);

      // Check if team shared spreadsheet or existing spreadsheet exists or auto-create one
      let sheet = activeSpreadsheet;
      if (!sheet) {
        // 1. Try to connect to configured team shared sheet if current email has access
        if (sharedTeamSheet?.id) {
          try {
            const meta = await getSpreadsheetMetadata(result.accessToken, sharedTeamSheet.id);
            sheet = {
              id: sharedTeamSheet.id,
              url: sharedTeamSheet.url || `https://docs.google.com/spreadsheets/d/${sharedTeamSheet.id}/edit`,
              title: meta.title || sharedTeamSheet.title,
            };
          } catch (sharedErr: any) {
            console.warn('Could not auto-link team shared sheet for this account:', sharedErr);
          }
        }

        // 2. Search Drive for shared files or existing stock spreadsheets
        if (!sheet) {
          try {
            const files = await listDriveSpreadsheets(result.accessToken);
            // Prioritize files shared with this user
            const sharedMatch = files.find(
              (f) => f.sharedWithMe && (f.name.toLowerCase().includes('stock') || f.name.toLowerCase().includes('gestion'))
            );
            const anyShared = files.find((f) => f.sharedWithMe);
            const ownedMatch = files.find(
              (f) => f.name.toLowerCase().includes('stock') || f.name.toLowerCase().includes('gestion')
            );
            const existing = sharedMatch || anyShared || ownedMatch;

            if (existing) {
              sheet = {
                id: existing.id,
                url: existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`,
                title: existing.name,
              };
            } else {
              const created = await createInventorySpreadsheet(
                result.accessToken,
                entrees,
                sorties,
                'Tiscobap - Gestion de Stock (152 & 124)'
              );
              sheet = {
                id: created.spreadsheetId,
                url: created.spreadsheetUrl,
                title: created.title,
              };
            }
          } catch (e) {
            console.warn('Auto-sheet setup err:', e);
          }
        }

        if (sheet) {
          setActiveSpreadsheet(sheet);
          localStorage.setItem('stock_active_spreadsheet_v2', JSON.stringify(sheet));
          setSharedTeamSheet(sheet);
        }
      }

      const effectiveSheet = sheet || activeSpreadsheet || sharedTeamSheet || {
        id: '1YmMLdU0c547GqTnxmdxexRQri4Pv2ifWfFE9ogEknIc',
        title: 'Tiscobap - Gestion de Stock (152 & 124)',
        url: 'https://docs.google.com/spreadsheets/d/1YmMLdU0c547GqTnxmdxexRQri4Pv2ifWfFE9ogEknIc/edit',
      };

      setActiveSpreadsheet(effectiveSheet);
      localStorage.setItem('stock_active_spreadsheet_v2', JSON.stringify(effectiveSheet));
      await saveSharedSheetConfig(effectiveSheet, result.user.email || 'User', result.accessToken);
      setSharedTeamSheet(effectiveSheet);

      await loadFromSheet();
      setAutoSyncToast(lang === 'ar' ? '✅ تم الربط — البيانات المعروضة هي ما في الجدول' : '✅ Connecté — données issues du tableau');
      setTimeout(() => setAutoSyncToast(null), 3000);
    } catch (err: any) {
      console.error('Drive connection error:', err);
      if (isAccessDeniedError(err)) {
        setAutoSyncToast(
          lang === 'ar'
            ? 'خطأ 403: تم رفض الوصول من Google'
            : 'Erreur 403 : access_denied'
        );
      } else {
        setAutoSyncToast(err.message || (lang === 'ar' ? 'فشل الاتصال بـ Google Drive' : 'Échec de connexion'));
      }
    } finally {
      setIsConnectingDrive(false);
    }
  };

  // Direct connection to a shared Google Sheet by URL or ID
  const handleConnectSharedSheet = async (sheetUrlOrId: string) => {
    const cleanId = extractSpreadsheetId(sheetUrlOrId);
    if (!cleanId) {
      setAutoSyncToast(lang === 'ar' ? 'يرجى إدخال رابط أو معرف Google Sheets صالح' : 'Lien ou ID Google Sheets non valide');
      return;
    }

    let token = accessToken;
    let user = currentUser;

    if (!token || !user) {
      setIsConnectingDrive(true);
      try {
        const res = await googleSignIn();
        if (!res) return;
        user = res.user;
        token = res.accessToken;
        setCurrentUser(user);
        setAccessToken(token);
        setTokenNeedsRefresh(false);
      } catch (err: any) {
        if (isAccessDeniedError(err)) {
          setAutoSyncToast(lang === 'ar' ? 'خطأ 403: تم رفض الوصول' : 'Erreur 403 : access_denied');
        } else {
          setAutoSyncToast(err.message || (lang === 'ar' ? 'فشل تسجيل الدخول بحساب Google' : 'Échec de connexion Google'));
        }
        return;
      } finally {
        setIsConnectingDrive(false);
      }
    }

    setIsSyncingCloud(true);
    try {
      const meta = await getSpreadsheetMetadata(token, cleanId);
      const sheetObj = {
        id: cleanId,
        url: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
        title: meta.title || 'Feuille Partagée',
      };
      setActiveSpreadsheet(sheetObj);
      localStorage.setItem('stock_active_spreadsheet_v2', JSON.stringify(sheetObj));
      await saveSharedSheetConfig(sheetObj, user?.email || 'User', token);
      setSharedTeamSheet(sheetObj);

      await loadFromSheet();
      setAutoSyncToast(lang === 'ar' ? `✅ تم ربط "${sheetObj.title}"` : `✅ Feuille "${sheetObj.title}" liée`);
      setTimeout(() => setAutoSyncToast(null), 3000);
    } catch (err: any) {
      if (err?.message === 'GOOGLE_SHEET_NO_ACCESS') {
        setAutoSyncToast(
          lang === 'ar'
            ? `❌ تعذر فتح الملف: لم يتم منح بريدك (${user?.email}) إذن المشاركة في Google Sheets`
            : `❌ Accès refusé pour ${user?.email}`
        );
      } else if (isAccessDeniedError(err)) {
        setAutoSyncToast(lang === 'ar' ? 'خطأ 403: تم رفض الوصول' : 'Erreur 403 : access_denied');
      } else {
        setAutoSyncToast(err?.message || 'خطأ أثناء ربط ملف قوقل شيت');
      }
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Pull latest data from the sheet (never pushes anything)
  const handleFetchFromGoogleSheets = async () => {
    setIsSyncingCloud(true);
    const ok = await loadFromSheet();
    setIsSyncingCloud(false);
    setAutoSyncToast(
      ok
        ? lang === 'ar' ? '✓ تم تحديث البيانات من الجدول' : '✓ Données actualisées depuis le tableau'
        : lang === 'ar' ? '⚠️ تعذر قراءة الجدول — لم يتغير شيء' : '⚠️ Lecture impossible — rien n\'a été modifié'
    );
    setTimeout(() => setAutoSyncToast(null), 3000);
  };

  const handleManualSyncNow = handleFetchFromGoogleSheets;

  // Run ONE row operation on the sheet; show the sheet's real answer.
  const runOp = async (op: InventoryOp): Promise<boolean> => {
    if (!dataReadyRef.current) {
      setAutoSyncToast(lang === 'ar' ? '⛔ لم يتم تحميل الجدول بعد — لا يمكن الحفظ' : '⛔ Tableau non chargé — enregistrement bloqué');
      setTimeout(() => setAutoSyncToast(null), 3500);
      return false;
    }
    setIsSyncingCloud(true);
    try {
      const snap = await sendInventoryOp(op);
      setEntrees(snap.entrees);
      setSorties(snap.sorties);
      setLastSyncTime(new Date());
      const t = snap.target;
      setAutoSyncToast(
        t
          ? lang === 'ar'
            ? `💾 تم الحفظ في الملف «${t.file}» — ورقة «${op.sheet === 'entree' ? t.entreeTab : t.sortieTab}» (${op.sheet === 'entree' ? t.entreeRows : t.sortieRows} سطر)`
            : `💾 Enregistré dans « ${t.file} » — onglet « ${op.sheet === 'entree' ? t.entreeTab : t.sortieTab} » (${op.sheet === 'entree' ? t.entreeRows : t.sortieRows} lignes)`
          : lang === 'ar' ? '💾 تم الحفظ في الجدول ✓' : '💾 Enregistré dans le tableau ✓'
      );
      setTimeout(() => setAutoSyncToast(null), 6000);
      return true;
    } catch (err: any) {
      setAutoSyncToast(
        lang === 'ar'
          ? `❌ لم يُحفظ في الجدول (${err?.message || 'خطأ'}) — أعد المحاولة`
          : `❌ Non enregistré (${err?.message || 'erreur'}) — réessayez`
      );
      setTimeout(() => setAutoSyncToast(null), 4500);
      await loadFromSheet(); // show the truth
      return false;
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // The UI hands us full lists; we turn the difference into row-level operations only.
  const handleUpdateEntreesAndSorties = async (newE: EntreeItem[], newS: SortieItem[]) => {
    const oldE = entreesRef.current;
    const oldS = sortiesRef.current;
    const ops: InventoryOp[] = [];

    const diff = <T extends { id: string }>(oldL: T[], newL: T[], sheet: 'entree' | 'sortie') => {
      const newIds = new Set(newL.map((x) => x.id));
      const oldMap = new Map(oldL.map((x) => [x.id, x]));
      oldL.forEach((o) => {
        if (!newIds.has(o.id)) ops.push({ action: 'delete', sheet, id: o.id });
      });
      newL.forEach((n) => {
        const o = oldMap.get(n.id);
        if (!o) ops.push({ action: 'add', sheet, item: n } as unknown as InventoryOp);
        else if (JSON.stringify(o) !== JSON.stringify(n)) ops.push({ action: 'update', sheet, item: n } as unknown as InventoryOp);
      });
    };
    diff(oldE, newE, 'entree');
    diff(oldS, newS, 'sortie');

    // SAFETY: a single user action may never delete more than one row
    if (ops.filter((o) => o.action === 'delete').length > 1) {
      console.warn('PROTECTION ACTIVE: blocked bulk delete');
      return;
    }
    for (const op of ops) {
      if (!(await runOp(op))) break;
    }
  };

  const uploadLocalOnly = async () => {
    if (!localOnly || !dataReadyRef.current) return;
    setIsSyncingCloud(true);
    try {
      let last: Awaited<ReturnType<typeof sendInventoryOp>> | null = null;
      for (const it of localOnly.e) last = await sendInventoryOp({ action: 'add', sheet: 'entree', item: it });
      for (const it of localOnly.s) last = await sendInventoryOp({ action: 'add', sheet: 'sortie', item: it });
      if (last) {
        setEntrees(last.entrees);
        setSorties(last.sorties);
      }
      const n = localOnly.e.length + localOnly.s.length;
      setLocalOnly(null);
      setAutoSyncToast(lang === 'ar' ? `✅ تم رفع ${n} عملية من هذا المتصفح إلى الجدول` : `✅ ${n} lignes envoyées au tableau`);
      setTimeout(() => setAutoSyncToast(null), 5000);
    } catch (err: any) {
      setAutoSyncToast(lang === 'ar' ? `❌ تعذر الرفع (${err?.message || 'خطأ'}) — لم يُحذف شيء` : `❌ Envoi impossible (${err?.message || 'erreur'})`);
      setTimeout(() => setAutoSyncToast(null), 5000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleAddEntree = async (newItem: EntreeItem) => {
    return await runOp({ action: 'add', sheet: 'entree', item: newItem });
  };
  const handleEditEntree = (updatedItem: EntreeItem) => {
    runOp({ action: 'update', sheet: 'entree', item: updatedItem });
  };
  const handleDeleteEntree = (id: string) => {
    runOp({ action: 'delete', sheet: 'entree', id });
  };
  const handleAddSortie = async (newItem: SortieItem) => {
    return await runOp({ action: 'add', sheet: 'sortie', item: newItem });
  };
  const handleEditSortie = (updatedItem: SortieItem) => {
    runOp({ action: 'update', sheet: 'sortie', item: updatedItem });
  };
  const handleDeleteSortie = (id: string) => {
    runOp({ action: 'delete', sheet: 'sortie', id });
  };

  // Block the whole app until the sheet has really been read (prevents any stale/empty overwrite)
  if (!dataReady) {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 text-center font-sans">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full border border-neutral-200">
          {loadError ? (
            <>
              <p className="text-sm font-bold text-red-700 mb-2">
                {lang === 'ar' ? 'تعذر قراءة الجدول' : 'Lecture du tableau impossible'}
              </p>
              <p className="text-xs text-neutral-600 mb-4">
                {lang === 'ar'
                  ? 'لم يتم تغيير أو حذف أي شيء. تحقق من الاتصال ثم أعد المحاولة.'
                  : 'Rien n\'a été modifié. Vérifiez la connexion puis réessayez.'}
              </p>
              <button
                onClick={() => { setLoadError(null); loadFromSheet(); }}
                className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white font-medium rounded-xl text-sm"
              >
                {lang === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}
              </button>
            </>
          ) : (
            <p className="text-sm text-neutral-700">
              {lang === 'ar' ? 'جاري تحميل البيانات من الجدول...' : 'Chargement depuis le tableau...'}
            </p>
          )}
        </div>
      </div>
    );
  }

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

            {/* Right Controls: Drive Status & Language */}
            <div className="flex items-center gap-2">
              {/* Google Drive Status Pill */}
              {activeSpreadsheet ? (
                tokenNeedsRefresh ? (
                  <button
                    type="button"
                    onClick={handleConnectDriveOnce}
                    disabled={isConnectingDrive}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold text-amber-800 transition cursor-pointer"
                    title={lang === 'ar' ? 'انتهت صلاحية جلسة Google - انقر للتجديد' : 'Session Google expirée - Cliquez pour renouveler'}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>
                      {isConnectingDrive
                        ? (lang === 'ar' ? 'جاري التجديد...' : 'Connexion...')
                        : (lang === 'ar' ? 'تجديد الجلسة 🔑' : 'Renouveler')}
                    </span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden sm:inline">
                      {lang === 'ar' ? 'Google Drive متصل' : 'Drive connecté'}
                    </span>
                    <a
                      href={activeSpreadsheet.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 transition flex items-center gap-0.5"
                      title={lang === 'ar' ? 'فتح في Google Sheets' : 'Ouvrir'}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleConnectDriveOnce}
                  disabled={isConnectingDrive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>
                    {isConnectingDrive
                      ? lang === 'ar' ? 'جاري الاتصال...' : 'Connexion...'
                      : lang === 'ar' ? 'ربط Google Drive' : 'Lier Drive'}
                  </span>
                </button>
              )}

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

      {/* Floating Auto-Sync Notification Toast */}
      {localOnly && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-3">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span className="font-bold">
              {lang === 'ar'
                ? `⚠️ وُجدت ${localOnly.e.length + localOnly.s.length} عملية محفوظة في هذا المتصفح فقط وليست في الجدول. ارفعها حتى لا تضيع.`
                : `⚠️ ${localOnly.e.length + localOnly.s.length} lignes n'existent que dans ce navigateur, pas dans le tableau.`}
            </span>
            <span className="flex gap-2 shrink-0">
              <button onClick={uploadLocalOnly} className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold">
                {lang === 'ar' ? 'رفع إلى الجدول' : 'Envoyer au tableau'}
              </button>
              <button
                onClick={() => { try { localStorage.setItem('stock_migration_ignored_v3', '1'); } catch {} setLocalOnly(null); }}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-bold"
              >
                {lang === 'ar' ? 'تجاهل' : 'Ignorer'}
              </button>
            </span>
          </div>
        </div>
      )}

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
        <LiveGoogleSheetsDirectView
          entrees={entrees}
          sorties={sorties}
          currentStock={currentStock}
          onUpdateEntreesAndSorties={handleUpdateEntreesAndSorties}
          onAddEntree={handleAddEntree}
          onAddSortie={handleAddSortie}
          onOpenDriveModal={() => setIsDriveModalOpen(true)}
          activeSpreadsheet={activeSpreadsheet}
          autoSync={autoSync}
          onToggleAutoSync={setAutoSync}
          isAutoSyncing={isSyncingCloud}
          lastSyncTime={lastSyncTime}
          onManualSyncNow={handleManualSyncNow}
          onConnectDriveOnce={handleConnectDriveOnce}
          isConnectingDrive={isConnectingDrive}
          tokenNeedsRefresh={tokenNeedsRefresh}
          sharedTeamSheet={sharedTeamSheet}
          currentUser={currentUser}
          hasLegacyColumns={hasLegacyColumns}
          onUpgradeSheetColumns={handleManualSyncNow}
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDriveModalOpen(true)}
              className="text-emerald-700 hover:underline font-medium flex items-center gap-1"
            >
              <Cloud className="w-3 h-3" />
              <span>{lang === 'ar' ? 'إعدادات Google Drive' : 'Google Drive'}</span>
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
        sharedTeamSheet={sharedTeamSheet}
        onConnectSharedSheet={handleConnectSharedSheet}
        lang={lang}
      />
    </div>
  );
}
