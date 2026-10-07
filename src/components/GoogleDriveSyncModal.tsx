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
import { directGoogleSignIn } from '../services/googleDirectAuth';
import { getGoogleClientId, isCustomClientId, saveGoogleClientId, clearGoogleClientId } from '../services/googleClientId';
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
  const [isDirectSignIn, setIsDirectSignIn] = useState(false);
  const [directMode, setDirectMode] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientIdSaved, setClientIdSaved] = useState(false);
  const [clientIdError, setClientIdError] = useState<string | null>(null);
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

  const handleSaveClientId = () => {
    setClientIdError(null);
    try {
      saveGoogleClientId(clientIdInput);
      setClientIdSaved(true);
      setDirectMode(false);
      setStatusMessage({
        text: lang === 'ar' ? 'طھظ… ط­ظپط¸ ظ…ط¹ط±ظپ ط§ظ„ط¹ظ…ظٹظ„ â€” ظٹظ…ظƒظ†ظƒ ط§ظ„ط¢ظ† ط§ظ„ط¯ط®ظˆظ„ ط§ظ„ظ…ط¨ط§ط´ط± âœ…' : 'Client ID enregistrأ© âœ…',
        type: 'success',
      });
    } catch (err: any) {
      setClientIdError(err?.message || 'ظ…ط¹ط±ظپ ط؛ظٹط± طµط§ظ„ط­');
    }
  };

  const handleDirectSignIn = async () => {
    if (!isCustomClientId()) {
      setDirectMode(true);
      setStatusMessage({
        text: lang === 'ar'
          ? 'ط£ط¯ط®ظ„ ظ…ط¹ط±ظپ ط¹ظ…ظٹظ„ Google ط§ظ„ط®ط§طµ ط¨ظƒ ط£ظˆظ„ط§ظ‹ (ط®ط·ظˆط© ظˆط§ط­ط¯ط© ظپظ‚ط·)'
          : 'Entrez votre Client ID Google dâ€™abord',
        type: 'error',
      });
      return;
    }
    setIsDirectSignIn(true);
    setStatusMessage(null);
    try {
      const result = await directGoogleSignIn();
      // Build a lightweight user object compatible with the app's User usage
      // (App only stores it; the modal displays displayName/email/photoURL).
      const pseudoUser = {
        displayName: result.profile.displayName,
        email: result.profile.email,
        photoURL: result.profile.photoURL,
      } as any;
      try {
        localStorage.setItem('stock_google_access_token_v2', JSON.stringify({
          token: result.accessToken,
          expiresAt: Date.now() + 50 * 60 * 1000,
        }));
      } catch {}
      onUserChange(pseudoUser, result.accessToken);
      setStatusMessage({
        text: lang === 'ar' ? 'طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ط§ظ„ظ…ط¨ط§ط´ط± ط¨ظ†ط¬ط§ط­! âœ…' : 'Connexion directe rأ©ussie ! âœ…',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({
        text: err.message || (lang === 'ar' ? 'ظپط´ظ„ ط§ظ„ط¯ط®ظˆظ„ ط§ظ„ظ…ط¨ط§ط´ط±' : 'أ‰chec de la connexion directe'),
        type: 'error',
      });
    } finally {
      setIsDirectSignIn(false);
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
          text: lang === 'ar' ? 'طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ط¨ظ†ط¬ط§ط­ ط¨ط­ط³ط§ط¨ Google Drive!' : 'Connexion أ  Google Drive rأ©ussie !',
          type: 'success',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: err.message || (lang === 'ar' ? 'ظپط´ظ„ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„' : 'أ‰chec de la connexion'),
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
      text: lang === 'ar' ? 'طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط®ط±ظˆط¬ ط¨ظ†ط¬ط§ط­.' : 'Dأ©connexion effectuأ©e.',
      type: 'success',
    });
  };

  const handleCreateNewSpreadsheet = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      setStatusMessage({
        text: lang === 'ar' ? 'ظٹط±ط¬ظ‰ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ط£ظˆظ„ط§ظ‹' : 'Veuillez vous connecter dâ€™abord',
        type: 'error',
      });
      return;
    }

    const confirmCreation = window.confirm(
      lang === 'ar'
        ? 'ظ‡ظ„ طھط±ط؛ط¨ ظپظٹ ط¥ظ†ط´ط§ط، ط¬ط¯ظˆظ„ Google Sheets ط¬ط¯ظٹط¯ ظپظٹ ط­ط³ط§ط¨ Google Drive ط§ظ„ط®ط§طµ ط¨ظƒ ط¨ظ€ 3 طµظپط­ط§طھ (Entrأ©e, Sortie, Synthأ¨se) ظˆظ†ظ‚ظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط­ط§ظ„ظٹط© ط¥ظ„ظٹظ‡طں'
        : 'Crأ©er une nouvelle feuille Google Sheets dans votre Google Drive avec les 3 onglets et y exporter vos donnأ©es ?'
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
            ? 'طھظ… ط¥ظ†ط´ط§ط، ط§ظ„ظ…ظ„ظپ ظپظٹ Google Drive ط¨ظ†ط¬ط§ط­ ظˆطھط¬ظ‡ظٹط² ط§ظ„ط£ظˆط±ط§ظ‚ ط§ظ„ط«ظ„ط§ط«!'
            : 'Fichier Google Sheets crأ©أ© avec succأ¨s dans votre Google Drive !',
        type: 'success',
      });
      loadDriveFiles();
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Erreur lors de la crأ©ation du fichier',
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
                {lang === 'ar' ? 'ط§ظ„ط±ط¨ط· ط¨ط­ط³ط§ط¨ Google Drive' : 'Connexion Google Drive & Sheets'}
              </h3>
              <p className="text-xs text-emerald-100">
                {lang === 'ar' ? 'ظ…ط²ط§ظ…ظ†ط© ط¬ط¯ط§ظˆظ„ ط§ظ„ظ…ط®ط²ظˆظ† ظˆط§ظ„ظ…ط¨ظٹط¹ط§طھ طھظ„ظ‚ط§ط¦ظٹط§ظ‹' : 'Synchronisation directe de vos feuilles'}
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
                  {lang === 'ar' ? 'ط§ط±ط¨ط· ط§ظ„طھط·ط¨ظٹظ‚ ط¨ط­ط³ط§ط¨ Google ط§ظ„ط®ط§طµ ط¨ظƒ' : 'Connectez votre compte Google'}
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  {lang === 'ar'
                    ? 'ظٹطھظٹط­ ظ„ظƒ ط§ظ„ط±ط¨ط· ط¥ظ†ط´ط§ط، ظ…ظ„ظپ Google Sheets ظ…ط¨ط§ط´ط±ط© ط¯ط§ط®ظ„ ط­ط³ط§ط¨ظƒ ط¹ظ„ظ‰ Google Drive ط¨طµظپط­ط§طھظ‡ ط§ظ„ط«ظ„ط§ط« ظˆطھط­ط¯ظٹط«ظ‡ط§ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ط¹ظ†ط¯ ظ…ظ„ط، ط§ظ„ظپظˆط±ظ….'
                    : 'Permet de crأ©er le fichier Google Sheets directement dans votre Drive et de synchroniser les entrأ©es et sorties en temps rأ©el.'}
                </p>
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
                      {currentUser.displayName || 'ظ…ط³طھط®ط¯ظ… Google'}
                    </div>
              <button
                onClick={handleDirectSignIn}
                disabled={isDirectSignIn || isSigningIn}
                className="w-full sm:w-auto px-6 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 mx-auto mb-3"
              >
                {isDirectSignIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#fff" opacity=".8" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#fff" opacity=".6" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                    <path fill="#fff" opacity=".6" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                {isDirectSignIn
                  ? (lang === 'ar' ? 'ط¬ط§ط± ط§ظ„ط¯ط®ظˆظ„ ط§ظ„ظ…ط¨ط§ط´ط±...' : 'Connexion directe...')
                  : (lang === 'ar' ? 'ط¯ط®ظˆظ„ ظ…ط¨ط§ط´ط± (ظ…ظˆطµظ‰ ط¨ظ‡)' : 'Connexion directe (recommandأ©)')}
              </button>
              {!isCustomClientId() ? (
                <button
                  onClick={() => { setDirectMode(!directMode); setClientIdInput(getGoogleClientId()); }}
                  className="text-xs text-emerald-700 hover:underline font-medium mb-2"
                >
                  {lang === 'ar' ? 'ط¥ط¹ط¯ط§ط¯ ظ…ط¹ط±ظپ ط¹ظ…ظٹظ„ Google ط§ظ„ط®ط§طµ ط¨ظٹ' : 'Configurer mon Client ID Google'}
                </button>
              ) : (
                <div className="text-[11px] text-emerald-700 font-medium mb-2 flex items-center justify-center gap-2">
                  <span>{lang === 'ar' ? 'ظ…ط¹ط±ظپ ط§ظ„ط¹ظ…ظٹظ„ ط§ظ„ط®ط§طµ ظ…ط­ظپظˆط¸ âœ…' : 'Client ID personnel enregistrأ© âœ…'}</span>
                  <button
                    onClick={() => { clearGoogleClientId(); setClientIdSaved(false); }}
                    className="text-neutral-400 hover:text-red-600 underline"
                  >
                    {lang === 'ar' ? 'ط¥ط²ط§ظ„ط©' : 'Retirer'}
                  </button>
                </div>
              )}
              {directMode && (
                <div className="max-w-sm mx-auto mb-3 text-start bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-emerald-900 mb-1">
                    {lang === 'ar' ? 'ظ…ط¹ط±ظپ ط¹ظ…ظٹظ„ Google (Client ID)' : 'Client ID Google'}
                  </div>
                  <div className="text-[11px] text-emerald-800/80 mb-2">
                    {lang === 'ar'
                      ? 'ظ…ظ† Google Cloud Console â†گ Credentials â†گ Create OAuth client â†گ Web â†گ ط£ط¶ظپ ط¯ظˆظ…ظٹظ† ظ…ظˆظ‚ط¹ظƒ ظپظٹ Authorized JavaScript origins ط«ظ… ط§ظ„طµظ‚ ط§ظ„ظ…ط¹ط±ظپ ظ‡ظ†ط§.'
                      : 'Google Cloud Console â†’ Credentials â†’ Create OAuth client â†’ Web â†’ ajoutez votre domaine puis collez lâ€™ID ici.'}
                  </div>
                  <input
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="xxxx.apps.googleusercontent.com"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-white text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {clientIdError && <div className="text-[11px] text-red-600 font-bold mb-2">{clientIdError}</div>}
                  <button
                    onClick={handleSaveClientId}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                  >
                    {lang === 'ar' ? 'ط­ظپط¸ ط§ظ„ظ…ط¹ط±ظپ' : 'Enregistrer'}
                  </button>
                </div>
              )}
              <div className="text-[11px] text-neutral-400 font-medium my-2">â€” {lang === 'ar' ? 'ط£ظˆ' : 'ou'} â€”</div>

                    <div className="text-[11px] text-neutral-500 font-mono">
                      {currentUser.email}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-white text-neutral-600 hover:text-red-600 text-xs font-medium transition"
                  title="طھط³ط¬ظٹظ„ ط§ظ„ط®ط±ظˆط¬"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'ط®ط±ظˆط¬' : 'Dأ©connexion'}</span>
                </button>
              </div>

              {/* Active Linked Spreadsheet Card */}
              <div className="p-4 bg-white border border-neutral-200 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>{lang === 'ar' ? 'ظ…ظ„ظپ Google Sheet ط§ظ„ظ†ط´ط·:' : 'Feuille Google Sheets liأ©e :'}</span>
                  </div>
                  {activeSpreadsheet && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      {lang === 'ar' ? 'ظ…طھطµظ„ ط¨ط§ظ„ظ…ط®ط²ظˆظ†' : 'Connectأ©'}
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
                        <span>{lang === 'ar' ? 'ظپطھط­ ط§ظ„ظ…ظ„ظپ ظپظٹ Google Sheets' : 'Ouvrir dans Google Sheets'}</span>
                      </a>

                      <button
                        onClick={handleCreateNewSpreadsheet}
                        disabled={isCreatingFile}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'ط¥ظ†ط´ط§ط، ظ…ظ„ظپ ط¢ط®ط± ط¬ط¯ظٹط¯' : 'Crأ©er un autre fichier'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-center py-3">
                    <p className="text-xs text-neutral-500">
                      {lang === 'ar'
                        ? 'ظ„ظ… ظٹطھظ… ط¥ظ†ط´ط§ط، ظ…ظ„ظپ Google Sheet ظپظٹ ط­ط³ط§ط¨ظƒ ط¨ط¹ط¯. ط§ط¶ط؛ط· ط£ط¯ظ†ط§ظ‡ ظ„ط¥ظ†ط´ط§ط¦ظ‡ ظˆظ†ظ‚ظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط¥ظ„ظٹظ‡ طھظ„ظ‚ط§ط¦ظٹط§ظ‹.'
                        : 'Aucun fichier liأ©. Cliquez ci-dessous pour crأ©er le fichier complet dans votre Google Drive.'}
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
                          <span>ط¬ط§ط±ظٹ ط§ظ„ط¥ظ†ط´ط§ط، ظپظٹ Google Drive...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'ط¥ظ†ط´ط§ط، ظ…ظ„ظپ ط§ظ„ظ…ط®ط²ظˆظ† ظپظٹ Google Drive ط§ظ„ط¢ظ†' : 'Crأ©er le fichier dans Google Drive'}</span>
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
                    {lang === 'ar' ? 'ط§ظ„ظ…ط²ط§ظ…ظ†ط© ط§ظ„طھظ„ظ‚ط§ط¦ظٹط© ظ…ط¹ Google Drive' : 'Synchronisation automatique'}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {lang === 'ar'
                      ? 'ط¥ط¶ط§ظپط© ط§ظ„ط³ط·ط± ظپظˆط±ط§ظ‹ ط¥ظ„ظ‰ ظ…ظ„ظپ Google Sheet ط¹ظ†ط¯ ط¥ط±ط³ط§ظ„ ط§ط³طھظ…ط§ط±ط© ظ‚ظˆظ‚ظ„ ظپظˆط±ظ…'
                      : 'Ajoute automatiquement la ligne dans votre Drive lors de lâ€™envoi'}
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
                    <span>{lang === 'ar' ? 'ظ…ظ„ظپط§طھ Sheets ظپظٹ ط­ط³ط§ط¨ظƒ:' : 'Feuilles trouvأ©es sur votre Drive :'}</span>
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