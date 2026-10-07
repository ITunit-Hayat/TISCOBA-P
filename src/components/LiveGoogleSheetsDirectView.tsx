import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  ExternalLink, 
  Cloud, 
  CheckCircle2, 
  Plus, 
  Database,
  ArrowRight,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle,
  RotateCcw,
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { EntreeItem, SortieItem, PRODUCTS } from '../types/stock';
import { readAllSheetsData, writeAllDataToGoogleSheet, readSheetsDataFromPublicCsv, extractSpreadsheetId } from '../services/googleDriveSheets';

interface LiveGoogleSheetsDirectViewProps {
  entrees: EntreeItem[];
  sorties: SortieItem[];
  currentStock: {
    qty152Vert: number;
    qty152Bleu: number;
    qty124Vert: number;
    qty124Bleu: number;
  };
  onUpdateEntreesAndSorties: (newEntrees: EntreeItem[], newSorties: SortieItem[]) => void;
  onOpenForm: () => void;
  accessToken: string | null;
  onOpenDriveModal: () => void;
  activeSpreadsheet: { id: string; url: string; title: string } | null;
  onSpreadsheetChange?: (sheet: { id: string; url: string; title: string } | null) => void;
  lang: 'ar' | 'fr';
}

export const LiveGoogleSheetsDirectView: React.FC<LiveGoogleSheetsDirectViewProps> = ({
  entrees,
  sorties,
  currentStock,
  onUpdateEntreesAndSorties,
  onOpenForm,
  accessToken,
  onOpenDriveModal,
  activeSpreadsheet,
  onSpreadsheetChange,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'entree' | 'sortie' | 'synthese'>('entree');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Edit states
  const [editingEntree, setEditingEntree] = useState<EntreeItem | null>(null);
  const [editingSortie, setEditingSortie] = useState<SortieItem | null>(null);

  // Quick Add state (dialog right inside this view)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'entree' | 'sortie'>('entree');
  // Easy sync via public link (no login needed)
  const [publicLink, setPublicLink] = useState('');
  const [isPullingPublic, setIsPullingPublic] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [quickFormData, setQuickFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    client: '',
    qty152Vert: '',
    qty152Bleu: '',
    qty124Vert: '',
    qty124Bleu: '',
    montant: '',
    notes: '',
  });

  // Totals for Entrées
  const totalEntree152V = entrees.reduce((acc, i) => acc + (Number(i.qty152Vert) || 0), 0);
  const totalEntree152B = entrees.reduce((acc, i) => acc + (Number(i.qty152Bleu) || 0), 0);
  const totalEntree124V = entrees.reduce((acc, i) => acc + (Number(i.qty124Vert) || 0), 0);
  const totalEntree124B = entrees.reduce((acc, i) => acc + (Number(i.qty124Bleu) || 0), 0);

  // Totals for Sorties
  const totalSortie152V = sorties.reduce((acc, i) => acc + (Number(i.qty152Vert) || 0), 0);
  const totalSortie152B = sorties.reduce((acc, i) => acc + (Number(i.qty152Bleu) || 0), 0);
  const totalSortie124V = sorties.reduce((acc, i) => acc + (Number(i.qty124Vert) || 0), 0);
  const totalSortie124B = sorties.reduce((acc, i) => acc + (Number(i.qty124Bleu) || 0), 0);
  const totalMontant = sorties.reduce((acc, i) => acc + (Number(i.montant) || 0), 0);

  // Pull latest data directly from the linked Google Sheet
  const handlePullFromSheet = async () => {
    if (!activeSpreadsheet?.id || !accessToken) {
      onOpenDriveModal();
      return;
    }
    setIsSyncing(true);
    setMessage(null);
    try {
      const data = await readAllSheetsData(accessToken, activeSpreadsheet.id);
      onUpdateEntreesAndSorties(data.entrees, data.sorties);
      setMessage(
        lang === 'ar'
          ? `تم تحديث البيانات من Google Sheets بنجاح (${data.entrees.length} دخول، ${data.sorties.length} خروج).`
          : 'Données actualisées depuis Google Sheets avec succès.'
      );
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage(err.message || 'خطأ في التحديث');
    } finally {
      setIsSyncing(false);
    }
  };

  // Push all data to Google Sheet
  // Easy pull via public "Anyone with the link" CSV export (no login)
  const handlePullFromPublicLink = async () => {
    const link = publicLink.trim() || activeSpreadsheet?.url || 'https://docs.google.com/spreadsheets/d/19elAKrwk2loMHRde7sNZAA-F8XGNcWFLqVUEHLJaf6I/edit';
    setIsPullingPublic(true);
    setPublicError(null);
    setMessage(null);
    try {
      const data = await readSheetsDataFromPublicCsv(link);
      onUpdateEntreesAndSorties(data.entrees, data.sorties);
      try {
        const sid = extractSpreadsheetId(link);
        if (sid && onSpreadsheetChange) {
          onSpreadsheetChange({
            id: sid,
            url: `https://docs.google.com/spreadsheets/d/${sid}/edit`,
            title: 'Google Sheets (رابط عام)',
          });
        }
      } catch {}
      const msg = lang === 'ar'
        ? `تم سحب ${data.entrees.length} دخول و ${data.sorties.length} خروج من Google Sheets بنجاح ✅`
        : `${data.entrees.length} entrées et ${data.sorties.length} sorties importées ✅`;
      setMessage(msg);
    } catch (err: any) {
      setPublicError(err?.message || (lang === 'ar' ? 'تعذر قراءة الجدول' : 'Lecture impossible'));
    } finally {
      setIsPullingPublic(false);
    }
  };

  const handlePushToSheet = async () => {
    if (!activeSpreadsheet?.id || !accessToken) {
      onOpenDriveModal();
      return;
    }
    setIsPushing(true);
    setMessage(null);
    try {
      await writeAllDataToGoogleSheet(accessToken, activeSpreadsheet.id, entrees, sorties);
      setMessage(
        lang === 'ar'
          ? 'تم حفظ وتحديث الجدول في Google Sheets بنجاح!'
          : 'Feuille Google Sheets mise à jour avec succès !'
      );
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage(err.message || 'خطأ في الحفظ');
    } finally {
      setIsPushing(false);
    }
  };

  // Delete single Entrée row
  const handleDeleteEntree = (id: string) => {
    const confirmDelete = window.confirm(
      lang === 'ar' ? 'هل أنت متأكد من حذف هذا السجل نهائياً؟' : 'Confirmer la suppression de cette ligne ?'
    );
    if (!confirmDelete) return;

    const updated = entrees.filter((e) => e.id !== id);
    onUpdateEntreesAndSorties(updated, sorties);
    setMessage(lang === 'ar' ? 'تم حذف السجل بنجاح.' : 'Ligne supprimée.');
    setTimeout(() => setMessage(null), 3000);
  };

  // Delete single Sortie row
  const handleDeleteSortie = (id: string) => {
    const confirmDelete = window.confirm(
      lang === 'ar' ? 'هل أنت متأكد من حذف هذا السجل نهائياً؟' : 'Confirmer la suppression de cette ligne ?'
    );
    if (!confirmDelete) return;

    const updated = sorties.filter((s) => s.id !== id);
    onUpdateEntreesAndSorties(entrees, updated);
    setMessage(lang === 'ar' ? 'تم حذف سجل المبيعات بنجاح.' : 'Ligne supprimée.');
    setTimeout(() => setMessage(null), 3000);
  };

  // Save edited Entrée
  const handleSaveEditEntree = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntree) return;

    const updated = entrees.map((item) =>
      item.id === editingEntree.id ? editingEntree : item
    );
    onUpdateEntreesAndSorties(updated, sorties);
    setEditingEntree(null);
    setMessage(lang === 'ar' ? 'تم تعديل السجل بنجاح!' : 'Ligne modifiée avec succès !');
    setTimeout(() => setMessage(null), 3000);
  };

  // Save edited Sortie
  const handleSaveEditSortie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSortie) return;

    const updated = sorties.map((item) =>
      item.id === editingSortie.id ? editingSortie : item
    );
    onUpdateEntreesAndSorties(entrees, updated);
    setEditingSortie(null);
    setMessage(lang === 'ar' ? 'تم تعديل سجل المبيعات بنجاح!' : 'Ligne modifiée avec succès !');
    setTimeout(() => setMessage(null), 3000);
  };

  // Submit Quick Add Form
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q152V = Number(quickFormData.qty152Vert) || 0;
    const q152B = Number(quickFormData.qty152Bleu) || 0;
    const q124V = Number(quickFormData.qty124Vert) || 0;
    const q124B = Number(quickFormData.qty124Bleu) || 0;

    if (quickAddType === 'entree') {
      const newItem: EntreeItem = {
        id: `entree-${Date.now()}`,
        date: quickFormData.date,
        qty152Vert: q152V,
        qty152Bleu: q152B,
        qty124Vert: q124V,
        qty124Bleu: q124B,
        notes: quickFormData.notes,
      };
      onUpdateEntreesAndSorties([newItem, ...entrees], sorties);
      setActiveTab('entree');
      setMessage(lang === 'ar' ? 'تمت إضافة سطر الوارد بنجاح!' : 'Entrée ajoutée avec succès !');
    } else {
      const newItem: SortieItem = {
        id: `sortie-${Date.now()}`,
        date: quickFormData.date,
        client: quickFormData.client.trim() || 'Client',
        qty152Vert: q152V,
        qty152Bleu: q152B,
        qty124Vert: q124V,
        qty124Bleu: q124B,
        montant: Number(quickFormData.montant) || 0,
        notes: quickFormData.notes,
      };
      onUpdateEntreesAndSorties(entrees, [newItem, ...sorties]);
      setActiveTab('sortie');
      setMessage(lang === 'ar' ? 'تمت إضافة سطر المبيعات بنجاح!' : 'Sortie ajoutée avec succès !');
    }

    setIsQuickAddOpen(false);
    setQuickFormData({
      date: new Date().toISOString().split('T')[0],
      client: '',
      qty152Vert: '',
      qty152Bleu: '',
      qty124Vert: '',
      qty124Bleu: '',
      montant: '',
      notes: '',
    });
    setTimeout(() => setMessage(null), 3000);
  };

  // Clear all data
  const handleClearAll = () => {
    const confirmClear = window.confirm(
      lang === 'ar'
        ? '⚠️ هل أنت متأكد من رغبتك في محو جميع البيانات بالكامل وتصفير جميع السجلات؟'
        : 'Effacer toutes les données des tableaux et réinitialiser le stock ?'
    );
    if (!confirmClear) return;
    onUpdateEntreesAndSorties([], []);
    setMessage(lang === 'ar' ? 'تم محو جميع السجلات وتصفير المخزون بنجاح.' : 'Toutes les données ont été effacées.');
    setTimeout(() => setMessage(null), 3000);
  };

  // Clear Entrées only
  const handleClearEntreesOnly = () => {
    const confirmClear = window.confirm(
      lang === 'ar'
        ? '⚠️ هل أنت متأكد من رغبتك في محو جميع سجلات ورقة الوارد (Feuille 1 Entrée)؟'
        : 'Effacer toutes les entrées ?'
    );
    if (!confirmClear) return;
    onUpdateEntreesAndSorties([], sorties);
    setMessage(lang === 'ar' ? 'تم محو جميع سجلات الوارد.' : 'Entrées effacées.');
    setTimeout(() => setMessage(null), 3000);
  };

  // Clear Sorties only
  const handleClearSortiesOnly = () => {
    const confirmClear = window.confirm(
      lang === 'ar'
        ? '⚠️ هل أنت متأكد من رغبتك في محو جميع سجلات ورقة المبيعات (Feuille 2 Sortie)؟'
        : 'Effacer toutes les sorties ?'
    );
    if (!confirmClear) return;
    onUpdateEntreesAndSorties(entrees, []);
    setMessage(lang === 'ar' ? 'تم محو جميع سجلات المبيعات.' : 'Sorties effacées.');
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-16">
      {/* 1. Live Stock Cards Banner */}
      <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-700" />
            <h2 className="text-base font-bold text-neutral-900">
              {lang === 'ar' ? 'المخزون المتوفر حالياً (Stock Restant)' : 'Stock disponible en magasin'}
            </h2>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-800 font-semibold px-2.5 py-1 rounded-full">
            {lang === 'ar' ? 'حساب تلقائي مباشر' : 'Mise à jour en direct'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-xl p-3 text-center">
            <div className="text-xs font-bold text-emerald-800">152 Vert (أخضر)</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{currentStock.qty152Vert}</div>
            <div className="text-[10px] text-emerald-600 font-medium">
              +{totalEntree152V} وارد / -{totalSortie152V} صادر
            </div>
          </div>

          <div className="bg-blue-50/70 border-2 border-blue-300 rounded-xl p-3 text-center">
            <div className="text-xs font-bold text-blue-800">152 Bleu (أزرق)</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{currentStock.qty152Bleu}</div>
            <div className="text-[10px] text-blue-600 font-medium">
              +{totalEntree152B} وارد / -{totalSortie152B} صادر
            </div>
          </div>

          <div className="bg-teal-50/70 border-2 border-teal-300 rounded-xl p-3 text-center">
            <div className="text-xs font-bold text-teal-800">124 Vert (أخضر)</div>
            <div className="text-2xl font-black text-teal-700 mt-1">{currentStock.qty124Vert}</div>
            <div className="text-[10px] text-teal-600 font-medium">
              +{totalEntree124V} وارد / -{totalSortie124V} صادر
            </div>
          </div>

          <div className="bg-sky-50/70 border-2 border-sky-300 rounded-xl p-3 text-center">
            <div className="text-xs font-bold text-sky-800">124 Bleu (أزرق)</div>
            <div className="text-2xl font-black text-sky-700 mt-1">{currentStock.qty124Bleu}</div>
            <div className="text-[10px] text-sky-600 font-medium">
              +{totalEntree124B} وارد / -{totalSortie124B} صادر
            </div>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-amber-50/80 border-2 border-amber-300 rounded-xl p-3 text-center flex flex-col justify-center">
            <div className="text-xs font-bold text-amber-800">
              {lang === 'ar' ? 'إجمالي المداخيل' : 'Chiffre d’affaires'}
            </div>
            <div className="text-lg font-black text-amber-900 mt-1">
              {totalMontant.toLocaleString()}
            </div>
            <div className="text-[10px] text-amber-700 font-semibold">DZD / دينار</div>
          </div>
        </div>
      </div>

      {/* 2. Top Action Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Main Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Add Entrée Button */}
          <button
            type="button"
            onClick={() => {
      {/* 0. Easy Sync via public link (no login needed) */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-emerald-700" />
          <h3 className="font-bold text-emerald-900 text-sm sm:text-base">
            {lang === 'ar' ? 'مزامنة سهلة بدون تسجيل دخول' : 'Synchronisation facile (sans connexion)'}
          </h3>
        </div>
        <p className="text-xs text-emerald-800/80 mb-3">
          {lang === 'ar'
            ? 'شارك الجدول كـ «أي شخص لديه الرابط: عارض» ثم الصق الرابط واضغط سحب — تصل بيانات الدخول والخروج فورا.'
            : 'Partagez le fichier «Toute personne disposant du lien: Lecteur», collez le lien puis importez.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={publicLink}
            onChange={(e) => setPublicLink(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            dir="ltr"
            className="flex-1 px-3 py-2.5 rounded-xl border border-emerald-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handlePullFromPublicLink}
            disabled={isPullingPublic}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isPullingPublic ? 'animate-spin' : ''}`} />
            {isPullingPublic
              ? (lang === 'ar' ? 'جار السحب...' : 'Import...')
              : (lang === 'ar' ? 'سحب من الرابط' : 'Importer du lien')}
          </button>
        </div>
        {publicError && (
          <div className="mt-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {publicError}
          </div>
        )}
      </div>

              setQuickAddType('entree');
              setIsQuickAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? '➕ إضافة وارد (Entrée)' : '➕ Ajouter Entrée'}</span>
          </button>

          {/* Add Sortie Button */}
          <button
            type="button"
            onClick={() => {
              setQuickAddType('sortie');
              setIsQuickAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? '➕ إضافة مبيعات (Sortie)' : '➕ Ajouter Sortie'}</span>
          </button>

          {/* Clear All Data Button */}
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border-2 border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition cursor-pointer"
            title="محو جميع السجلات وتصفير المخزون بالكامل"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span>{lang === 'ar' ? '🗑️ محو جميع البيانات' : 'Tout effacer'}</span>
          </button>

          {/* Push to Google Sheets */}
          {activeSpreadsheet ? (
            <button
              type="button"
              onClick={handlePushToSheet}
              disabled={isPushing}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
              title="حفظ ومزامنة كامل الجدول مع Google Sheets"
            >
              <Database className="w-4 h-4" />
              <span>{isPushing ? (lang === 'ar' ? 'جاري الحفظ...' : 'Enregistrement...') : (lang === 'ar' ? '💾 حفظ في Google Sheets' : '💾 Enregistrer dans Sheets')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenDriveModal}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              <span>{lang === 'ar' ? 'ربط Google Drive' : 'Lier Google Drive'}</span>
            </button>
          )}

          {/* Pull from Google Sheets */}
          {activeSpreadsheet && (
            <button
              type="button"
              onClick={handlePullFromSheet}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition cursor-pointer"
              title="تحديث البيانات من قوقل شيت"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{lang === 'ar' ? 'تحديث' : 'Actualiser'}</span>
            </button>
          )}
        </div>

        {/* Right: Drive Status Pill */}
        <div className="flex items-center gap-2">
          {activeSpreadsheet && (
            <a
              href={activeSpreadsheet.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold hover:bg-emerald-100 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="truncate max-w-[150px]">{activeSpreadsheet.title}</span>
              <ExternalLink className="w-3 h-3 text-emerald-500" />
            </a>
          )}
        </div>
      </div>

      {/* Message notification */}
      {message && (
        <div className="p-3.5 bg-emerald-50 text-emerald-900 rounded-xl text-xs font-medium border border-emerald-200 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
          {activeSpreadsheet && (
            <button
              onClick={handlePushToSheet}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'حفظ في Google Sheets الآن ⬅️' : 'Mettre à jour Google Sheets'}
            </button>
          )}
        </div>
      )}

      {/* 3. Table Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="bg-neutral-100/70 p-2 flex items-center gap-2 border-b border-neutral-200 overflow-x-auto">
          {/* Tab 1: Entrée */}
          <button
            onClick={() => setActiveTab('entree')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === 'entree'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>{lang === 'ar' ? '📥 ورقة الوارد (Feuille 1 Entrée)' : 'Feuille 1 Entrée'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === 'entree' ? 'bg-purple-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
              {entrees.length}
            </span>
          </button>

          {/* Tab 2: Sortie */}
          <button
            onClick={() => setActiveTab('sortie')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === 'sortie'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>{lang === 'ar' ? '📤 ورقة المبيعات (Feuille 2 Sortie)' : 'Feuille 2 Sortie'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${activeTab === 'sortie' ? 'bg-blue-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
              {sorties.length}
            </span>
          </button>

          {/* Tab 3: Synthèse */}
          <button
            onClick={() => setActiveTab('synthese')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === 'synthese'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{lang === 'ar' ? '📊 جدول الحصيلة (Feuille 3 Synthèse)' : 'Feuille 3 Synthèse'}</span>
          </button>
        </div>

        {/* Tab Content: Feuille 1 Entrée */}
        {activeTab === 'entree' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                <span>{lang === 'ar' ? 'سجلات دخول السلع والمشتريات (Feuille 1 Entrée)' : 'Historique des Entrées'}</span>
              </h3>
              <div className="flex items-center gap-2">
                {entrees.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearEntreesOnly}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition cursor-pointer"
                    title="محو جميع سجلات الوارد"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>{lang === 'ar' ? 'محو سجلات الوارد' : 'Vider entrées'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddType('entree');
                    setIsQuickAddOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? '➕ إضافة وارد' : 'Ajouter entrée'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-purple-50/80 text-purple-950 font-bold border-b border-purple-200 text-center">
                    <th className="p-3 text-start border-e border-purple-200">{lang === 'ar' ? 'التاريخ (Date)' : 'Date'}</th>
                    <th className="p-3 border-e border-purple-200 text-emerald-800">152 Vert</th>
                    <th className="p-3 border-e border-purple-200 text-blue-800">152 Bleu</th>
                    <th className="p-3 border-e border-purple-200 text-teal-800">124 Vert</th>
                    <th className="p-3 border-e border-purple-200 text-sky-800">124 Bleu</th>
                    <th className="p-3 text-start border-e border-purple-200">{lang === 'ar' ? 'الملاحظات' : 'Notes'}</th>
                    <th className="p-3 text-center bg-purple-100/80 min-w-[160px] font-extrabold">{lang === 'ar' ? 'إجراءات السجل' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {entrees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-neutral-400 text-xs">
                        {lang === 'ar' ? 'لا توجد سجلات وارد حتى الآن. اضغط على زر "إضافة سطر جديد" أعلاه.' : 'Aucune entrée. Cliquez sur "Ajouter une ligne".'}
                      </td>
                    </tr>
                  ) : (
                    entrees.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50 transition">
                        <td className="p-3 border-e border-neutral-200 font-semibold text-neutral-800">{item.date}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-emerald-700 bg-emerald-50/20">{item.qty152Vert || '-'}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-blue-700 bg-blue-50/20">{item.qty152Bleu || '-'}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-teal-700 bg-teal-50/20">{item.qty124Vert || '-'}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-sky-700 bg-sky-50/20">{item.qty124Bleu || '-'}</td>
                        <td className="p-3 border-e border-neutral-200 text-neutral-600 text-xs truncate max-w-xs">{item.notes || '-'}</td>
                        
                        {/* High-visibility Action Buttons */}
                        <td className="p-2.5 text-center bg-neutral-50/50">
                          <div className="flex items-center justify-center gap-2">
                            {/* Big EDIT Button */}
                            <button
                              type="button"
                              onClick={() => setEditingEntree({ ...item })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'تعديل' : 'Modifier'}</span>
                            </button>

                            {/* Big DELETE Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteEntree(item.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'حذف' : 'Supprimer'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {entrees.length > 0 && (
                  <tfoot>
                    <tr className="bg-neutral-100 font-bold text-neutral-900 border-t-2 border-neutral-300">
                      <td className="p-3 border-e border-neutral-200">{lang === 'ar' ? 'الإجمالي (TOTAL)' : 'TOTAL'}</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-emerald-800 font-extrabold text-sm">{totalEntree152V}</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-blue-800 font-extrabold text-sm">{totalEntree152B}</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-teal-800 font-extrabold text-sm">{totalEntree124V}</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-sky-800 font-extrabold text-sm">{totalEntree124B}</td>
                      <td className="p-3 border-e border-neutral-200 text-neutral-500 font-medium">{entrees.length} عمليات وارد</td>
                      <td className="p-3 text-center"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Feuille 2 Sortie */}
        {activeTab === 'sortie' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>{lang === 'ar' ? 'سجلات المبيعات وخروج البضاعة (Feuille 2 Sortie)' : 'Historique des Sorties'}</span>
              </h3>
              <div className="flex items-center gap-2">
                {sorties.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSortiesOnly}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition cursor-pointer"
                    title="محو جميع سجلات المبيعات"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>{lang === 'ar' ? 'محو سجلات المبيعات' : 'Vider sorties'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddType('sortie');
                    setIsQuickAddOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? '➕ إضافة بيع' : 'Ajouter sortie'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-blue-50/80 text-blue-950 font-bold border-b border-blue-200 text-center">
                    <th className="p-3 text-start border-e border-blue-200">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3 text-start border-e border-blue-200">{lang === 'ar' ? 'العميل (Client)' : 'Client'}</th>
                    <th className="p-3 border-e border-blue-200 text-emerald-800">152 Vert</th>
                    <th className="p-3 border-e border-blue-200 text-blue-800">152 Bleu</th>
                    <th className="p-3 border-e border-blue-200 text-teal-800">124 Vert</th>
                    <th className="p-3 border-e border-blue-200 text-sky-800">124 Bleu</th>
                    <th className="p-3 border-e border-blue-200 font-bold">{lang === 'ar' ? 'المبلغ (Montant)' : 'Montant'}</th>
                    <th className="p-3 text-center bg-blue-100/80 min-w-[160px] font-extrabold">{lang === 'ar' ? 'إجراءات السجل' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {sorties.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-neutral-400 text-xs">
                        {lang === 'ar' ? 'لا توجد مبيعات مسجلة حتى الآن. اضغط على زر "إضافة سطر جديد" أعلاه.' : 'Aucune sortie enregistrée.'}
                      </td>
                    </tr>
                  ) : (
                    sorties.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50 transition">
                        <td className="p-3 border-e border-neutral-200 font-semibold text-neutral-800">{item.date}</td>
                        <td className="p-3 border-e border-neutral-200 font-bold text-neutral-900">{item.client}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-emerald-700 bg-emerald-50/20">{item.qty152Vert || '-'}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-blue-700 bg-blue-50/20">{item.qty152Bleu || '-'}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-teal-700 bg-teal-50/20">{item.qty124Vert || '-'}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-sky-700 bg-sky-50/20">{item.qty124Bleu || '-'}</td>
                        <td className="p-3 border-e border-neutral-200 text-center font-extrabold text-neutral-900 bg-amber-50/40">
                          {item.montant ? `${item.montant.toLocaleString()} DZD` : '0 DZD'}
                        </td>
                        
                        {/* High-visibility Action Buttons */}
                        <td className="p-2.5 text-center bg-neutral-50/50">
                          <div className="flex items-center justify-center gap-2">
                            {/* Big EDIT Button */}
                            <button
                              type="button"
                              onClick={() => setEditingSortie({ ...item })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'تعديل' : 'Modifier'}</span>
                            </button>

                            {/* Big DELETE Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSortie(item.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'حذف' : 'Supprimer'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {sorties.length > 0 && (
                  <tfoot>
                    <tr className="bg-neutral-100 font-bold text-neutral-900 border-t-2 border-neutral-300">
                      <td className="p-3 border-e border-neutral-200">{lang === 'ar' ? 'الإجمالي (TOTAL)' : 'TOTAL'}</td>
                      <td className="p-3 border-e border-neutral-200 text-neutral-600 font-medium">{sorties.length} مبيعات</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-emerald-800 font-extrabold text-sm">{totalSortie152V}</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-blue-800 font-extrabold text-sm">{totalSortie152B}</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-teal-800 font-extrabold text-sm">{totalSortie124V}</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-sky-800 font-extrabold text-sm">{totalSortie124B}</td>
                      <td className="p-3 border-e border-neutral-200 text-center text-amber-900 font-black text-sm">{totalMontant.toLocaleString()} DZD</td>
                      <td className="p-3 text-center"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Feuille 3 Synthèse */}
        {activeTab === 'synthese' && (
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>{lang === 'ar' ? 'جدول الحصيلة ورصيد المخزون المتبقي (Feuille 3 Synthèse)' : 'Synthèse & Balance du Stock'}</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-emerald-50/80 text-emerald-950 font-bold border-b border-emerald-200">
                    <th className="p-3 border-e border-emerald-200 text-start">{lang === 'ar' ? 'رمز الصنف' : 'Produit'}</th>
                    <th className="p-3 border-e border-emerald-200 text-center bg-purple-50 text-purple-900">
                      {lang === 'ar' ? 'إجمالي الوارد (Entrées)' : 'Total Entrées'}
                    </th>
                    <th className="p-3 border-e border-emerald-200 text-center bg-blue-50 text-blue-900">
                      {lang === 'ar' ? 'إجمالي الصادر (Sorties)' : 'Total Sorties'}
                    </th>
                    <th className="p-3 border-e border-emerald-200 text-center bg-emerald-100 text-emerald-950 font-black text-sm">
                      {lang === 'ar' ? 'المخزون المتبقي (Stock Restant)' : 'Stock Restant'}
                    </th>
                    <th className="p-3 text-center">{lang === 'ar' ? 'حالة المخزون' : 'Statut'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {PRODUCTS.map((prod) => {
                    let totalIn = 0;
                    let totalOut = 0;
                    let stock = 0;

                    if (prod.key === '152_vert') {
                      totalIn = totalEntree152V;
                      totalOut = totalSortie152V;
                      stock = currentStock.qty152Vert;
                    } else if (prod.key === '152_bleu') {
                      totalIn = totalEntree152B;
                      totalOut = totalSortie152B;
                      stock = currentStock.qty152Bleu;
                    } else if (prod.key === '124_vert') {
                      totalIn = totalEntree124V;
                      totalOut = totalSortie124V;
                      stock = currentStock.qty124Vert;
                    } else {
                      totalIn = totalEntree124B;
                      totalOut = totalSortie124B;
                      stock = currentStock.qty124Bleu;
                    }

                    return (
                      <tr key={prod.key} className="hover:bg-neutral-50 transition">
                        <td className="p-3 border-e border-neutral-200 font-bold text-neutral-900 flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: prod.colorHex }} />
                          <span className="text-sm">{prod.code}</span>
                          <span className="text-xs text-neutral-400 font-normal">({prod.nameAr})</span>
                        </td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-purple-800 bg-purple-50/30 text-sm">
                          {totalIn}
                        </td>
                        <td className="p-3 border-e border-neutral-200 text-center font-bold text-blue-800 bg-blue-50/30 text-sm">
                          {totalOut}
                        </td>
                        <td className="p-3 border-e border-neutral-200 text-center font-black text-base bg-emerald-50 text-emerald-900">
                          {stock}
                        </td>
                        <td className="p-3 text-center">
                          {stock > 10 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-100 font-bold px-3 py-1 rounded-full text-xs">
                              ✅ {lang === 'ar' ? 'متوفر' : 'Disponible'}
                            </span>
                          ) : stock > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 font-bold px-3 py-1 rounded-full text-xs">
                              ⚠️ {lang === 'ar' ? 'مخزون منخفض' : 'Stock Faible'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-800 bg-red-100 font-bold px-3 py-1 rounded-full text-xs">
                              ❌ {lang === 'ar' ? 'منتهي (0)' : 'Épuisé'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center justify-between">
              <span className="text-sm font-bold text-amber-950">
                {lang === 'ar' ? 'إجمالي المداخيل والمبيعات المسجلة:' : 'Chiffre d’affaires total :'}
              </span>
              <span className="text-xl font-black text-amber-900">
                {totalMontant.toLocaleString()} DZD
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Modal: Quick Add Row (Simple & Straightforward) */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {lang === 'ar' ? 'إضافة سطر جديد' : 'Ajouter une ligne'}
                </h3>
              </div>
              <button
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="p-6 space-y-4">
              {/* Choice: Entrée or Sortie */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-2">
                  {lang === 'ar' ? 'اختر نوع الحركة:' : 'Type d’opération :'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setQuickAddType('entree')}
                    className={`p-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                      quickAddType === 'entree'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-xs'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-purple-600" />
                    <span>{lang === 'ar' ? '📥 وارد (Entrée) للمستودع' : 'Entrée de stock'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickAddType('sortie')}
                    className={`p-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                      quickAddType === 'sortie'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-blue-600" />
                    <span>{lang === 'ar' ? '📤 خروج / بيع (Sortie)' : 'Vente / Sortie'}</span>
                  </button>
                </div>
              </div>

              {/* Date & (Client if Sortie) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    {lang === 'ar' ? 'التاريخ' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    required
                    value={quickFormData.date}
                    onChange={(e) => setQuickFormData({ ...quickFormData, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                {quickAddType === 'sortie' && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      {lang === 'ar' ? 'اسم العميل / الزبون' : 'Nom du client'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'ar' ? 'مثال: شركة النور' : 'Client...'}
                      value={quickFormData.client}
                      onChange={(e) => setQuickFormData({ ...quickFormData, client: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}
              </div>

              {/* 4 Quantities */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  {lang === 'ar' ? 'الكميات (أدخل كمية صنف واحد على الأقل):' : 'Quantités :'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-200">
                    <label className="block text-[11px] font-bold text-emerald-800 mb-1">152 Vert</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quickFormData.qty152Vert}
                      onChange={(e) => setQuickFormData({ ...quickFormData, qty152Vert: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>

                  <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-200">
                    <label className="block text-[11px] font-bold text-blue-800 mb-1">152 Bleu</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quickFormData.qty152Bleu}
                      onChange={(e) => setQuickFormData({ ...quickFormData, qty152Bleu: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>

                  <div className="bg-teal-50/50 p-2 rounded-xl border border-teal-200">
                    <label className="block text-[11px] font-bold text-teal-800 mb-1">124 Vert</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quickFormData.qty124Vert}
                      onChange={(e) => setQuickFormData({ ...quickFormData, qty124Vert: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>

                  <div className="bg-sky-50/50 p-2 rounded-xl border border-sky-200">
                    <label className="block text-[11px] font-bold text-sky-800 mb-1">124 Bleu</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quickFormData.qty124Bleu}
                      onChange={(e) => setQuickFormData({ ...quickFormData, qty124Bleu: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Montant (if Sortie) */}
              {quickAddType === 'sortie' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    {lang === 'ar' ? 'المبلغ الإجمالي (DZD)' : 'Montant total (DZD)'} *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={quickFormData.montant}
                    onChange={(e) => setQuickFormData({ ...quickFormData, montant: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 font-bold text-neutral-800"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  {lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'ملاحظة أو رقم الفاتورة...' : 'Notes...'}
                  value={quickFormData.notes}
                  onChange={(e) => setQuickFormData({ ...quickFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-purple-700 hover:bg-purple-800 text-white shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حفظ وإضافة إلى الجدول' : 'Ajouter au tableau'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Edit Entrée */}
      {editingEntree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                <h3 className="font-bold text-sm">
                  {lang === 'ar' ? 'تعديل سطر الوارد (Entrée)' : 'Modifier la ligne Entrée'}
                </h3>
              </div>
              <button
                onClick={() => setEditingEntree(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditEntree} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  {lang === 'ar' ? 'التاريخ' : 'Date'}
                </label>
                <input
                  type="date"
                  required
                  value={editingEntree.date}
                  onChange={(e) => setEditingEntree({ ...editingEntree, date: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                  <label className="block text-xs font-bold text-emerald-800 mb-1">152 Vert</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEntree.qty152Vert}
                    onChange={(e) => setEditingEntree({ ...editingEntree, qty152Vert: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-bold"
                  />
                </div>
                <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
                  <label className="block text-xs font-bold text-blue-800 mb-1">152 Bleu</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEntree.qty152Bleu}
                    onChange={(e) => setEditingEntree({ ...editingEntree, qty152Bleu: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-bold"
                  />
                </div>
                <div className="bg-teal-50/50 p-2.5 rounded-xl border border-teal-200">
                  <label className="block text-xs font-bold text-teal-800 mb-1">124 Vert</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEntree.qty124Vert}
                    onChange={(e) => setEditingEntree({ ...editingEntree, qty124Vert: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-bold"
                  />
                </div>
                <div className="bg-sky-50/50 p-2.5 rounded-xl border border-sky-200">
                  <label className="block text-xs font-bold text-sky-800 mb-1">124 Bleu</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEntree.qty124Bleu}
                    onChange={(e) => setEditingEntree({ ...editingEntree, qty124Bleu: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  {lang === 'ar' ? 'ملاحظات' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={editingEntree.notes || ''}
                  onChange={(e) => setEditingEntree({ ...editingEntree, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingEntree(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-purple-700 hover:bg-purple-800 text-white flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'حفظ التعديل' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Edit Sortie */}
      {editingSortie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-blue-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                <h3 className="font-bold text-sm">
                  {lang === 'ar' ? 'تعديل سطر المبيعات (Sortie)' : 'Modifier la ligne Sortie'}
                </h3>
              </div>
              <button
                onClick={() => setEditingSortie(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSortie} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    {lang === 'ar' ? 'التاريخ' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={editingSortie.date}
                    onChange={(e) => setEditingSortie({ ...editingSortie, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    {lang === 'ar' ? 'العميل (Client)' : 'Client'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSortie.client}
                    onChange={(e) => setEditingSortie({ ...editingSortie, client: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                  <label className="block text-xs font-bold text-emerald-800 mb-1">152 Vert</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSortie.qty152Vert}
                    onChange={(e) => setEditingSortie({ ...editingSortie, qty152Vert: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-bold"
                  />
                </div>
                <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
                  <label className="block text-xs font-bold text-blue-800 mb-1">152 Bleu</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSortie.qty152Bleu}
                    onChange={(e) => setEditingSortie({ ...editingSortie, qty152Bleu: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-bold"
                  />
                </div>
                <div className="bg-teal-50/50 p-2.5 rounded-xl border border-teal-200">
                  <label className="block text-xs font-bold text-teal-800 mb-1">124 Vert</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSortie.qty124Vert}
                    onChange={(e) => setEditingSortie({ ...editingSortie, qty124Vert: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-bold"
                  />
                </div>
                <div className="bg-sky-50/50 p-2.5 rounded-xl border border-sky-200">
                  <label className="block text-xs font-bold text-sky-800 mb-1">124 Bleu</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSortie.qty124Bleu}
                    onChange={(e) => setEditingSortie({ ...editingSortie, qty124Bleu: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  {lang === 'ar' ? 'المبلغ الإجمالي (DZD)' : 'Montant total (DZD)'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={editingSortie.montant}
                  onChange={(e) => setEditingSortie({ ...editingSortie, montant: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 font-black text-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  {lang === 'ar' ? 'ملاحظات' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={editingSortie.notes || ''}
                  onChange={(e) => setEditingSortie({ ...editingSortie, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingSortie(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'حفظ التعديل' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
