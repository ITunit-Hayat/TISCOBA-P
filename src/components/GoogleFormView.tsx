import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  RotateCcw, 
  Layers, 
  Calendar, 
  User, 
  DollarSign, 
  Package, 
  AlertTriangle,
  Sparkles,
  FileSpreadsheet,
  Cloud,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Save,
  Plus
} from 'lucide-react';
import { EntreeItem, SortieItem, PRODUCTS } from '../types/stock';

interface GoogleFormViewProps {
  startPage?: 1 | 2;
  currentStock: {
    qty152Vert: number;
    qty152Bleu: number;
    qty124Vert: number;
    qty124Bleu: number;
  };
  entrees: EntreeItem[];
  sorties: SortieItem[];
  onAddEntree: (item: Omit<EntreeItem, 'id'>) => void;
  onAddSortie: (item: Omit<SortieItem, 'id'>) => void;
  onEditEntree: (item: EntreeItem) => void;
  onDeleteEntree: (id: string) => void;
  onEditSortie: (item: SortieItem) => void;
  onDeleteSortie: (id: string) => void;
  onClearAllData: () => void;
  onGoToSheets: () => void;
  onOpenDriveModal?: () => void;
  isDriveConnected?: boolean;
  activeSpreadsheetUrl?: string | null;
  lang: 'ar' | 'fr';
}

