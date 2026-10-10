import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  writeAllDataToGoogleSheet, 
  readAllSheetsData,
  appendEntreeRow,
  appendSortieRow,
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

  // Sync inventory with backend server cache for instant team sharing
  useEffect(() => {
    fetch('/api/inventory')
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res.data) {
          const remoteE = res.data.entrees;
          const remoteS = res.data.sorties;
          if (Array.isArray(remoteE) && Array.isArray(remoteS)) {
            if (remoteE.length > 0 || remoteS.length > 0) {
              setEntrees((prev) => (prev.length === 0 ? remoteE : prev));
              setSorties((prev) => (prev.length === 0 ? remoteS : prev));
            }
          }
        }
      })
      .catch(() => {});
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

  // 📥 Read live data from Google Sheets database on initial load or sheet change
  const initialLoadDone = useRef(false);
  const hasLoadedRemoteData = useRef(false);
  useEffect(() => {
    if (!activeSpreadsheet?.id) return;

    let isSubscribed = true;
    const fetchFromSheetsDb = async () => {
      const token = accessToken || (await getAccessToken());
      if (!token || !activeSpreadsheet?.id) return;

      setIsSyncingCloud(true);
      try {
        const { entrees: sheetE, sorties: sheetS, isLegacy4Columns } = await readAllSheetsData(token, activeSpreadsheet.id);
        if (!isSubscribed) return;

        setHasLegacyColumns(Boolean(isLegacy4Columns));

        // Google Sheets is the master source of truth across all devices and browsers
        setEntrees(sheetE);
        setSorties(sheetS);
        try {
          localStorage.setItem('stock_entrees_v2', JSON.stringify(sheetE));
          localStorage.setItem('stock_sorties_v2', JSON.stringify(sheetS));
        } catch {}
        hasLoadedRemoteData.current = true;
        setTokenNeedsRefresh(false);
        setLastSyncTime(new Date());
        lastSavedHash.current = `${sheetE.length}_${sheetS.length}_${JSON.stringify(sheetE[0] || {})}_${JSON.stringify(sheetS[0] || {})}`;
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          if (sheetE.length > 0 || sheetS.length > 0) {
            setAutoSyncToast(
              lang === 'ar'
                ? `✓ تم تحميل قاعدة البيانات من Google Sheets (${sheetE.length + sheetS.length} عملية)`
                : `✓ Base Google Sheets chargée (${sheetE.length + sheetS.length} lignes)`
            );
            setTimeout(() => setAutoSyncToast(null), 3000);
          }
        }
      } catch (err: any) {
        if (err?.message === 'GOOGLE_AUTH_EXPIRED') {
          setTokenNeedsRefresh(true);
          // Expired token: clear cached accessToken so future calls know auth is expired
          setAccessToken(null);
          localStorage.removeItem('gdrive_access_token');
        } else {
          console.warn('Initial load from Google Sheets:', err);
        }
      } finally {
        if (isSubscribed) setIsSyncingCloud(false);
      }
    };

    fetchFromSheetsDb();
    return () => {
      isSubscribed = false;
    };
  }, [activeSpreadsheet?.id, accessToken]);

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

      // Read from Google Sheets database or seed it!
      if (effectiveSheet) {
        setIsSyncingCloud(true);
        try {
          const data = await readAllSheetsData(result.accessToken, effectiveSheet.id);
          if (data.entrees.length > 0 || data.sorties.length > 0) {
            isFetchingFromRemote.current = true;
            setEntrees(data.entrees);
            setSorties(data.sorties);
            lastSavedHash.current = `${data.entrees.length}_${data.sorties.length}_${JSON.stringify(data.entrees[0] || {})}_${JSON.stringify(data.sorties[0] || {})}`;
            setLastSyncTime(new Date());
            setAutoSyncToast(
              lang === 'ar'
                ? `✅ تم ربط ملف "${effectiveSheet.title}" المشترك واسترجاع ${data.entrees.length + data.sorties.length} عملية بنجاح!`
                : '✅ Connecté à Google Sheets avec succès !'
            );
          } else {
            await writeAllDataToGoogleSheet(result.accessToken, effectiveSheet.id, entrees, sorties);
            lastSavedHash.current = `${entrees.length}_${sorties.length}_${JSON.stringify(entrees[0] || {})}_${JSON.stringify(sorties[0] || {})}`;
            setLastSyncTime(new Date());
            setAutoSyncToast(
              lang === 'ar'
                ? `✅ تم ربط وحفظ البيانات في Google Sheets: "${effectiveSheet.title}"`
                : '✅ Connecté à Google Sheets avec succès !'
            );
          }
        } catch (syncErr: any) {
          console.warn('Initial sync error:', syncErr);
        } finally {
          setIsSyncingCloud(false);
        }
        setTimeout(() => setAutoSyncToast(null), 3500);
      }
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

      // Read remote data
      const data = await readAllSheetsData(token, cleanId);
      if (data.entrees.length > 0 || data.sorties.length > 0) {
        isFetchingFromRemote.current = true;
        setEntrees(data.entrees);
        setSorties(data.sorties);
        lastSavedHash.current = `${data.entrees.length}_${data.sorties.length}_${JSON.stringify(data.entrees[0] || {})}_${JSON.stringify(data.sorties[0] || {})}`;
        setLastSyncTime(new Date());
        setAutoSyncToast(
          lang === 'ar'
            ? `✅ تم ربط ملف قوقل شيت المشترك "${sheetObj.title}" واسترجاع ${data.entrees.length + data.sorties.length} عملية بنجاح!`
            : `✅ Feuille partagée "${sheetObj.title}" liée avec succès !`
        );
      } else {
        await writeAllDataToGoogleSheet(token, cleanId, entrees, sorties);
        lastSavedHash.current = `${entrees.length}_${sorties.length}_${JSON.stringify(entrees[0] || {})}_${JSON.stringify(sorties[0] || {})}`;
        setLastSyncTime(new Date());
        setAutoSyncToast(
          lang === 'ar'
            ? `✅ تم ربط ملف قوقل شيت المشترك "${sheetObj.title}" وحفظ البيانات فيه!`
            : `✅ Feuille partagée liée avec succès !`
        );
      }
      setTimeout(() => setAutoSyncToast(null), 3500);
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

  // Pull latest data directly from Google Sheets (Refresh Database)
  const handleFetchFromGoogleSheets = async () => {
    if (!activeSpreadsheet?.id) {
      handleConnectDriveOnce();
      return;
    }
    const token = accessToken || (await getAccessToken());
    if (!token) {
      handleConnectDriveOnce();
      return;
    }

    setIsSyncingCloud(true);
    try {
      const data = await readAllSheetsData(token, activeSpreadsheet.id);
      if (data.entrees.length > 0 || data.sorties.length > 0) {
        setEntrees(data.entrees);
        setSorties(data.sorties);
        setLastSyncTime(new Date());
        setAutoSyncToast(
          lang === 'ar'
            ? `✓ تم تحديث واسترجاع البيانات من Google Sheets (${data.entrees.length + data.sorties.length} عملية)`
            : '✓ Données actualisées depuis Google Sheets'
        );
      } else {
        setAutoSyncToast(
          lang === 'ar'
            ? 'ℹ️ ملف Google Sheets فارغ حالياً، جاري حفظ البيانات المحلية فيه...'
            : 'ℹ️ Fichier vide, sauvegarde des données locales...'
        );
        await writeAllDataToGoogleSheet(token, activeSpreadsheet.id, entrees, sorties);
        setLastSyncTime(new Date());
      }
      setTimeout(() => setAutoSyncToast(null), 3000);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setAutoSyncToast(
        lang === 'ar'
          ? `⚠️ ${err.message || 'خطأ أثناء تحميل البيانات من Google Sheets'}`
          : `⚠️ ${err.message || 'Erreur lors du chargement Google Sheets'}`
      );
      setTimeout(() => setAutoSyncToast(null), 4000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Instant write to Google Sheets when data is modified directly
  const handleUpdateEntreesAndSorties = async (newE: EntreeItem[], newS: SortieItem[]) => {
    setEntrees(newE);
    setSorties(newS);

    // CRITICAL: NEVER overwrite Google Sheets if both lists are empty!
    if (newE.length === 0 && newS.length === 0) {
      console.warn('PROTECTION ACTIVE: Blocked writing empty dataset to Google Sheets');
      return;
    }

    const token = accessToken || (await getAccessToken());

    // 1. Immediately persist to server inventory cache (passes token so server updates Google Sheets)
    fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entrees: newE,
        sorties: newS,
        author: currentUser?.email || 'User',
        token: token || undefined,
      }),
    }).catch(() => {});
    if (token && activeSpreadsheet?.id) {
      setIsSyncingCloud(true);
      try {
        await writeAllDataToGoogleSheet(token, activeSpreadsheet.id, newE, newS);
        lastSavedHash.current = `${newE.length}_${newS.length}_${JSON.stringify(newE[0] || {})}_${JSON.stringify(newS[0] || {})}`;
        setTokenNeedsRefresh(false);
        setLastSyncTime(new Date());
        setAutoSyncToast(
          lang === 'ar'
            ? '💾 تم الحفظ المباشر في قوقل شيت ✓'
            : '💾 Enregistré dans Google Sheets ✓'
        );
        setTimeout(() => setAutoSyncToast(null), 2500);

        // Keep backend server updated with the valid token
        saveSharedSheetConfig(activeSpreadsheet, currentUser?.email || 'User', token);
      } catch (err: any) {
        if (err?.message === 'GOOGLE_AUTH_EXPIRED') {
          setTokenNeedsRefresh(true);
          setAutoSyncToast(
            lang === 'ar'
              ? '⚠️ انتهت جلسة Google - اضغط زر المزامنة لتجديدها'
              : '⚠️ Session Google expirée - cliquez pour renouveler'
          );
        } else {
          console.warn('Direct write to Google Sheets failed:', err);
          setAutoSyncToast(err.message || 'خطأ أثناء الحفظ في قوقل شيت');
        }
      } finally {
        setIsSyncingCloud(false);
      }
    } else {
      // 3. If client has no token, invoke server-side sync with stored token
      fetch('/api/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res?.success) {
            setLastSyncTime(new Date());
            setAutoSyncToast(
              lang === 'ar'
                ? '💾 تم الحفظ والمزامنة التلقائية مع قوقل شيت ✓'
                : '💾 Enregistré et synchronisé avec Google Sheets ✓'
            );
            setTimeout(() => setAutoSyncToast(null), 2500);
          } else {
            setAutoSyncToast(
              lang === 'ar'
                ? '💾 تم حفظ البيانات في النظام المشترك (انقر "مزامنة Google Sheets" للتطبيق)'
                : '💾 Données enregistrées (cliquez Synchroniser pour Google Sheets)'
            );
            setTimeout(() => setAutoSyncToast(null), 3000);
          }
        })
        .catch(() => {});
    }
  };

  // Manual trigger if user wants instant sync right now
  const handleManualSyncNow = async () => {
    setIsSyncingCloud(true);
    try {
      let token = accessToken || (await getAccessToken());
      if (!token) {
        // Prompt Google Sign-in to get fresh token
        const res = await googleSignIn();
        if (!res) {
          setIsSyncingCloud(false);
          return;
        }
        token = res.accessToken;
        setAccessToken(token);
        setCurrentUser(res.user);
        setTokenNeedsRefresh(false);
      }

      if (!activeSpreadsheet?.id) {
        await handleConnectDriveOnce();
        return;
      }

      // Write all current entrees and sorties directly to Google Sheets
      await writeAllDataToGoogleSheet(token, activeSpreadsheet.id, entrees, sorties);
      await saveSharedSheetConfig(activeSpreadsheet, currentUser?.email || 'Admin', token);

      lastSavedHash.current = `${entrees.length}_${sorties.length}_${JSON.stringify(entrees[0] || {})}_${JSON.stringify(sorties[0] || {})}`;
      setTokenNeedsRefresh(false);
      setHasLegacyColumns(false);
      setLastSyncTime(new Date());
      setAutoSyncToast(
        lang === 'ar'
          ? `✅ تم حفظ ومزامنة ${entrees.length + sorties.length} عملية وتحديث جميع الأعمدة الـ 8 بنجاح في Google Sheets!`
          : `✅ Synchronisé avec succès dans Google Sheets (${entrees.length + sorties.length} lignes et 8 colonnes) !`
      );
      setTimeout(() => setAutoSyncToast(null), 3000);
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      if (err?.message === 'GOOGLE_AUTH_EXPIRED') {
        setTokenNeedsRefresh(true);
        try {
          const res = await googleSignIn();
          if (res) {
            setAccessToken(res.accessToken);
            setCurrentUser(res.user);
            await writeAllDataToGoogleSheet(res.accessToken, activeSpreadsheet!.id, entrees, sorties);
            await saveSharedSheetConfig(activeSpreadsheet!, res.user.email || 'Admin', res.accessToken);
            setTokenNeedsRefresh(false);
            setHasLegacyColumns(false);
            setLastSyncTime(new Date());
            setAutoSyncToast(
              lang === 'ar'
                ? '✅ تم تجديد الجلسة وحفظ البيانات في Google Sheets بنجاح!'
                : '✅ Session renouvelée et données synchronisées !'
            );
            return;
          }
        } catch {}
      }
      setAutoSyncToast(err.message || 'خطأ أثناء المزامنة مع Google Sheets');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Handlers for adding/editing/deleting rows
  const handleAddEntree = async (newItem: EntreeItem) => {
    setEntrees((prev) => [newItem, ...prev]);

    const token = accessToken || (await getAccessToken());
    if (token && activeSpreadsheet?.id) {
      setIsSyncingCloud(true);
      try {
        await appendEntreeRow(token, activeSpreadsheet.id, newItem);
        setLastSyncTime(new Date());
        setAutoSyncToast(
          lang === 'ar'
            ? '💾 تم تسجيل الاستلام وحماية بيانات Google Sheets ✓'
            : '💾 Entrée ajoutée dans Google Sheets ✓'
        );
        setTimeout(() => setAutoSyncToast(null), 2500);

        // Refresh master data to synchronize all rows
        const latest = await readAllSheetsData(token, activeSpreadsheet.id);
        if (latest.entrees.length > 0 || latest.sorties.length > 0) {
          setEntrees(latest.entrees);
          setSorties(latest.sorties);
          localStorage.setItem('stock_entrees_v2', JSON.stringify(latest.entrees));
          localStorage.setItem('stock_sorties_v2', JSON.stringify(latest.sorties));
        }
      } catch (err: any) {
        if (err?.message === 'GOOGLE_AUTH_EXPIRED') {
          setTokenNeedsRefresh(true);
        } else {
          console.warn('Append Entree failed:', err);
        }
      } finally {
        setIsSyncingCloud(false);
      }
    }
  };

  const handleEditEntree = (updatedItem: EntreeItem) => {
    const nextEntrees = entrees.map((e) => (e.id === updatedItem.id ? updatedItem : e));
    handleUpdateEntreesAndSorties(nextEntrees, sorties);
  };

  const handleDeleteEntree = (id: string) => {
    const nextEntrees = entrees.filter((e) => e.id !== id);
    handleUpdateEntreesAndSorties(nextEntrees, sorties);
  };

  const handleAddSortie = async (newItem: SortieItem) => {
    setSorties((prev) => [newItem, ...prev]);

    const token = accessToken || (await getAccessToken());
    if (token && activeSpreadsheet?.id) {
      setIsSyncingCloud(true);
      try {
        await appendSortieRow(token, activeSpreadsheet.id, newItem);
        setLastSyncTime(new Date());
        setAutoSyncToast(
          lang === 'ar'
            ? '💾 تم تسجيل البيع وحماية بيانات Google Sheets ✓'
            : '💾 Sortie ajoutée dans Google Sheets ✓'
        );
        setTimeout(() => setAutoSyncToast(null), 2500);

        // Refresh master data to synchronize all rows
        const latest = await readAllSheetsData(token, activeSpreadsheet.id);
        if (latest.entrees.length > 0 || latest.sorties.length > 0) {
          setEntrees(latest.entrees);
          setSorties(latest.sorties);
          localStorage.setItem('stock_entrees_v2', JSON.stringify(latest.entrees));
          localStorage.setItem('stock_sorties_v2', JSON.stringify(latest.sorties));
        }
      } catch (err: any) {
        if (err?.message === 'GOOGLE_AUTH_EXPIRED') {
          setTokenNeedsRefresh(true);
        } else {
          console.warn('Append Sortie failed:', err);
        }
      } finally {
        setIsSyncingCloud(false);
      }
    }
  };

  const handleEditSortie = (updatedItem: SortieItem) => {
    const nextSorties = sorties.map((s) => (s.id === updatedItem.id ? updatedItem : s));
    handleUpdateEntreesAndSorties(entrees, nextSorties);
  };

  const handleDeleteSortie = (id: string) => {
    const nextSorties = sorties.filter((s) => s.id !== id);
    handleUpdateEntreesAndSorties(entrees, nextSorties);
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
