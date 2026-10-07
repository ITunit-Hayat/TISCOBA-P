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
  HardDrive
} from 'lucide-react';
import { User } from 'firebase/auth';
import { googleSignIn, logout, getAccessToken } from '../services/googleAuth';
import { 
  createInventorySpreadsheet, 
  listDriveSpreadsheets, 
  DriveFileInfo 
} from '../services/googleDriveSheets';
import { EntreeItem, SortieItem } from '../types/stock';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onUserChange: (user: User | null, token: string | null) => void;
  activeSpreadsheet: { id: string; url: string; title: string } | null;
  onSpreadsheetChange: (sheet: { id: string; url: string; title: string } | null) => void;
  entrees: EntreeItem[];
  sorties: SortieItem[];
  autoSync: boolean;
  onToggleAutoSync: (val: boolean) => void;
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
  lang,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
          text: lang === 'ar' ? 'تم تسجيل الدخول بنجاح بحساب Google Drive!' : 'Connexion à Google Drive réussie !',
          type: 'success',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: err.message || (lang === 'ar' ? 'فشل تسجيل الدخول' : 'Échec de la connexion'),
        type: 'error',
      });
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

  const handleCreateNewSpreadsheet = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      setStatusMessage({
        text: lang === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Veuillez vous connecter d’abord',
        type: 'error',
      });
      return;
    }

    const confirmCreation = window.confirm(
      lang === 'ar'
        ? 'هل ترغب في إنشاء جدول Google Sheets جديد في حساب Google Drive الخاص بك بـ 3 صفحات (Entrée, Sortie, Synthèse) ونقل البيانات الحالية إليه؟'
        : 'Créer une nouvelle feuille Google Sheets dans votre Google Drive avec les 3 onglets et y exporter vos données ?'
    );
    if (!confirmCreation) return;

    setIsCreatingFile(true);
    setStatusMessage(null);

    try {
      const result = await createInventorySpreadsheet(token, entrees, sorties);
      onSpreadsheetChange({
        id: result.spreadsheetId,
        url: result.spreadsheetUrl,
        title: result.title,
      });
      setStatusMessage({
        text:
          lang === 'ar'
            ? 'تم إنشاء الملف في Google Drive بنجاح وتجهيز الأوراق الثلاث!'
            : 'Fichier Google Sheets créé avec succès dans votre Google Drive !',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Cloud className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {lang === 'ar' ? 'الربط بحساب Google Drive' : 'Connexion Google Drive & Sheets'}
              </h3>
              <p className="text-xs text-emerald-100">
                {lang === 'ar' ? 'مزامنة جداول المخزون والمبيعات تلقائياً' : 'Synchronisation directe de vos feuilles'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
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
                  {lang === 'ar' ? 'اربط التطبيق بحساب Google الخاص بك' : 'Connectez votre compte Google'}
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  {lang === 'ar'
                    ? 'يتيح لك الربط إنشاء ملف Google Sheets مباشرة داخل حسابك على Google Drive بصفحاته الثلاث وتحديثها تلقائياً عند ملء الفورم.'
                    : 'Permet de créer le fichier Google Sheets directement dans votre Drive et de synchroniser les entrées et sorties en temps réel.'}
                </p>
              </div>

              {/* Official Google Sign-In Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="gsi-material-button mx-auto disabled:opacity-60"
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
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-white text-neutral-600 hover:text-red-600 text-xs font-medium transition"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'خروج' : 'Déconnexion'}</span>
                </button>
              </div>

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

                    <div className="flex flex-wrap gap-2">
                      <a
                        href={activeSpreadsheet.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'فتح الملف في Google Sheets' : 'Ouvrir dans Google Sheets'}</span>
                      </a>

                      <button
                        onClick={handleCreateNewSpreadsheet}
                        disabled={isCreatingFile}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إنشاء ملف آخر جديد' : 'Créer un autre fichier'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-center py-3">
                    <p className="text-xs text-neutral-500">
                      {lang === 'ar'
                        ? 'لم يتم إنشاء ملف Google Sheet في حسابك بعد. اضغط أدناه لإنشائه ونقل البيانات إليه تلقائياً.'
                        : 'Aucun fichier lié. Cliquez ci-dessous pour créer le fichier complet dans votre Google Drive.'}
                    </p>

                    <button
                      type="button"
                      onClick={handleCreateNewSpreadsheet}
                      disabled={isCreatingFile}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
                    >
                      {isCreatingFile ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الإنشاء في Google Drive...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'إنشاء ملف المخزون في Google Drive الآن' : 'Créer le fichier dans Google Drive'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Auto Sync Toggle */}
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-800">
                    {lang === 'ar' ? 'المزامنة التلقائية مع Google Drive' : 'Synchronisation automatique'}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {lang === 'ar'
                      ? 'إضافة السطر فوراً إلى ملف Google Sheet عند إرسال استمارة قوقل فورم'
                      : 'Ajoute automatiquement la ligne dans votre Drive lors de l’envoi'}
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

              {/* Recent Spreadsheets in Drive */}
              {driveFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                    <span>{lang === 'ar' ? 'ملفات Sheets في حسابك:' : 'Feuilles trouvées sur votre Drive :'}</span>
                    <button
                      onClick={loadDriveFiles}
                      className="text-neutral-500 hover:text-neutral-800"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 pe-1">
                    {driveFiles.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => {
                          onSpreadsheetChange({
                            id: f.id,
                            url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
                            title: f.name,
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                          activeSpreadsheet?.id === f.id
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold'
                            : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </div>
                        {activeSpreadsheet?.id === f.id && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    ))}
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