export const GoogleFormView: React.FC<GoogleFormViewProps> = ({
  startPage = 1,
  currentStock,
  entrees,
  sorties,
  onAddEntree,
  onAddSortie,
  onEditEntree,
  onDeleteEntree,
  onEditSortie,
  onDeleteSortie,
  onClearAllData,
  onGoToSheets,
  onOpenDriveModal,
  isDriveConnected,
  activeSpreadsheetUrl,
  lang,
}) => {
  // Page 1 = Feuille 1 Entrée, Page 2 = Feuille 2 Sortie
  const [currentPage, setCurrentPage] = useState<1 | 2>(startPage);

  useEffect(() => {
    setCurrentPage(startPage);
    setSubmitted(null);
    setValidationError(null);
  }, [startPage]);
  const [submitted, setSubmitted] = useState<null | 'entree' | 'sortie'>(null);

  // Form State - Entrée (Page 1)
  const [entreeData, setEntreeData] = useState({
    date: new Date().toISOString().split('T')[0],
    qty152Vert: '',
    qty152Bleu: '',
    qty124Vert: '',
    qty124Bleu: '',
    notes: '',
  });

  // Form State - Sortie (Page 2)
  const [sortieData, setSortieData] = useState({
    date: new Date().toISOString().split('T')[0],
    client: '',
    qty152Vert: '',
    qty152Bleu: '',
    qty124Vert: '',
    qty124Bleu: '',
    montant: '',
    notes: '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  // Edit states & messages for direct editing inside GoogleFormView
  const [editingEntree, setEditingEntree] = useState<EntreeItem | null>(null);
  const [editingSortie, setEditingSortie] = useState<SortieItem | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [recordsTab, setRecordsTab] = useState<'current' | 'entree' | 'sortie'>('current');

  const handleDeleteEntreeWithConfirm = (id: string) => {
    const ok = window.confirm(
      lang === 'ar' ? 'هل أنت متأكد من حذف هذا السجل نهائياً؟' : 'Supprimer cet enregistrement définitivement ?'
    );
    if (!ok) return;
    onDeleteEntree(id);
    setActionMessage(lang === 'ar' ? 'تم حذف السجل بنجاح.' : 'Ligne supprimée.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleDeleteSortieWithConfirm = (id: string) => {
    const ok = window.confirm(
      lang === 'ar' ? 'هل أنت متأكد من حذف سجل المبيعات هذا نهائياً؟' : 'Supprimer cet enregistrement de vente ?'
    );
    if (!ok) return;
    onDeleteSortie(id);
    setActionMessage(lang === 'ar' ? 'تم حذف سجل المبيعات بنجاح.' : 'Ligne supprimée.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleSaveEditEntree = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntree) return;
    onEditEntree(editingEntree);
    setEditingEntree(null);
    setActionMessage(lang === 'ar' ? 'تم حفظ التعديل بنجاح!' : 'Modifications enregistrées !');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleSaveEditSortie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSortie) return;
    onEditSortie(editingSortie);
    setEditingSortie(null);
    setActionMessage(lang === 'ar' ? 'تم حفظ التعديل بنجاح!' : 'Modifications enregistrées !');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const resetForms = () => {
    setEntreeData({
      date: new Date().toISOString().split('T')[0],
      qty152Vert: '',
      qty152Bleu: '',
      qty124Vert: '',
      qty124Bleu: '',
      notes: '',
    });
    setSortieData({
      date: new Date().toISOString().split('T')[0],
      client: '',
      qty152Vert: '',
      qty152Bleu: '',
      qty124Vert: '',
      qty124Bleu: '',
      montant: '',
      notes: '',
    });
    setValidationError(null);
    setSubmitted(null);
  };

  const handleEntreeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);

    const q152V = Number(entreeData.qty152Vert) || 0;
    const q152B = Number(entreeData.qty152Bleu) || 0;
    const q124V = Number(entreeData.qty124Vert) || 0;
    const q124B = Number(entreeData.qty124Bleu) || 0;

    if (q152V === 0 && q152B === 0 && q124V === 0 && q124B === 0) {
      setValidationError(
        lang === 'ar'
          ? 'يرجى إدخال كمية لمنتج واحد على الأقل في صفحة الدخول'
          : 'Veuillez saisir une quantité pour au moins un produit en Entrée'
      );
      return;
    }

    onAddEntree({
      date: entreeData.date,
      qty152Vert: q152V,
      qty152Bleu: q152B,
      qty124Vert: q124V,
      qty124Bleu: q124B,
      notes: entreeData.notes,
    });

    setSubmitted('entree');
  };

  const handleSortieSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);

    if (!sortieData.client.trim()) {
      setValidationError(
        lang === 'ar' ? 'يرجى إدخال اسم العميل / الزبون' : 'Le nom du client est obligatoire'
      );
      return;
    }

    const q152V = Number(sortieData.qty152Vert) || 0;
    const q152B = Number(sortieData.qty152Bleu) || 0;
    const q124V = Number(sortieData.qty124Vert) || 0;
    const q124B = Number(sortieData.qty124Bleu) || 0;
    const montantNum = Number(sortieData.montant) || 0;

    if (q152V === 0 && q152B === 0 && q124V === 0 && q124B === 0) {
      setValidationError(
        lang === 'ar'
          ? 'يرجى إدخال كمية مباعة لمنتج واحد على الأقل'
          : 'Veuillez saisir au moins une quantité vendue'
      );
      return;
    }

    // Stock validation warnings check
    if (q152V > currentStock.qty152Vert) {
      setValidationError(
        lang === 'ar'
          ? `الكمية المطلوبة من 152 Vert (${q152V}) تفوق المتوفر في المخزن (${currentStock.qty152Vert})!`
          : `Quantité demandée 152 Vert (${q152V}) dépasse le stock disponible (${currentStock.qty152Vert})!`
      );
      return;
    }
    if (q152B > currentStock.qty152Bleu) {
      setValidationError(
        lang === 'ar'
          ? `الكمية المطلوبة من 152 Bleu (${q152B}) تفوق المتوفر في المخزن (${currentStock.qty152Bleu})!`
          : `Quantité demandée 152 Bleu (${q152B}) dépasse le stock disponible (${currentStock.qty152Bleu})!`
      );
      return;
    }
    if (q124V > currentStock.qty124Vert) {
      setValidationError(
        lang === 'ar'
          ? `الكمية المطلوبة من 124 Vert (${q124V}) تفوق المتوفر في المخزن (${currentStock.qty124Vert})!`
          : `Quantité demandée 124 Vert (${q124V}) dépasse le stock disponible (${currentStock.qty124Vert})!`
      );
      return;
    }
    if (q124B > currentStock.qty124Bleu) {
      setValidationError(
        lang === 'ar'
          ? `الكمية المطلوبة من 124 Bleu (${q124B}) تفوق المتوفر في المخزن (${currentStock.qty124Bleu})!`
          : `Quantité demandée 124 Bleu (${q124B}) dépasse le stock disponible (${currentStock.qty124Bleu})!`
      );
      return;
    }

    onAddSortie({
      date: sortieData.date,
      client: sortieData.client.trim(),
      qty152Vert: q152V,
      qty152Bleu: q152B,
      qty124Vert: q124V,
      qty124Bleu: q124B,
      montant: montantNum,
      notes: sortieData.notes,
    });

    setSubmitted('sortie');
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Google Forms Top Decorative Header */}
      <div className="rounded-t-2xl h-36 bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 shadow-md relative overflow-hidden flex items-end p-6">
        <div className="absolute top-0 right-0 left-0 h-2 bg-purple-900/30" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-indigo-400/20 rounded-full blur-xl pointer-events-none" />
        
        <div className="relative z-10 text-white flex items-center justify-between w-full">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-medium backdrop-blur-xs mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Google Forms • استمارة ذات صفحتين</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {lang === 'ar' ? 'استمارة إدارة المخزون والمبيعات' : 'Formulaire Gestion de Stock & Ventes'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {onOpenDriveModal && (
              <button
                onClick={onOpenDriveModal}
                type="button"
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition backdrop-blur-xs shadow-xs ${
                  isDriveConnected
                    ? 'bg-emerald-500/80 hover:bg-emerald-500 text-white'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isDriveConnected ? (lang === 'ar' ? 'Drive متصل' : 'Drive connecté') : (lang === 'ar' ? 'ربط Google Drive' : 'Lier Drive')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-b-2xl shadow-sm border border-neutral-200 border-t-0 p-6 sm:p-8 space-y-6">
        {/* Success Screen */}
        {submitted ? (
          <div className="text-center py-10 space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-neutral-800">
                {lang === 'ar' ? 'تم تسجيل ردك بنجاح!' : 'Votre réponse a été enregistrée !'}
              </h2>
              <p className="text-sm text-neutral-500 max-w-md mx-auto">
                {submitted === 'entree'
                  ? lang === 'ar'
                    ? 'تمت إضافة الكميات الواردة بنجاح إلى Feuille 1 Entrée وتحديث رصيد المخزون مباشرة.'
                    : 'Les quantités entrantes ont été ajoutées avec succès à Feuille 1 Entrée.'
                  : lang === 'ar'
                    ? 'تم تسجيل مبيعات العميل والمبلغ بنجاح في Feuille 2 Sortie وحسمها من المخزون.'
                    : 'La sortie client a été enregistrée avec succès dans Feuille 2 Sortie.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <button
                onClick={resetForms}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-purple-600 text-purple-700 hover:bg-purple-50 font-medium text-sm transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إرسال رد آخر' : 'Envoyer une autre réponse'}</span>
              </button>

              <button
                onClick={onGoToSheets}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{lang === 'ar' ? 'عرض الردود في Google Sheet' : 'Voir dans Google Sheets'}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Page Title & Instructions Card */}
            <div className="border-b border-neutral-100 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                      {currentPage === 1 
                        ? (lang === 'ar' ? 'الصفحة 1 من 2' : 'Page 1 sur 2') 
                        : (lang === 'ar' ? 'الصفحة 2 من 2' : 'Page 2 sur 2')}
                    </span>
                    <span className="text-xs text-neutral-400">•</span>
                    <span className="text-xs font-medium text-neutral-500">
                      {currentPage === 1 
                        ? (lang === 'ar' ? 'ورقة الدخول (Feuille 1 Entrée)' : 'Feuille 1 Entrée (Stock In)')
                        : (lang === 'ar' ? 'ورقة الخروج والمبيعات (Feuille 2 Sortie)' : 'Feuille 2 Sortie (Ventes)')}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    {lang === 'ar'
                      ? 'يمكنك التبديل بين صفحة الدخول (المشتريات) وصفحة الخروج (المبيعات للعملاء) بكل سهولة.'
                      : 'Basculez facilement entre la page Entrée (achats/réception) et Sortie (ventes clients).'}
                  </p>
                </div>

                {/* Google Forms Page Switcher Tabs */}
                <div className="inline-flex p-1 bg-neutral-100 rounded-xl text-xs font-medium self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => { setCurrentPage(1); setValidationError(null); }}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      currentPage === 1
                        ? 'bg-white text-purple-700 font-semibold shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>1.</span>
                    <span>{lang === 'ar' ? 'Feuille 1 Entrée' : 'Feuille 1 Entrée'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCurrentPage(2); setValidationError(null); }}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      currentPage === 2
                        ? 'bg-white text-purple-700 font-semibold shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>2.</span>
                    <span>{lang === 'ar' ? 'Feuille 2 Sortie' : 'Feuille 2 Sortie'}</span>
                  </button>
                </div>
              </div>

              {/* Progress bar like Google Forms */}
              <div className="mt-4">
                <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full transition-all duration-300"
                    style={{ width: currentPage === 1 ? '50%' : '100%' }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-neutral-400 mt-1">
                  <span>{currentPage === 1 ? '50% مكتمل' : '100% جاهز للإرسال'}</span>
                  <span className="text-red-500">* يشير إلى حقل مطلوب</span>
                </div>
              </div>
            </div>

            {/* Error Notification */}
            {validationError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-xs animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="flex-1 font-medium">{validationError}</p>
              </div>
            )}

            {/* Current Stock Snapshot Banner */}
            <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{lang === 'ar' ? 'المخزون المتوفر حالياً في المستودع:' : 'Stock actuellement disponible :'}</span>
                </div>
                <span className="text-[11px] text-neutral-500">
                  {lang === 'ar' ? 'يُحدث تلقائياً' : 'Calculé en direct'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                  <div className="text-[11px] text-neutral-500 font-medium">152 Vert</div>
                  <div className="text-base font-bold text-emerald-700">{currentStock.qty152Vert}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
                  <div className="text-[11px] text-neutral-500 font-medium">152 Bleu</div>
                  <div className="text-base font-bold text-blue-700">{currentStock.qty152Bleu}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-teal-200 text-center">
                  <div className="text-[11px] text-neutral-500 font-medium">124 Vert</div>
                  <div className="text-base font-bold text-teal-700">{currentStock.qty124Vert}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-sky-200 text-center">
                  <div className="text-[11px] text-neutral-500 font-medium">124 Bleu</div>
                  <div className="text-base font-bold text-sky-700">{currentStock.qty124Bleu}</div>
                </div>
              </div>
            </div>

            {/* PAGE 1: FEUILLE 1 ENTRÉE */}
            {currentPage === 1 && (
              <form onSubmit={handleEntreeSubmit} className="space-y-5">
                <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100">
                  <h3 className="text-sm font-bold text-purple-900">
                    {lang === 'ar' ? 'Feuille 1 : تسجيل دخول السلعة (Entrée)' : 'Feuille 1 : Entrée de Marchandise'}
                  </h3>
                  <p className="text-xs text-purple-700 mt-0.5">
                    {lang === 'ar'
                      ? 'سجل هنا الشحنات والمشتريات الواردة لزيادة رصيد المستودع.'
                      : 'Enregistrez ici les réceptions de stock pour augmenter l’inventaire.'}
                  </p>
                </div>

                {/* Question: Date */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 hover:border-purple-300 transition">
                  <label className="block text-sm font-medium text-neutral-800">
                    <span>{lang === 'ar' ? 'تاريخ الاستلام (Date)' : 'Date de réception'}</span>
                    <span className="text-red-500 ms-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={entreeData.date}
                      onChange={(e) => setEntreeData({ ...entreeData, date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent bg-neutral-50/50"
                    />
                  </div>
                </div>

                {/* Four Product Quantity Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PRODUCTS.map((prod) => {
                    const fieldMap: Record<string, keyof typeof entreeData> = {
                      '152_vert': 'qty152Vert',
                      '152_bleu': 'qty152Bleu',
                      '124_vert': 'qty124Vert',
                      '124_bleu': 'qty124Bleu',
                    };
                    const fieldKey = fieldMap[prod.key];
                    return (
                      <div
                        key={prod.key}
                        className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 hover:border-purple-300 transition"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full inline-block"
                              style={{ backgroundColor: prod.colorHex }}
                            />
                            <span>{prod.code}</span>
                            <span className="text-xs text-neutral-400 font-normal">
                              ({lang === 'ar' ? prod.nameAr : prod.nameFr})
                            </span>
                          </label>
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={entreeData[fieldKey]}
                          onChange={(e) =>
                            setEntreeData({ ...entreeData, [fieldKey]: e.target.value })
                          }
                          className="w-full px-3.5 py-2 rounded-lg border border-neutral-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Notes Question */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 hover:border-purple-300 transition">
                  <label className="block text-sm font-medium text-neutral-800">
                    <span>{lang === 'ar' ? 'ملاحظات الشحنة أو المورد (اختياري)' : 'Notes / Fournisseur (Facultatif)'}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={
                      lang === 'ar'
                        ? 'مثال: شحنة رقم Lot #42 أو اسم المصنع المورّد'
                        : 'Ex: Lot #42, Fournisseur Alger...'
                    }
                    value={entreeData.notes}
                    onChange={(e) => setEntreeData({ ...entreeData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>

                {/* Actions */}
                <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEntreeData({
                        date: new Date().toISOString().split('T')[0],
                        qty152Vert: '',
                        qty152Bleu: '',
                        qty124Vert: '',
                        qty124Bleu: '',
                        notes: '',
                      });
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-800 font-medium order-2 sm:order-1"
                  >
                    {lang === 'ar' ? 'محو النموذج' : 'Effacer le formulaire'}
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                    <button
                      type="submit"
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border border-purple-600 text-purple-700 hover:bg-purple-50 text-xs font-semibold transition"
                    >
                      {lang === 'ar' ? 'حفظ ورقة الدخول فقط' : 'Enregistrer Entrée seule'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setValidationError(null);
                        setCurrentPage(2);
                      }}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition shadow-xs"
                    >
                      <span>{lang === 'ar' ? 'التالي: صفحة الخروج' : 'Suivant : Sortie'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* PAGE 2: FEUILLE 2 SORTIE */}
            {currentPage === 2 && (
              <form onSubmit={handleSortieSubmit} className="space-y-5">
                <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
                  <h3 className="text-sm font-bold text-indigo-900">
                    {lang === 'ar' ? 'Feuille 2 : تسجيل خروج البضاعة والمبيعات (Sortie)' : 'Feuille 2 : Sortie & Ventes aux Clients'}
                  </h3>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    {lang === 'ar'
                      ? 'سجل هنا مبيعات العميل والكميات المسحوبة والمبلغ المستحق.'
                      : 'Enregistrez les sorties de stock livrées aux clients avec le montant.'}
                  </p>
                </div>

                {/* Date & Client Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 hover:border-purple-300 transition">
                    <label className="block text-sm font-medium text-neutral-800">
                      <span>{lang === 'ar' ? 'تاريخ البيع / التسليم (Date)' : 'Date de sortie'}</span>
                      <span className="text-red-500 ms-1">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={sortieData.date}
                      onChange={(e) => setSortieData({ ...sortieData, date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent bg-neutral-50/50"
                    />
                  </div>

                  {/* Client */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 hover:border-purple-300 transition">
                    <label className="block text-sm font-medium text-neutral-800">
                      <span>{lang === 'ar' ? 'اسم العميل / الزبون (Client)' : 'Nom du Client'}</span>
                      <span className="text-red-500 ms-1">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'ar' ? 'مثال: شركة الأمل، ورشة كمال...' : 'Ex: Société Al Amal, SARL...'}
                      value={sortieData.client}
                      onChange={(e) => setSortieData({ ...sortieData, client: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Products Quantities with Remaining Stock Badges */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    {lang === 'ar' ? 'الكميات المسحوبة والمباعة:' : 'Quantités vendues :'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PRODUCTS.map((prod) => {
                      const fieldMap: Record<string, keyof typeof sortieData> = {
                        '152_vert': 'qty152Vert',
                        '152_bleu': 'qty152Bleu',
                        '124_vert': 'qty124Vert',
                        '124_bleu': 'qty124Bleu',
                      };
                      const stockMap: Record<string, number> = {
                        '152_vert': currentStock.qty152Vert,
                        '152_bleu': currentStock.qty152Bleu,
                        '124_vert': currentStock.qty124Vert,
                        '124_bleu': currentStock.qty124Bleu,
                      };
                      const fieldKey = fieldMap[prod.key];
                      const available = stockMap[prod.key];
                      const currentVal = Number(sortieData[fieldKey]) || 0;
                      const isOverStock = currentVal > available;

                      return (
                        <div
                          key={prod.key}
                          className={`bg-white p-4 rounded-xl border space-y-2 transition ${
                            isOverStock
                              ? 'border-red-300 bg-red-50/20'
                              : 'border-neutral-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: prod.colorHex }}
                              />
                              <span>{prod.code}</span>
                            </label>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                                available <= 5
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {lang === 'ar' ? `المتوفر: ${available}` : `Dispo: ${available}`}
                            </span>
                          </div>

                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={sortieData[fieldKey]}
                            onChange={(e) =>
                              setSortieData({ ...sortieData, [fieldKey]: e.target.value })
                            }
                            className={`w-full px-3.5 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 ${
                              isOverStock
                                ? 'border-red-400 focus:ring-red-500'
                                : 'border-neutral-300 focus:ring-purple-600'
                            }`}
                          />
                          {isOverStock && (
                            <p className="text-[11px] text-red-600 font-medium">
                              {lang === 'ar'
                                ? `تنبيه: الكمية تفوق المتوفر (${available})`
                                : `Attention: Dépasse le stock dispo (${available})`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Montant (Total Amount) */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 hover:border-purple-300 transition">
                  <label className="block text-sm font-medium text-neutral-800">
                    <span>{lang === 'ar' ? 'المبلغ الإجمالي (Montant)' : 'Montant total (Facturé / Payé)'}</span>
                    <span className="text-red-500 ms-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="0.00"
                      value={sortieData.montant}
                      onChange={(e) => setSortieData({ ...sortieData, montant: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-base font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent text-neutral-800"
                    />
                    <div className="absolute inset-y-0 end-3 flex items-center pointer-events-none text-xs text-neutral-400 font-semibold">
                      DZD / DA
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 hover:border-purple-300 transition">
                  <label className="block text-sm font-medium text-neutral-800">
                    <span>{lang === 'ar' ? 'ملاحظات إضافية أو رقم الفاتورة (اختياري)' : 'Notes / Réf Facture'}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={
                      lang === 'ar' ? 'مثال: فاتورة FC-102، وصل تسليم...' : 'Ex: Facture FC-102, Bon de livraison...'
                    }
                    value={sortieData.notes}
                    onChange={(e) => setSortieData({ ...sortieData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>

                {/* Actions */}
                <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => {
                      setValidationError(null);
                      setCurrentPage(1);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-medium order-2 sm:order-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'الرجوع إلى الصفحة 1 (Entrée)' : 'Retour à Page 1 (Entrée)'}</span>
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSortieData({
                          date: new Date().toISOString().split('T')[0],
                          client: '',
                          qty152Vert: '',
                          qty152Bleu: '',
                          qty124Vert: '',
                          qty124Bleu: '',
                          montant: '',
                          notes: '',
                        });
                      }}
                      className="px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700 font-medium"
                    >
                      {lang === 'ar' ? 'محو' : 'Effacer'}
                    </button>

                    <button
                      type="submit"
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'إرسال رد الخروج والمبيعات' : 'Envoyer la réponse'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* 📋 قسم إدارة وتعديل وحذف السجلات مباشرة من صفحة الفورم */}
      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <h2 className="text-sm sm:text-base font-bold text-neutral-900">
                {lang === 'ar' ? '📋 السجلات المسجلة (تعديل وحذف السجلات)' : 'Enregistrements (Modifier & Supprimer)'}
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              {lang === 'ar'
                ? 'اضغط على زر "تعديل" لتعديل أي سطر، أو زر "حذف" لإزالة السجل نهائياً.'
                : 'Cliquez sur "Modifier" ou "Supprimer" pour chaque ligne.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearAllData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition cursor-pointer"
              title="محو جميع السجلات وتصفير المخزون"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>{lang === 'ar' ? 'محو جميع البيانات' : 'Tout effacer'}</span>
            </button>

            <button
              type="button"
              onClick={onGoToSheets}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'عرض الجداول الكاملة' : 'Voir les tableaux'}</span>
            </button>
          </div>
        </div>

        {/* Action message feedback */}
        {actionMessage && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 text-emerald-900 rounded-xl text-xs font-semibold border border-emerald-200 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Sub-tabs: Entrées vs Sorties */}
        <div className="px-4 pt-3 flex items-center gap-2 border-b border-neutral-100 overflow-x-auto">
          <button
            type="button"
            onClick={() => setRecordsTab('entree')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              recordsTab === 'entree' || (recordsTab === 'current' && currentPage === 1)
                ? 'border-purple-600 text-purple-800'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>📥 {lang === 'ar' ? 'سجلات الوارد (Entrée)' : 'Entrées'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800 font-extrabold">
              {entrees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRecordsTab('sortie')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              recordsTab === 'sortie' || (recordsTab === 'current' && currentPage === 2)
                ? 'border-blue-600 text-blue-800'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>📤 {lang === 'ar' ? 'سجلات المبيعات (Sortie)' : 'Sorties'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-extrabold">
              {sorties.length}
            </span>
          </button>
        </div>

        {/* Entrées Table */}
        {(recordsTab === 'entree' || (recordsTab === 'current' && currentPage === 1)) && (
          <div className="p-4 overflow-x-auto">
            {entrees.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-xs">
                {lang === 'ar' ? 'لا توجد سجلات وارد حتى الآن. املأ النموذج أعلاه للإضافة.' : 'Aucun enregistrement d’entrée.'}
              </div>
            ) : (
              <table className="w-full text-xs text-start border-collapse border border-neutral-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-purple-50 text-purple-950 font-bold border-b border-purple-200 text-center">
                    <th className="p-2.5 text-start border-e border-purple-200">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="p-2.5 border-e border-purple-200 text-emerald-800">152 Vert</th>
                    <th className="p-2.5 border-e border-purple-200 text-blue-800">152 Bleu</th>
                    <th className="p-2.5 border-e border-purple-200 text-teal-800">124 Vert</th>
                    <th className="p-2.5 border-e border-purple-200 text-sky-800">124 Bleu</th>
                    <th className="p-2.5 text-start border-e border-purple-200">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                    <th className="p-2.5 text-center min-w-[150px] bg-purple-100 font-extrabold">{lang === 'ar' ? 'إجراءات السجل' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {entrees.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50 transition">
                      <td className="p-2.5 border-e border-neutral-200 font-semibold">{item.date}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-bold text-emerald-700 bg-emerald-50/20">{item.qty152Vert || '-'}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-bold text-blue-700 bg-blue-50/20">{item.qty152Bleu || '-'}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-bold text-teal-700 bg-teal-50/20">{item.qty124Vert || '-'}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-bold text-sky-700 bg-sky-50/20">{item.qty124Bleu || '-'}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-neutral-600 truncate max-w-xs">{item.notes || '-'}</td>
                      <td className="p-2 text-center bg-neutral-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingEntree({ ...item })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'تعديل' : 'Modifier'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntreeWithConfirm(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'حذف' : 'Supprimer'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Sorties Table */}
        {(recordsTab === 'sortie' || (recordsTab === 'current' && currentPage === 2)) && (
          <div className="p-4 overflow-x-auto">
            {sorties.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-xs">
                {lang === 'ar' ? 'لا توجد سجلات مبيعات حتى الآن. املأ النموذج أعلاه للإضافة.' : 'Aucun enregistrement de vente.'}
              </div>
            ) : (
              <table className="w-full text-xs text-start border-collapse border border-neutral-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-blue-50 text-blue-950 font-bold border-b border-blue-200 text-center">
                    <th className="p-2.5 text-start border-e border-blue-200">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="p-2.5 text-start border-e border-blue-200">{lang === 'ar' ? 'العميل / الزبون' : 'Client'}</th>
                    <th className="p-2.5 border-e border-blue-200 text-emerald-800">152 Vert</th>
                    <th className="p-2.5 border-e border-blue-200 text-blue-800">152 Bleu</th>
                    <th className="p-2.5 border-e border-blue-200 text-teal-800">124 Vert</th>
                    <th className="p-2.5 border-e border-blue-200 text-sky-800">124 Bleu</th>
                    <th className="p-2.5 border-e border-blue-200 text-amber-900 bg-amber-50/60">{lang === 'ar' ? 'المبلغ' : 'Montant'}</th>
                    <th className="p-2.5 text-center min-w-[150px] bg-blue-100 font-extrabold">{lang === 'ar' ? 'إجراءات السجل' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {sorties.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50 transition">
                      <td className="p-2.5 border-e border-neutral-200 font-semibold">{item.date}</td>
                      <td className="p-2.5 border-e border-neutral-200 font-bold text-neutral-800">{item.client}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-bold text-emerald-700 bg-emerald-50/20">{item.qty152Vert || '-'}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-bold text-blue-700 bg-blue-50/20">{item.qty152Bleu || '-'}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-bold text-teal-700 bg-teal-50/20">{item.qty124Vert || '-'}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-bold text-sky-700 bg-sky-50/20">{item.qty124Bleu || '-'}</td>
                      <td className="p-2.5 border-e border-neutral-200 text-center font-extrabold text-neutral-900 bg-amber-50/30">
                        {item.montant ? `${item.montant.toLocaleString()} DZD` : '0 DZD'}
                      </td>
                      <td className="p-2 text-center bg-neutral-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingSortie({ ...item })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'تعديل' : 'Modifier'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSortieWithConfirm(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'حذف' : 'Supprimer'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* نافذة تعديل سطر الوارد (Entrée) */}
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
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
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
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
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

      {/* نافذة تعديل سطر المبيعات (Sortie) */}
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
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
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
                    {lang === 'ar' ? 'اسم العميل / الزبون' : 'Client'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSortie.client}
                    onChange={(e) => setEditingSortie({ ...editingSortie, client: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 font-semibold"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    {lang === 'ar' ? 'المبلغ (دج)' : 'Montant (DZD)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingSortie.montant}
                    onChange={(e) => setEditingSortie({ ...editingSortie, montant: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 font-bold text-blue-900"
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
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingSortie(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
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
