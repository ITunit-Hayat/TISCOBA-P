import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw, 
  FileSpreadsheet, 
  AlertCircle, 
  LogOut, 
  Layers, 
  Plus, 
  X,
  Loader2,
  HardDrive,
  Users,
  Link2,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { User } from 'firebase/auth';
import { googleSignIn, logout, getAccessToken, isAccessDeniedError } from '../services/googleAuth';
import { 
  createInventorySpreadsheet, 
  writeAllDataToGoogleSheet,
  listDriveSpreadsheets, 
  DriveFileInfo,
  getSpreadsheetMetadata,
  extractSpreadsheetId,
  saveSharedSheetConfig
} from '../services/googleDriveSheets';
import { EntreeItem, SortieItem } from '../types/stock';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onUserChange: (user: User | null, token: string | null) => void;
  activeSpreadsheet: { id: string; url: string; title: string; webhookUrl?: string } | null;
  onSpreadsheetChange: (sheet: { id: string; url: string; title: string; webhookUrl?: string } | null) => void;
  entrees: EntreeItem[];
  sorties: SortieItem[];
  autoSync: boolean;
  onToggleAutoSync: (val: boolean) => void;
  sharedTeamSheet?: { id: string; url: string; title: string; sharedBy?: string; webhookUrl?: string } | null;
  onConnectSharedSheet?: (sheetUrlOrId: string) => Promise<boolean | void>;
  lang: 'ar' | 'fr';
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accessToken,
  onUserChange,
  activeSpreadsheet,
  onSpreadsheetChange,
  entrees,
  sorties,
  autoSync,
  onToggleAutoSync,
  sharedTeamSheet,
  onConnectSharedSheet,
  lang,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Shared sheet URL/ID manual input
  const [sharedInput, setSharedInput] = useState('');
  const [isVerifyingShared, setIsVerifyingShared] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [fileFilter, setFileFilter] = useState<'all' | 'shared' | 'owned'>('all');

  // Webhook integration state
  const [webhookInput, setWebhookInput] = useState(
    sharedTeamSheet?.webhookUrl ||
    'https://script.google.com/macros/s/AKfycbz_YAxQXJQaMZjLWxpd8_MUj4YKuAT50OIIvH34cf10cMmBXdjDLPK7E4Ivf8USXDDx/exec'
  );
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  useEffect(() => {
    if (sharedTeamSheet?.webhookUrl) {
      setWebhookInput(sharedTeamSheet.webhookUrl);
    }
  }, [sharedTeamSheet?.webhookUrl]);

  // Load user spreadsheets when signed in
  useEffect(() => {
    if (isOpen && accessToken) {
      loadDriveFiles();
    }
  }, [isOpen, accessToken]);

  if (!isOpen) return null;

  const loadDriveFiles = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) return;
    setIsLoadingFiles(true);
    try {
      const files = await listDriveSpreadsheets(token);
      setDriveFiles(files);
    } catch (err) {
      console.warn('Failed to load drive files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onUserChange(result.user, result.accessToken);
        setStatusMessage({
          text: lang === 'ar' ? 'تم تسجيل الدخول بنجاح! جاري فحص ملفات Google Sheets...' : 'Connexion réussie ! Vérification...',
          type: 'success',
        });

        // 1. If a shared team sheet is configured, test if this user's email was granted access
        if (sharedTeamSheet?.id) {
          try {
            const meta = await getSpreadsheetMetadata(result.accessToken, sharedTeamSheet.id);
            const sheetObj = {
              id: sharedTeamSheet.id,
              url: sharedTeamSheet.url || `https://docs.google.com/spreadsheets/d/${sharedTeamSheet.id}/edit`,
              title: meta.title || sharedTeamSheet.title,
            };
            onSpreadsheetChange(sheetObj);
            setStatusMessage({
              text: lang === 'ar' 
                ? `تم ربط ملف الشيت المشترك "${sheetObj.title}" تلقائياً بحسابك!` 
                : `Feuille partagée "${sheetObj.title}" connectée automatiquement !`,
              type: 'success',
            });
            loadDriveFiles();
            return;
          } catch (accessErr: any) {
            console.warn('User does not have access to shared team sheet yet:', accessErr);
          }
        }

        // 2. Automatically detect shared files or existing stock spreadsheets
        try {
          const files = await listDriveSpreadsheets(result.accessToken);
          setDriveFiles(files);
          
          if (activeSpreadsheet) {
            setStatusMessage({
              text: lang === 'ar' ? 'تم الربط بنجاح وبشكل دائم!' : 'Connecté en permanence !',
              type: 'success',
            });
            return;
          }

          // Prioritize files shared with this user or existing stock file
          const sharedFile = files.find(f => f.sharedWithMe && (f.name.toLowerCase().includes('stock') || f.name.toLowerCase().includes('gestion')));
          const existing = sharedFile || files.find(f => f.name.toLowerCase().includes('stock') || f.name.toLowerCase().includes('gestion'));

          if (existing) {
            const sheetObj = {
              id: existing.id,
              url: existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`,
              title: existing.name,
            };
            onSpreadsheetChange(sheetObj);
            await saveSharedSheetConfig(sheetObj, result.user.email || 'User', result.accessToken);
            setStatusMessage({
              text: lang === 'ar' 
                ? `تم ربط ملف "${existing.name}" ${existing.sharedWithMe ? '(المشترك معك عبر الإيميل)' : ''} بنجاح!` 
                : `Fichier lié automatiquement !`,
              type: 'success',
            });
          }
        } catch (autoErr) {
          console.warn('Auto spreadsheet setup warning:', autoErr);
        }
      }
    } catch (err: any) {
      if (isAccessDeniedError(err)) {
        setStatusMessage({
          text: lang === 'ar'
            ? 'خطأ 403: تم رفض الوصول من Google'
            : 'Erreur 403 : access_denied',
          type: 'error',
        });
      } else {
        setStatusMessage({
          text: err.message || (lang === 'ar' ? 'فشل تسجيل الدخول' : 'Échec de la connexion'),
          type: 'error',
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onUserChange(null, null);
    onSpreadsheetChange(null);
    setDriveFiles([]);
    setStatusMessage({
      text: lang === 'ar' ? 'تم تسجيل الخروج بنجاح.' : 'Déconnexion effectuée.',
      type: 'success',
    });
  };

  const APPS_SCRIPT_CODE = `function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Google Apps Script Webhook is active and running!"
  })).setMimeType(ContentService.MimeType.JSON);
}

// دالة تجريبية لتفعيل أذونات قوقل بنقرة واحدة (Exécuter / Run)
function testRun() {
  var ss = getSpreadsheet();
  Logger.log("الملف متصل بنجاح: " + ss.getName());
}

function getSpreadsheet(optId) {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch(e) {}
  if (!ss) {
    try {
      var sheetId = optId || "1YmMLdU0c547GqTnxmdxexRQri4Pv2ifWfFE9ogEknIc";
      ss = SpreadsheetApp.openById(sheetId);
    } catch(err) {}
  }
  return ss;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet(data.spreadsheetId);
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Spreadsheet not found or access denied" })).setMimeType(ContentService.MimeType.JSON);
    }

    var s1 = ss.getSheetByName("Feuille 1 Entrée") || ss.insertSheet("Feuille 1 Entrée");
    var s2 = ss.getSheetByName("Feuille 2 Sortie") || ss.insertSheet("Feuille 2 Sortie");
    var s3 = ss.getSheetByName("Feuille 3 Synthèse") || ss.insertSheet("Feuille 3 Synthèse");
    
    if (data.entrees && data.sorties) {
      s1.clearContents(); s2.clearContents(); s3.clearContents();
      var eRows = [["Date", "152 Vert", "152 Bleu", "152 Noir", "152 K.S", "152 K.F", "152 Gris", "124 Vert", "124 Bleu", "Notes"]];
      data.entrees.forEach(function(i) {
        eRows.push([
          i.date || "", 
          Number(i.qty152Vert)||0, 
          Number(i.qty152Bleu)||0, 
          Number(i.qty152Noir)||0, 
          Number(i.qty152KS)||0, 
          Number(i.qty152KF)||0, 
          Number(i.qty152Gris)||0, 
          Number(i.qty124Vert)||0, 
          Number(i.qty124Bleu)||0, 
          i.notes||""
        ]);
      });
      s1.getRange(1, 1, eRows.length, 10).setValues(eRows);
      
      var sRows = [["Date", "Client", "152 Vert", "152 Bleu", "152 Noir", "152 K.S", "152 K.F", "152 Gris", "124 Vert", "124 Bleu", "Montant", "Notes"]];
      data.sorties.forEach(function(i) {
        sRows.push([
          i.date || "", 
          i.client||"Client", 
          Number(i.qty152Vert)||0, 
          Number(i.qty152Bleu)||0, 
          Number(i.qty152Noir)||0, 
          Number(i.qty152KS)||0, 
          Number(i.qty152KF)||0, 
          Number(i.qty152Gris)||0, 
          Number(i.qty124Vert)||0, 
          Number(i.qty124Bleu)||0, 
          Number(i.montant)||0, 
          i.notes||""
        ]);
      });
      s2.getRange(1, 1, sRows.length, 12).setValues(sRows);
      
      var synRows = [
        ["Produit", "Total Entrées", "Total Sorties", "Stock Restant", "Statut du Stock"],
        ["152 Vert", "=SUM('Feuille 1 Entrée'!B2:B)", "=SUM('Feuille 2 Sortie'!C2:C)", "=B2-C2", '=IF(D2<=10,"⚠️ Stock Faible","✅ Disponible")'],
        ["152 Bleu", "=SUM('Feuille 1 Entrée'!C2:C)", "=SUM('Feuille 2 Sortie'!D2:D)", "=B3-C3", '=IF(D3<=10,"⚠️ Stock Faible","✅ Disponible")'],
        ["152 Noir", "=SUM('Feuille 1 Entrée'!D2:D)", "=SUM('Feuille 2 Sortie'!E2:E)", "=B4-C4", '=IF(D4<=10,"⚠️ Stock Faible","✅ Disponible")'],
        ["152 K.S", "=SUM('Feuille 1 Entrée'!E2:E)", "=SUM('Feuille 2 Sortie'!F2:F)", "=B5-C5", '=IF(D5<=10,"⚠️ Stock Faible","✅ Disponible")'],
        ["152 K.F", "=SUM('Feuille 1 Entrée'!F2:F)", "=SUM('Feuille 2 Sortie'!G2:G)", "=B6-C6", '=IF(D6<=10,"⚠️ Stock Faible","✅ Disponible")'],
        ["152 Gris", "=SUM('Feuille 1 Entrée'!G2:G)", "=SUM('Feuille 2 Sortie'!H2:H)", "=B7-C7", '=IF(D7<=10,"⚠️ Stock Faible","✅ Disponible")'],
        ["124 Vert", "=SUM('Feuille 1 Entrée'!H2:H)", "=SUM('Feuille 2 Sortie'!I2:I)", "=B8-C8", '=IF(D8<=10,"⚠️ Stock Faible","✅ Disponible")'],
        ["124 Bleu", "=SUM('Feuille 1 Entrée'!I2:I)", "=SUM('Feuille 2 Sortie'!J2:J)", "=B9-C9", '=IF(D9<=10,"⚠️ Stock Faible","✅ Disponible")'],
        ["", "", "", "", ""],
        ["Chiffre d’affaires Total", "=SUM('Feuille 2 Sortie'!K2:K)", "DZD", "", ""]
      ];
      s3.getRange(1, 1, synRows.length, 5).setValues(synRows);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.entrees.length + data.sorties.length })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleSaveWebhook = async () => {
    setIsSavingWebhook(true);
    try {
      const active = activeSpreadsheet || {
        id: '1YmMLdU0c547GqTnxmdxexRQri4Pv2ifWfFE9ogEknIc',
        title: 'Tiscobap - Gestion de Stock (152 & 124)',
        url: 'https://docs.google.com/spreadsheets/d/1YmMLdU0c547GqTnxmdxexRQri4Pv2ifWfFE9ogEknIc/edit',
      };
      await saveSharedSheetConfig(active, currentUser?.email || 'Admin', accessToken || undefined, webhookInput.trim());
      setStatusMessage({
        text: lang === 'ar' ? '✅ تم حفظ رابط Webhook بنجاح! الآن أي شخص يمكنه ملء النموذج والمزامنة بدون تسجيل دخول.' : '✅ Webhook enregistré avec succès !',
        type: 'success',
      });
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'Erreur', type: 'error' });
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleLinkSharedSheetManual = async (inputStr?: string) => {
    const raw = (typeof inputStr === 'string' ? inputStr : sharedInput).trim();
    if (!raw) {
      setStatusMessage({
        text: lang === 'ar' ? 'يرجى كتابة رابط أو معرّف (ID) ملف قوقل شيت' : 'Veuillez saisir le lien ou l’ID de la feuille',
        type: 'error',
      });
      return;
    }

    const token = accessToken || (await getAccessToken());
    if (!token) {
      setStatusMessage({
        text: lang === 'ar' ? 'يرجى تسجيل الدخول بحساب Google أولاً' : 'Veuillez vous connecter avec Google d’abord',
        type: 'error',
      });
      return;
    }

    const cleanId = extractSpreadsheetId(raw);
    setIsVerifyingShared(true);
    setStatusMessage(null);

    try {
      const meta = await getSpreadsheetMetadata(token, cleanId);
      const sheetObj = {
        id: cleanId,
        url: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
        title: meta.title || 'Feuille Google Sheets',
      };
      onSpreadsheetChange(sheetObj);
      await saveSharedSheetConfig(sheetObj, currentUser?.email || 'User', token);
      setSharedInput('');
      setStatusMessage({
        text: lang === 'ar'
          ? `✅ تم ربط ملف قوقل شيت المشترك "${sheetObj.title}" بنجاح!`
          : `✅ Feuille partagée "${sheetObj.title}" liée avec succès !`,
        type: 'success',
      });
      loadDriveFiles();
    } catch (err: any) {
      if (err?.message === 'GOOGLE_SHEET_NO_ACCESS') {
        setStatusMessage({
          text: lang === 'ar'
            ? `❌ تعذر فتح الملف: لم يتم منح بريدك (${currentUser?.email}) إذن الوصول. اطلب من صاحب الملف إضافة هذا البريد في Google Sheets (Partager / Share) مع صلاحية التعديل.`
            : `❌ Accès refusé : demandez au propriétaire de partager la feuille avec votre email (${currentUser?.email}).`,
          type: 'error',
        });
      } else {
        setStatusMessage({
          text: err.message || (lang === 'ar' ? 'تعذر التحقق من ملف Google Sheets' : 'Erreur de liaison'),
          type: 'error',
        });
      }
    } finally {
      setIsVerifyingShared(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!activeSpreadsheet) return;
    const inviteUrl = `${window.location.origin}/?sheetId=${encodeURIComponent(activeSpreadsheet.id)}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCreateNewSpreadsheet = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      setStatusMessage({
        text: lang === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Veuillez vous connecter d’abord',
        type: 'error',
      });
      return;
    }

    setIsCreatingFile(true);
    setStatusMessage(null);

    try {
      const result = await createInventorySpreadsheet(token, entrees, sorties);
      const sheetObj = {
        id: result.spreadsheetId,
        url: result.spreadsheetUrl,
        title: result.title,
      };
      onSpreadsheetChange(sheetObj);
      await saveSharedSheetConfig(sheetObj, currentUser?.email || 'User');
      setStatusMessage({
        text:
          lang === 'ar'
            ? 'تم إنشاء الملف في Google Drive بنجاح وتجهيز الأوراق الثلاث!'
            : 'Fichier Google Sheets créé avec succès !',
        type: 'success',
      });
      loadDriveFiles();
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Erreur lors de la création du fichier',
        type: 'error',
      });
    } finally {
      setIsCreatingFile(false);
    }
  };

  // Filtered files
  const filteredFiles = driveFiles.filter((f) => {
    if (fileFilter === 'shared') return f.sharedWithMe;
    if (fileFilter === 'owned') return !f.sharedWithMe;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Cloud className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {lang === 'ar' ? 'Google Sheets' : 'Google Sheets'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* User Sign-In Section */}
          {!currentUser ? (
            <div className="text-center py-6 px-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
              <div className="w-12 h-12 bg-white rounded-full shadow-xs flex items-center justify-center mx-auto text-emerald-700">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-800">
                  {lang === 'ar' ? 'تسجيل الدخول بحساب Google' : 'Connexion Google'}
                </h4>
              </div>

              {/* Official Google Sign-In Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="gsi-material-button mx-auto disabled:opacity-60 cursor-pointer"
                >
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        ></path>
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        ></path>
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        ></path>
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        ></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">
                      {isSigningIn
                        ? lang === 'ar' ? 'جاري الاتصال...' : 'Connexion...'
                        : lang === 'ar' ? 'تسجيل الدخول باستخدام Google' : 'Se connecter avec Google'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* Connected User Profile Card */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                      className="w-10 h-10 rounded-full border border-emerald-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                      {currentUser.email?.[0].toUpperCase() || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-neutral-800">
                      {currentUser.displayName || 'مستخدم Google'}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {currentUser.email}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-white text-neutral-600 hover:text-red-600 text-xs font-medium transition cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'خروج' : 'Déconnexion'}</span>
                </button>
              </div>

              {/* Team Shared Sheet Discovery Banner (if available and not already connected) */}
              {sharedTeamSheet && activeSpreadsheet?.id !== sharedTeamSheet.id && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-900">
                        {lang === 'ar' ? 'ملف المخزون المشترك للفريق متاح:' : 'Feuille d’équipe disponible :'}
                      </div>
                      <div className="text-[11px] text-blue-700 font-medium truncate max-w-xs">
                        {sharedTeamSheet.title}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLinkSharedSheetManual(sharedTeamSheet.id)}
                    disabled={isVerifyingShared}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer self-start sm:self-center"
                  >
                    {isVerifyingShared ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    <span>{lang === 'ar' ? 'ربط هذا الملف بحسابي' : 'Lier cette feuille'}</span>
                  </button>
                </div>
              )}

              {/* Active Linked Spreadsheet Card */}
              <div className="p-4 bg-white border border-neutral-200 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>{lang === 'ar' ? 'ملف Google Sheet النشط:' : 'Feuille Google Sheets liée :'}</span>
                  </div>
                  {activeSpreadsheet && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      {lang === 'ar' ? 'متصل بالمخزون' : 'Connecté'}
                    </span>
                  )}
                </div>

                {activeSpreadsheet ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                      <div className="text-xs font-semibold text-neutral-800 truncate">
                        {activeSpreadsheet.title}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono truncate mt-0.5">
                        ID: {activeSpreadsheet.id}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={activeSpreadsheet.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'فتح الملف' : 'Ouvrir'}</span>
                      </a>

                      <button
                        type="button"
                        onClick={handleCopyInviteLink}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition cursor-pointer"
                        title={lang === 'ar' ? 'نسخ رابط لمشاركته مع زملائك ليرتبطوا بنفس الملف فوراً' : 'Partager le lien avec des collègues'}
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                        <span>
                          {copiedLink
                            ? lang === 'ar' ? 'تم نسخ الرابط ✓' : 'Lien copié ✓'
                            : lang === 'ar' ? 'مشاركة الرابط للزملاء' : 'Partager lien'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCreateNewSpreadsheet}
                        disabled={isCreatingFile}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إنشاء ملف جديد' : 'Nouveau fichier'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-center py-2">
                    <button
                      type="button"
                      onClick={handleCreateNewSpreadsheet}
                      disabled={isCreatingFile}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isCreatingFile ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الإنشاء...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'إنشاء ملف مخزون جديد' : 'Créer nouveau fichier'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* 🔗 Dedicated Input to Link Shared Spreadsheet (Link or ID) */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                  <Link2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    {lang === 'ar' 
                      ? 'ربط ملف Google Sheet (رابط أو ID):' 
                      : 'Lier une feuille (Lien ou ID) :'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sharedInput}
                    onChange={(e) => setSharedInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1... أو معرّف الملف"
                    className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLinkSharedSheetManual();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleLinkSharedSheetManual()}
                    disabled={isVerifyingShared || !sharedInput.trim()}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isVerifyingShared ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    <span>{lang === 'ar' ? 'ربط الملف' : 'Lier'}</span>
                  </button>
                </div>
              </div>

              {/* 🌐 Google Apps Script Webhook */}
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                  <span className="text-base">🌐</span>
                  <span>
                    {lang === 'ar'
                      ? 'رابط Webhook (Google Apps Script):'
                      : 'URL Webhook Google Apps Script :'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSaveWebhook}
                    disabled={isSavingWebhook}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isSavingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{lang === 'ar' ? 'حفظ الرابط' : 'Enregistrer'}</span>
                  </button>
                </div>
              </div>

              {/* Auto Sync Toggle */}
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-800">
                    {lang === 'ar' ? 'المزامنة التلقائية' : 'Synchronisation automatique'}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => onToggleAutoSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Google Drive Spreadsheets List with Shared Filter */}
              {driveFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                    <div className="flex items-center gap-1.5">
                      <span>{lang === 'ar' ? 'ملفات Sheets المكتشفة:' : 'Feuilles trouvées :'}</span>
                      <span className="text-[10px] text-neutral-400 font-normal">({driveFiles.length})</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFileFilter('all')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${fileFilter === 'all' ? 'bg-emerald-100 text-emerald-800' : 'text-neutral-500 hover:bg-neutral-100'}`}
                      >
                        {lang === 'ar' ? 'الكل' : 'Tous'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFileFilter('shared')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition flex items-center gap-1 ${fileFilter === 'shared' ? 'bg-blue-100 text-blue-800' : 'text-neutral-500 hover:bg-neutral-100'}`}
                      >
                        <Users className="w-2.5 h-2.5" />
                        <span>{lang === 'ar' ? 'المشتركة معي' : 'Partagées'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={loadDriveFiles}
                        className="p-1 text-neutral-500 hover:text-neutral-800 rounded-md transition"
                        title="تحديث القائمة"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pe-1">
                    {filteredFiles.map((f) => (
                      <div
                        key={f.id}
                        onClick={async () => {
                          const sheetObj = {
                            id: f.id,
                            url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
                            title: f.name,
                          };
                          onSpreadsheetChange(sheetObj);
                          await saveSharedSheetConfig(sheetObj, currentUser?.email || 'User');
                        }}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                          activeSpreadsheet?.id === f.id
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold shadow-2xs'
                            : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="truncate">
                            <div className="truncate font-medium">{f.name}</div>
                            {f.sharedWithMe && (
                              <div className="text-[10px] text-blue-600 flex items-center gap-1 mt-0.5">
                                <Users className="w-2.5 h-2.5" />
                                <span>{lang === 'ar' ? 'مشترك معي عبر الإيميل' : 'Partagé avec moi'}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {f.sharedWithMe ? (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-semibold">
                              {lang === 'ar' ? 'مشترك 👥' : 'Partagé'}
                            </span>
                          ) : (
                            <span className="text-[9px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-md">
                              {lang === 'ar' ? 'درايف 📁' : 'Mon Drive'}
                            </span>
                          )}

                          {activeSpreadsheet?.id === f.id && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}

                    {filteredFiles.length === 0 && (
                      <div className="p-3 text-center text-xs text-neutral-400">
                        {lang === 'ar' ? 'لا توجد ملفات تطابق الفلتر' : 'Aucun fichier trouvé'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

