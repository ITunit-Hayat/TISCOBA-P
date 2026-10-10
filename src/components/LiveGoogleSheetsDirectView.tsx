import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Minus,
  Pencil, 
  Trash2, 
  Search, 
  ExternalLink, 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  X,
  FileSpreadsheet,
  Package,
  Calendar,
  User,
  DollarSign,
  AlertTriangle,
  Check,
  Settings,
  RotateCcw
} from 'lucide-react';
import { EntreeItem, SortieItem } from '../types/stock';
import { ALGERIA_WILAYAS_69 } from '../data/wilayas';

interface LiveGoogleSheetsDirectViewProps {
  entrees: EntreeItem[];
  sorties: SortieItem[];
  currentStock: {
    qty152Vert: number;
    qty152Bleu: number;
    qty152Noir: number;
    qty152KS: number;
    qty152KF: number;
    qty152Gris: number;
    qty124Vert: number;
    qty124Bleu: number;
  };
  onUpdateEntreesAndSorties: (newEntrees: EntreeItem[], newSorties: SortieItem[]) => void;
  onAddEntree?: (item: EntreeItem) => Promise<void> | void;
  onAddSortie?: (item: SortieItem) => Promise<void> | void;
  onOpenDriveModal?: () => void;
  activeSpreadsheet: { id: string; url: string; title: string; webhookUrl?: string } | null;
  autoSync?: boolean;
  onToggleAutoSync?: (val: boolean) => void;
  isAutoSyncing?: boolean;
  lastSyncTime?: Date | null;
  onManualSyncNow?: () => void;
  onConnectDriveOnce?: () => void;
  isConnectingDrive?: boolean;
  tokenNeedsRefresh?: boolean;
  sharedTeamSheet?: { id: string; url: string; title: string; sharedBy?: string } | null;
  currentUser?: any;
  hasLegacyColumns?: boolean;
  onUpgradeSheetColumns?: () => void;
  lang: 'ar' | 'fr';
}

type CombinedRow = 
  | { type: 'entree'; item: EntreeItem }
  | { type: 'sortie'; item: SortieItem };

export const LiveGoogleSheetsDirectView: React.FC<LiveGoogleSheetsDirectViewProps> = ({
  entrees,
  sorties,
  currentStock,
  onUpdateEntreesAndSorties,
  onAddEntree,
  onAddSortie,
  onOpenDriveModal,
  activeSpreadsheet,
  isAutoSyncing = false,
  lastSyncTime,
  onManualSyncNow,
  onConnectDriveOnce,
  isConnectingDrive = false,
  tokenNeedsRefresh = false,
  currentUser,
  hasLegacyColumns = false,
  onUpgradeSheetColumns,
  lang,
}) => {
  const isAr = lang === 'ar';

  // Entry Form Tab: 'entree' | 'sortie'
  const [formMode, setFormMode] = useState<'entree' | 'sortie'>('entree');

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [client, setClient] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [qty152Vert, setQty152Vert] = useState<number | ''>('');
  const [qty152Bleu, setQty152Bleu] = useState<number | ''>('');
  const [qty152Noir, setQty152Noir] = useState<number | ''>('');
  const [qty152KS, setQty152KS] = useState<number | ''>('');
  const [qty152KF, setQty152KF] = useState<number | ''>('');
  const [qty152Gris, setQty152Gris] = useState<number | ''>('');
  const [qty124Vert, setQty124Vert] = useState<number | ''>('');
  const [qty124Bleu, setQty124Bleu] = useState<number | ''>('');
  const [montant, setMontant] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [rowToDelete, setRowToDelete] = useState<CombinedRow | null>(null);

  // Table filter: all, entrees, sorties, synthese
  const [activeFilter, setActiveFilter] = useState<'all' | 'entrees' | 'sorties' | 'synthese'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Edit modal state
  const [editingRow, setEditingRow] = useState<CombinedRow | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: '',
    client: '',
    wilaya: '',
    qty152Vert: 0,
    qty152Bleu: 0,
    qty152Noir: 0,
    qty152KS: 0,
    qty152KF: 0,
    qty152Gris: 0,
    qty124Vert: 0,
    qty124Bleu: 0,
    montant: 0,
    notes: '',
  });

  // Calculate totals for all 8 products
  const totalEntree152V = useMemo(() => entrees.reduce((acc, i) => acc + (Number(i.qty152Vert) || 0), 0), [entrees]);
  const totalEntree152B = useMemo(() => entrees.reduce((acc, i) => acc + (Number(i.qty152Bleu) || 0), 0), [entrees]);
  const totalEntree152N = useMemo(() => entrees.reduce((acc, i) => acc + (Number(i.qty152Noir) || 0), 0), [entrees]);
  const totalEntree152KS = useMemo(() => entrees.reduce((acc, i) => acc + (Number(i.qty152KS) || 0), 0), [entrees]);
  const totalEntree152KF = useMemo(() => entrees.reduce((acc, i) => acc + (Number(i.qty152KF) || 0), 0), [entrees]);
  const totalEntree152G = useMemo(() => entrees.reduce((acc, i) => acc + (Number(i.qty152Gris) || 0), 0), [entrees]);
  const totalEntree124V = useMemo(() => entrees.reduce((acc, i) => acc + (Number(i.qty124Vert) || 0), 0), [entrees]);
  const totalEntree124B = useMemo(() => entrees.reduce((acc, i) => acc + (Number(i.qty124Bleu) || 0), 0), [entrees]);

  const totalSortie152V = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.qty152Vert) || 0), 0), [sorties]);
  const totalSortie152B = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.qty152Bleu) || 0), 0), [sorties]);
  const totalSortie152N = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.qty152Noir) || 0), 0), [sorties]);
  const totalSortie152KS = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.qty152KS) || 0), 0), [sorties]);
  const totalSortie152KF = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.qty152KF) || 0), 0), [sorties]);
  const totalSortie152G = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.qty152Gris) || 0), 0), [sorties]);
  const totalSortie124V = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.qty124Vert) || 0), 0), [sorties]);
  const totalSortie124B = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.qty124Bleu) || 0), 0), [sorties]);

  const totalMontant = useMemo(() => sorties.reduce((acc, i) => acc + (Number(i.montant) || 0), 0), [sorties]);

  // Reset all form inputs to blank/default
  const handleResetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setClient('');
    setWilaya('');
    setQty152Vert('');
    setQty152Bleu('');
    setQty152Noir('');
    setQty152KS('');
    setQty152KF('');
    setQty152Gris('');
    setQty124Vert('');
    setQty124Bleu('');
    setMontant('');
    setNotes('');
    setFormErrorMessage(null);
  };

  // Handle Form Submit
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();

    const q152V = Number(qty152Vert) || 0;
    const q152B = Number(qty152Bleu) || 0;
    const q152N = Number(qty152Noir) || 0;
    const q152KS = Number(qty152KS) || 0;
    const q152KF = Number(qty152KF) || 0;
    const q152G = Number(qty152Gris) || 0;
    const q124V = Number(qty124Vert) || 0;
    const q124B = Number(qty124Bleu) || 0;

    if (
      q152V === 0 &&
      q152B === 0 &&
      q152N === 0 &&
      q152KS === 0 &&
      q152KF === 0 &&
      q152G === 0 &&
      q124V === 0 &&
      q124B === 0
    ) {
      setFormErrorMessage(isAr ? '⚠️ يرجى إدخال كمية لمنتج واحد على الأقل' : '⚠️ Veuillez saisir au moins une quantité');
      setTimeout(() => setFormErrorMessage(null), 3500);
      return;
    }
    setFormErrorMessage(null);

    if (formMode === 'entree') {
      const newItem: EntreeItem = {
        id: `entree-${Date.now()}`,
        date: date || new Date().toISOString().split('T')[0],
        qty152Vert: q152V,
        qty152Bleu: q152B,
        qty152Noir: q152N,
        qty152KS: q152KS,
        qty152KF: q152KF,
        qty152Gris: q152G,
        qty124Vert: q124V,
        qty124Bleu: q124B,
        notes: notes.trim() || undefined,
      };
      if (onAddEntree) {
        onAddEntree(newItem);
      } else {
        onUpdateEntreesAndSorties([newItem, ...entrees], sorties);
      }
      setFormSuccessMessage(isAr ? '✅ تم حفظ و الاستلام بنجاح، وتم تصفير كافة الحقول لتسجيل عملية جديدة!' : '✅ Entrée enregistrée et champs réinitialisés !');
    } else {
      const newItem: SortieItem = {
        id: `sortie-${Date.now()}`,
        date: date || new Date().toISOString().split('T')[0],
        client: client.trim() || (isAr ? 'زبون' : 'Client'),
        wilaya: wilaya || undefined,
        qty152Vert: q152V,
        qty152Bleu: q152B,
        qty152Noir: q152N,
        qty152KS: q152KS,
        qty152KF: q152KF,
        qty152Gris: q152G,
        qty124Vert: q124V,
        qty124Bleu: q124B,
        montant: Number(montant) || 0,
        notes: notes.trim() || undefined,
      };
      if (onAddSortie) {
        onAddSortie(newItem);
      } else {
        onUpdateEntreesAndSorties(entrees, [newItem, ...sorties]);
      }
      setFormSuccessMessage(isAr ? '✅ تم حفظ وتسجيل البيع بنجاح، وتم تصفير كافة الحقول لتسجيل عملية جديدة!' : '✅ Vente enregistrée et champs réinitialisés !');
    }

    // Reset all form inputs to allow immediate clean re-entry
    handleResetForm();

    setTimeout(() => {
      setFormSuccessMessage(null);
    }, 4500);
  };

  // Open Edit Modal
  const handleOpenEdit = (row: CombinedRow) => {
    setEditingRow(row);
    if (row.type === 'entree') {
      setEditFormData({
        date: row.item.date,
        client: '',
        wilaya: '',
        qty152Vert: row.item.qty152Vert || 0,
        qty152Bleu: row.item.qty152Bleu || 0,
        qty152Noir: row.item.qty152Noir || 0,
        qty152KS: row.item.qty152KS || 0,
        qty152KF: row.item.qty152KF || 0,
        qty152Gris: row.item.qty152Gris || 0,
        qty124Vert: row.item.qty124Vert || 0,
        qty124Bleu: row.item.qty124Bleu || 0,
        montant: 0,
        notes: row.item.notes || '',
      });
    } else {
      setEditFormData({
        date: row.item.date,
        client: row.item.client,
        wilaya: row.item.wilaya || '',
        qty152Vert: row.item.qty152Vert || 0,
        qty152Bleu: row.item.qty152Bleu || 0,
        qty152Noir: row.item.qty152Noir || 0,
        qty152KS: row.item.qty152KS || 0,
        qty152KF: row.item.qty152KF || 0,
        qty152Gris: row.item.qty152Gris || 0,
        qty124Vert: row.item.qty124Vert || 0,
        qty124Bleu: row.item.qty124Bleu || 0,
        montant: row.item.montant || 0,
        notes: row.item.notes || '',
      });
    }
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    if (editingRow.type === 'entree') {
      const updated: EntreeItem = {
        ...editingRow.item,
        date: editFormData.date,
        qty152Vert: Number(editFormData.qty152Vert) || 0,
        qty152Bleu: Number(editFormData.qty152Bleu) || 0,
        qty152Noir: Number(editFormData.qty152Noir) || 0,
        qty152KS: Number(editFormData.qty152KS) || 0,
        qty152KF: Number(editFormData.qty152KF) || 0,
        qty152Gris: Number(editFormData.qty152Gris) || 0,
        qty124Vert: Number(editFormData.qty124Vert) || 0,
        qty124Bleu: Number(editFormData.qty124Bleu) || 0,
        notes: editFormData.notes.trim() || undefined,
      };
      onUpdateEntreesAndSorties(
        entrees.map((e) => (e.id === updated.id ? updated : e)),
        sorties
      );
    } else {
      const updated: SortieItem = {
        ...editingRow.item,
        date: editFormData.date,
        client: editFormData.client.trim() || (isAr ? 'زبون' : 'Client'),
        wilaya: editFormData.wilaya || undefined,
        qty152Vert: Number(editFormData.qty152Vert) || 0,
        qty152Bleu: Number(editFormData.qty152Bleu) || 0,
        qty152Noir: Number(editFormData.qty152Noir) || 0,
        qty152KS: Number(editFormData.qty152KS) || 0,
        qty152KF: Number(editFormData.qty152KF) || 0,
        qty152Gris: Number(editFormData.qty152Gris) || 0,
        qty124Vert: Number(editFormData.qty124Vert) || 0,
        qty124Bleu: Number(editFormData.qty124Bleu) || 0,
        montant: Number(editFormData.montant) || 0,
        notes: editFormData.notes.trim() || undefined,
      };
      onUpdateEntreesAndSorties(
        entrees,
        sorties.map((s) => (s.id === updated.id ? updated : s))
      );
    }
    setEditingRow(null);
  };

  // Delete row via in-app confirmation modal
  const handleDeleteRow = (row: CombinedRow) => {
    setRowToDelete(row);
  };

  const handleConfirmDeleteRow = () => {
    if (!rowToDelete) return;
    if (rowToDelete.type === 'entree') {
      onUpdateEntreesAndSorties(
        entrees.filter((e) => e.id !== rowToDelete.item.id),
        sorties
      );
    } else {
      onUpdateEntreesAndSorties(
        entrees,
        sorties.filter((s) => s.id !== rowToDelete.item.id)
      );
    }
    setRowToDelete(null);
  };

  // Filter combined operations
  const combinedOperations: CombinedRow[] = useMemo(() => {
    let list: CombinedRow[] = [];
    if (activeFilter === 'all' || activeFilter === 'entrees') {
      list.push(...entrees.map((item) => ({ type: 'entree' as const, item })));
    }
    if (activeFilter === 'all' || activeFilter === 'sorties') {
      list.push(...sorties.map((item) => ({ type: 'sortie' as const, item })));
    }

    list.sort((a, b) => b.item.date.localeCompare(a.item.date));

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((r) => {
        if (r.type === 'entree') {
          return r.item.date.includes(q) || (r.item.notes && r.item.notes.toLowerCase().includes(q));
        } else {
          return (
            r.item.date.includes(q) ||
            r.item.client.toLowerCase().includes(q) ||
            (r.item.notes && r.item.notes.toLowerCase().includes(q))
          );
        }
      });
    }

    return list;
  }, [entrees, sorties, activeFilter, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Stock Overview Cards - 8 Products (152 & 124) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
            {isAr ? 'المخزون المتوفر' : 'Stock Actuel'}
          </h3>
          <span className="text-[11px] font-bold text-neutral-600 bg-neutral-200/70 px-2.5 py-0.5 rounded-full">
            {isAr ? 'الوحدة: متر (م)' : 'Unité : mètre (m)'}
          </span>
        </div>

        {/* Section Gamme 152 */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-black text-neutral-700 bg-neutral-200/70 px-2 py-0.5 rounded-md">
              152
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* 152 Vert */}
            <div className="bg-white rounded-2xl p-3 border border-emerald-200/90 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-emerald-800">152 Vert</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono flex items-baseline gap-1">
                <span>{currentStock.qty152Vert.toLocaleString()}</span>
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'م' : 'm'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-medium truncate">
                <span className="text-emerald-700 font-bold">+{totalEntree152V} {isAr ? 'م' : 'm'}</span> /{' '}
                <span className="text-neutral-700 font-bold">-{totalSortie152V} {isAr ? 'م' : 'm'}</span>
              </div>
            </div>

            {/* 152 Bleu */}
            <div className="bg-white rounded-2xl p-3 border border-blue-200/90 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-blue-800">152 Bleu</span>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
              </div>
              <div className="text-2xl font-black text-blue-700 font-mono flex items-baseline gap-1">
                <span>{currentStock.qty152Bleu.toLocaleString()}</span>
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'م' : 'm'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-medium truncate">
                <span className="text-blue-700 font-bold">+{totalEntree152B} {isAr ? 'م' : 'm'}</span> /{' '}
                <span className="text-neutral-700 font-bold">-{totalSortie152B} {isAr ? 'م' : 'm'}</span>
              </div>
            </div>

            {/* 152 Noir */}
            <div className="bg-white rounded-2xl p-3 border border-neutral-300 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-neutral-900">152 Noir</span>
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 shrink-0"></span>
              </div>
              <div className="text-2xl font-black text-neutral-900 font-mono flex items-baseline gap-1">
                <span>{currentStock.qty152Noir.toLocaleString()}</span>
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'م' : 'm'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-medium truncate">
                <span className="text-neutral-900 font-bold">+{totalEntree152N} {isAr ? 'م' : 'm'}</span> /{' '}
                <span className="text-neutral-700 font-bold">-{totalSortie152N} {isAr ? 'م' : 'm'}</span>
              </div>
            </div>

            {/* 152 K.S */}
            <div className="bg-white rounded-2xl p-3 border border-amber-300 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-amber-900">152 K.S</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0"></span>
              </div>
              <div className="text-2xl font-black text-amber-800 font-mono flex items-baseline gap-1">
                <span>{currentStock.qty152KS.toLocaleString()}</span>
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'م' : 'm'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-medium truncate">
                <span className="text-amber-800 font-bold">+{totalEntree152KS} {isAr ? 'م' : 'm'}</span> /{' '}
                <span className="text-neutral-700 font-bold">-{totalSortie152KS} {isAr ? 'م' : 'm'}</span>
              </div>
            </div>

            {/* 152 K.F */}
            <div className="bg-white rounded-2xl p-3 border border-orange-300 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-orange-950">152 K.F</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-800 shrink-0"></span>
              </div>
              <div className="text-2xl font-black text-amber-900 font-mono flex items-baseline gap-1">
                <span>{currentStock.qty152KF.toLocaleString()}</span>
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'م' : 'm'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-medium truncate">
                <span className="text-amber-900 font-bold">+{totalEntree152KF} {isAr ? 'م' : 'm'}</span> /{' '}
                <span className="text-neutral-700 font-bold">-{totalSortie152KF} {isAr ? 'م' : 'm'}</span>
              </div>
            </div>

            {/* 152 Gris */}
            <div className="bg-white rounded-2xl p-3 border border-slate-300 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-800">152 Gris</span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0"></span>
              </div>
              <div className="text-2xl font-black text-slate-700 font-mono flex items-baseline gap-1">
                <span>{currentStock.qty152Gris.toLocaleString()}</span>
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'م' : 'm'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-medium truncate">
                <span className="text-slate-700 font-bold">+{totalEntree152G} {isAr ? 'م' : 'm'}</span> /{' '}
                <span className="text-neutral-700 font-bold">-{totalSortie152G} {isAr ? 'م' : 'm'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Gamme 124 & Chiffre d'Affaires */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-black text-neutral-700 bg-neutral-200/70 px-2 py-0.5 rounded-md">
              124
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5">
            {/* 124 Vert */}
            <div className="bg-white rounded-2xl p-3 border border-teal-200/90 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-teal-800">124 Vert</span>
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0"></span>
              </div>
              <div className="text-2xl font-black text-teal-700 font-mono flex items-baseline gap-1">
                <span>{currentStock.qty124Vert.toLocaleString()}</span>
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'م' : 'm'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-medium truncate">
                <span className="text-teal-700 font-bold">+{totalEntree124V} {isAr ? 'م' : 'm'}</span> /{' '}
                <span className="text-neutral-700 font-bold">-{totalSortie124V} {isAr ? 'م' : 'm'}</span>
              </div>
            </div>

            {/* 124 Bleu */}
            <div className="bg-white rounded-2xl p-3 border border-sky-200/90 shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-sky-800">124 Bleu</span>
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></span>
              </div>
              <div className="text-2xl font-black text-sky-700 font-mono flex items-baseline gap-1">
                <span>{currentStock.qty124Bleu.toLocaleString()}</span>
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'م' : 'm'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-medium truncate">
                <span className="text-sky-700 font-bold">+{totalEntree124B} {isAr ? 'م' : 'm'}</span> /{' '}
                <span className="text-neutral-700 font-bold">-{totalSortie124B} {isAr ? 'م' : 'm'}</span>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-3 border border-amber-300 shadow-2xs flex flex-col justify-center">
              <span className="text-xs font-bold text-amber-800">
                {isAr ? 'المداخيل' : 'Chiffre d’affaires'}
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5 font-mono">
                {totalMontant.toLocaleString()} <span className="text-xs font-bold text-amber-700">دج</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {isAr ? `${sorties.length} عملية بيع` : `${sorties.length} ventes`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CORE DATA ENTRY SECTION - "أين أدخل البيانات" */}
      <div className="bg-white rounded-2xl border-2 border-neutral-300/80 shadow-md overflow-hidden">
        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 bg-neutral-100 p-1.5 border-b border-neutral-200">
          <button
            type="button"
            onClick={() => setFormMode('entree')}
            className={`py-3 px-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer ${
              formMode === 'entree'
                ? 'bg-emerald-700 text-white shadow-md'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span>{isAr ? 'استلام (Entrée)' : 'Entrée Stock'}</span>
          </button>

          <button
            type="button"
            onClick={() => setFormMode('sortie')}
            className={`py-3 px-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer ${
              formMode === 'sortie'
                ? 'bg-blue-700 text-white shadow-md'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            <Minus className="w-5 h-5 shrink-0" />
            <span>{isAr ? 'بيع (Sortie)' : 'Sortie / Vente'}</span>
          </button>
        </div>

        {/* Success Banner */}
        {formSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 text-center text-xs font-bold text-emerald-800 animate-in fade-in flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{formSuccessMessage}</span>
          </div>
        )}

        {/* Error Banner */}
        {formErrorMessage && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 text-center text-xs font-bold text-amber-800 animate-in fade-in flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{formErrorMessage}</span>
          </div>
        )}

        {/* The Direct Input Form */}
        <form onSubmit={handleSaveForm} className="p-4 sm:p-6 space-y-4">
          {/* Top Row: Date, Client, Wilaya (if Sortie) */}
          <div className={`grid grid-cols-1 ${formMode === 'sortie' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                {isAr ? 'التاريخ' : 'Date'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-semibold text-neutral-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            {formMode === 'sortie' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    {isAr ? 'الزبون' : 'Client'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? 'الزبون' : 'Client'}
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    {isAr ? 'الولاية (69 ولاية)' : 'Wilaya (69 Wilayas)'}
                  </label>
                  <select
                    value={wilaya}
                    onChange={(e) => setWilaya(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-medium text-neutral-800 focus:bg-white focus:border-blue-600 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">
                      {isAr ? '-- اختر الولاية --' : '-- Choisir la Wilaya --'}
                    </option>
                    {ALGERIA_WILAYAS_69.map((w) => (
                      <option key={w.code} value={`${w.codeStr} - ${w.nameAr}`}>
                        {w.codeStr} - {isAr ? w.nameAr : `${w.nameFr} (${w.nameAr})`}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  {isAr ? 'ملاحظات' : 'Notes'}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? 'ملاحظات' : 'Notes'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Product Quantities Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-800">
                {isAr ? 'الكميات (بالمتر):' : 'Quantités (en mètres):'}
              </label>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md">
                {isAr ? 'متر (م)' : 'Mètres (m)'}
              </span>
            </div>

            <div className="space-y-3">
              {/* Gamme 152 */}
              <div>
                <div className="text-[11px] font-bold text-neutral-500 mb-1.5 flex items-center gap-1.5">
                  <span className="bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded text-[10px] font-black">152</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* 152 Vert */}
                  <div className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/50 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span className="truncate">152 Vert</span>
                      <span className="text-[10px] text-neutral-500 font-normal shrink-0">({currentStock.qty152Vert} {isAr ? 'م' : 'm'})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={qty152Vert}
                        onChange={(e) => setQty152Vert(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full ps-2 pe-6 py-2 bg-white border border-emerald-300 rounded-lg text-center font-black text-base text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">
                        {isAr ? 'م' : 'm'}
                      </span>
                    </div>
                  </div>

                  {/* 152 Bleu */}
                  <div className="p-2.5 rounded-xl border border-blue-300 bg-blue-50/50 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-800">
                      <span className="truncate">152 Bleu</span>
                      <span className="text-[10px] text-neutral-500 font-normal shrink-0">({currentStock.qty152Bleu} {isAr ? 'م' : 'm'})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={qty152Bleu}
                        onChange={(e) => setQty152Bleu(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full ps-2 pe-6 py-2 bg-white border border-blue-300 rounded-lg text-center font-black text-base text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">
                        {isAr ? 'م' : 'm'}
                      </span>
                    </div>
                  </div>

                  {/* 152 Noir */}
                  <div className="p-2.5 rounded-xl border border-neutral-400 bg-neutral-100/70 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-neutral-900">
                      <span className="truncate">152 Noir</span>
                      <span className="text-[10px] text-neutral-500 font-normal shrink-0">({currentStock.qty152Noir} {isAr ? 'م' : 'm'})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={qty152Noir}
                        onChange={(e) => setQty152Noir(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full ps-2 pe-6 py-2 bg-white border border-neutral-400 rounded-lg text-center font-black text-base text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-neutral-700"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">
                        {isAr ? 'م' : 'm'}
                      </span>
                    </div>
                  </div>

                  {/* 152 K.S */}
                  <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50/60 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span className="truncate">152 K.S</span>
                      <span className="text-[10px] text-neutral-500 font-normal shrink-0">({currentStock.qty152KS} {isAr ? 'م' : 'm'})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={qty152KS}
                        onChange={(e) => setQty152KS(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full ps-2 pe-6 py-2 bg-white border border-amber-300 rounded-lg text-center font-black text-base text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">
                        {isAr ? 'م' : 'm'}
                      </span>
                    </div>
                  </div>

                  {/* 152 K.F */}
                  <div className="p-2.5 rounded-xl border border-orange-300 bg-orange-50/60 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-orange-950">
                      <span className="truncate">152 K.F</span>
                      <span className="text-[10px] text-neutral-500 font-normal shrink-0">({currentStock.qty152KF} {isAr ? 'م' : 'm'})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={qty152KF}
                        onChange={(e) => setQty152KF(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full ps-2 pe-6 py-2 bg-white border border-orange-300 rounded-lg text-center font-black text-base text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">
                        {isAr ? 'م' : 'm'}
                      </span>
                    </div>
                  </div>

                  {/* 152 Gris */}
                  <div className="p-2.5 rounded-xl border border-slate-300 bg-slate-100/70 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="truncate">152 Gris</span>
                      <span className="text-[10px] text-neutral-500 font-normal shrink-0">({currentStock.qty152Gris} {isAr ? 'م' : 'm'})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={qty152Gris}
                        onChange={(e) => setQty152Gris(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full ps-2 pe-6 py-2 bg-white border border-slate-300 rounded-lg text-center font-black text-base text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-slate-500"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">
                        {isAr ? 'م' : 'm'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gamme 124 */}
              <div>
                <div className="text-[11px] font-bold text-neutral-500 mb-1.5 flex items-center gap-1.5">
                  <span className="bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded text-[10px] font-black">124</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5">
                  {/* 124 Vert */}
                  <div className="p-2.5 rounded-xl border border-teal-300 bg-teal-50/50 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-teal-800">
                      <span className="truncate">124 Vert</span>
                      <span className="text-[10px] text-neutral-500 font-normal shrink-0">({currentStock.qty124Vert} {isAr ? 'م' : 'm'})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={qty124Vert}
                        onChange={(e) => setQty124Vert(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full ps-2 pe-6 py-2 bg-white border border-teal-300 rounded-lg text-center font-black text-base text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">
                        {isAr ? 'م' : 'm'}
                      </span>
                    </div>
                  </div>

                  {/* 124 Bleu */}
                  <div className="p-2.5 rounded-xl border border-sky-300 bg-sky-50/50 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-800">
                      <span className="truncate">124 Bleu</span>
                      <span className="text-[10px] text-neutral-500 font-normal shrink-0">({currentStock.qty124Bleu} {isAr ? 'م' : 'm'})</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={qty124Bleu}
                        onChange={(e) => setQty124Bleu(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full ps-2 pe-6 py-2 bg-white border border-sky-300 rounded-lg text-center font-black text-base text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">
                        {isAr ? 'م' : 'm'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Montant & Notes (for Sortie) */}
          {formMode === 'sortie' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  {isAr ? 'المبلغ (دج)' : 'Montant (DZD)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-bold text-neutral-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                    دج
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  {isAr ? 'ملاحظات' : 'Notes'}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? 'ملاحظات' : 'Notes'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm text-neutral-800 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Live Total Meters Summary */}
          {(() => {
            const currentTotalMeters = 
              (Number(qty152Vert) || 0) +
              (Number(qty152Bleu) || 0) +
              (Number(qty152Noir) || 0) +
              (Number(qty152KS) || 0) +
              (Number(qty152KF) || 0) +
              (Number(qty152Gris) || 0) +
              (Number(qty124Vert) || 0) +
              (Number(qty124Bleu) || 0);

            if (currentTotalMeters <= 0) return null;

            return (
              <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-100/90 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800">
                <span className="flex items-center gap-1.5">
                  <span>📏</span>
                  <span>{isAr ? 'المجموع:' : 'Total :'}</span>
                </span>
                <span className="font-mono text-sm text-neutral-900 font-black">
                  {currentTotalMeters.toLocaleString()} {isAr ? 'م' : 'm'}
                </span>
              </div>
            );
          })()}

          {/* Action Submit Button */}
          {/* Action Buttons: Submit & Reset */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="submit"
              className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base text-white shadow-md transition cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2 ${
                formMode === 'entree'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              {formMode === 'entree' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
              <span>
                {formMode === 'entree'
                  ? (isAr ? 'حفظ و الاستلام' : 'Enregistrer l’Entrée')
                  : (isAr ? 'حفظ و تسجيل البيع' : 'Enregistrer la Sortie')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleResetForm}
              title={isAr ? 'تفريغ وتصفير الحقول' : 'Réinitialiser les champs'}
              className="py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-900 border border-neutral-300 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-4 h-4 text-neutral-500" />
              <span>{isAr ? 'تفريغ الحقول' : 'Vider'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. Table Filter & Search Header */}
      <div className="bg-white rounded-2xl p-3 border border-neutral-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {isAr ? `كل العمليات (${entrees.length + sorties.length})` : `Tous (${entrees.length + sorties.length})`}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('entrees')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeFilter === 'entrees'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {isAr ? `الوارد (${entrees.length})` : `Entrées (${entrees.length})`}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('sorties')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeFilter === 'sorties'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {isAr ? `المبيعات (${sorties.length})` : `Sorties (${sorties.length})`}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('synthese')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
              activeFilter === 'synthese'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {isAr ? 'ملخص المخزون' : 'Synthèse'}
          </button>
        </div>

        {/* Quick Search */}
        {activeFilter !== 'synthese' && (
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'بحث بالزبون أو التاريخ...' : 'Rechercher...'}
              className="w-full ps-8 pe-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. Main Content: Table or Synthèse */}
      {activeFilter === 'synthese' ? (
        /* Synthèse Summary View */
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
          <div className="p-4 bg-neutral-50/70 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-700" />
              <h3 className="text-xs font-bold text-neutral-900">
                {isAr ? 'ملخص المخزون' : 'Synthèse du stock'}
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4 text-start font-bold">{isAr ? 'المنتج' : 'Produit'}</th>
                  <th className="py-3 px-4 text-center font-bold">{isAr ? 'المخزون الأولي (م)' : 'Stock Initial (m)'}</th>
                  <th className="py-3 px-4 text-center font-bold text-emerald-700">{isAr ? 'الوارد (م)' : 'Entrées (m)'}</th>
                  <th className="py-3 px-4 text-center font-bold text-blue-700">{isAr ? 'المباع (م)' : 'Sorties (m)'}</th>
                  <th className="py-3 px-4 text-center font-bold text-neutral-900 bg-neutral-200/50">{isAr ? 'المتبقي (م)' : 'Stock Restant (m)'}</th>
                  <th className="py-3 px-4 text-end font-bold text-amber-800">{isAr ? 'الحالة' : 'Statut'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {/* 152 Vert */}
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-emerald-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    152 Vert
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">0 {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">+{totalEntree152V} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">-{totalSortie152V} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-black text-emerald-800 bg-emerald-50 text-sm font-mono">
                    {currentStock.qty152Vert} <span className="text-xs font-semibold">{isAr ? 'م' : 'm'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-bold text-emerald-700">
                    {currentStock.qty152Vert > 10 ? (isAr ? '✅ متوفر' : '✅ Dispo') : (isAr ? '⚠️ قليل' : '⚠️ Faible')}
                  </td>
                </tr>

                {/* 152 Bleu */}
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-blue-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    152 Bleu
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">0 {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">+{totalEntree152B} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">-{totalSortie152B} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-black text-blue-800 bg-blue-50 text-sm font-mono">
                    {currentStock.qty152Bleu} <span className="text-xs font-semibold">{isAr ? 'م' : 'm'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-bold text-blue-700">
                    {currentStock.qty152Bleu > 10 ? (isAr ? 'متوفر' : 'Dispo') : (isAr ? 'قليل' : 'Faible')}
                  </td>
                </tr>

                {/* 152 Noir */}
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-neutral-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 shrink-0" />
                    152 Noir
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">0 {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">+{totalEntree152N} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">-{totalSortie152N} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-black text-neutral-900 bg-neutral-100 text-sm font-mono">
                    {currentStock.qty152Noir} <span className="text-xs font-semibold">{isAr ? 'م' : 'm'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-bold text-neutral-800">
                    {currentStock.qty152Noir > 10 ? (isAr ? 'متوفر' : 'Dispo') : (isAr ? 'قليل' : 'Faible')}
                  </td>
                </tr>

                {/* 152 K.S */}
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-amber-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
                    152 K.S
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">0 {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">+{totalEntree152KS} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">-{totalSortie152KS} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-black text-amber-900 bg-amber-50 text-sm font-mono">
                    {currentStock.qty152KS} <span className="text-xs font-semibold">{isAr ? 'م' : 'm'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-bold text-amber-800">
                    {currentStock.qty152KS > 10 ? (isAr ? 'متوفر' : 'Dispo') : (isAr ? 'قليل' : 'Faible')}
                  </td>
                </tr>

                {/* 152 K.F */}
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-orange-950 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-800 shrink-0" />
                    152 K.F
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">0 {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">+{totalEntree152KF} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">-{totalSortie152KF} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-black text-amber-950 bg-orange-50 text-sm font-mono">
                    {currentStock.qty152KF} <span className="text-xs font-semibold">{isAr ? 'م' : 'm'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-bold text-orange-900">
                    {currentStock.qty152KF > 10 ? (isAr ? 'متوفر' : 'Dispo') : (isAr ? 'قليل' : 'Faible')}
                  </td>
                </tr>

                {/* 152 Gris */}
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                    152 Gris
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">0 {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">+{totalEntree152G} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">-{totalSortie152G} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-black text-slate-800 bg-slate-100 text-sm font-mono">
                    {currentStock.qty152Gris} <span className="text-xs font-semibold">{isAr ? 'م' : 'm'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-bold text-slate-700">
                    {currentStock.qty152Gris > 10 ? (isAr ? 'متوفر' : 'Dispo') : (isAr ? 'قليل' : 'Faible')}
                  </td>
                </tr>

                {/* 124 Vert */}
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-teal-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                    124 Vert
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">0 {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">+{totalEntree124V} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">-{totalSortie124V} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-black text-teal-800 bg-teal-50 text-sm font-mono">
                    {currentStock.qty124Vert} <span className="text-xs font-semibold">{isAr ? 'م' : 'm'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-bold text-teal-700">
                    {currentStock.qty124Vert > 10 ? (isAr ? 'متوفر' : 'Dispo') : (isAr ? 'قليل' : 'Faible')}
                  </td>
                </tr>

                {/* 124 Bleu */}
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-sky-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                    124 Bleu
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">0 {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">+{totalEntree124B} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700 font-mono">-{totalSortie124B} {isAr ? 'م' : 'm'}</td>
                  <td className="py-2.5 px-3 text-center font-black text-sky-800 bg-sky-50 text-sm font-mono">
                    {currentStock.qty124Bleu} <span className="text-xs font-semibold">{isAr ? 'م' : 'm'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-end font-bold text-sky-700">
                    {currentStock.qty124Bleu > 10 ? (isAr ? 'متوفر' : 'Dispo') : (isAr ? 'قليل' : 'Faible')}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-neutral-100 font-bold border-t border-neutral-300">
                <tr>
                  <td className="py-3 px-4 text-neutral-900">{isAr ? 'المجموع' : 'Total'}</td>
                  <td className="py-3 px-4 text-center text-neutral-500">0</td>
                  <td className="py-3 px-4 text-center text-emerald-700 font-mono">
                    +{totalEntree152V + totalEntree152B + totalEntree152N + totalEntree152KS + totalEntree152KF + totalEntree152G + totalEntree124V + totalEntree124B} {isAr ? 'م' : 'm'}
                  </td>
                  <td className="py-3 px-4 text-center text-blue-700 font-mono">
                    -{totalSortie152V + totalSortie152B + totalSortie152N + totalSortie152KS + totalSortie152KF + totalSortie152G + totalSortie124V + totalSortie124B} {isAr ? 'م' : 'm'}
                  </td>
                  <td className="py-3 px-4 text-center text-neutral-900 bg-neutral-200/60 text-sm font-mono">
                    {currentStock.qty152Vert + currentStock.qty152Bleu + currentStock.qty152Noir + currentStock.qty152KS + currentStock.qty152KF + currentStock.qty152Gris + currentStock.qty124Vert + currentStock.qty124Bleu} {isAr ? 'م' : 'm'}
                  </td>
                  <td className="py-3 px-4 text-end text-amber-900 font-mono text-sm">
                    {totalMontant.toLocaleString()} دج
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* Unified Operations Table */
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
          {combinedOperations.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-1">
              <FileSpreadsheet className="w-8 h-8 text-neutral-300 mx-auto" />
              <h4 className="text-sm font-medium text-neutral-500">
                {isAr ? 'لا توجد سجلات' : 'Aucune opération'}
              </h4>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-3 text-start font-bold">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="py-3 px-3 text-start font-bold">{isAr ? 'النوع' : 'Type'}</th>
                    <th className="py-3 px-3 text-start font-bold">{isAr ? 'الزبون / البيان' : 'Client / Notes'}</th>
                    <th className="py-3 px-3 text-start font-bold">{isAr ? 'الولاية' : 'Wilaya'}</th>
                    <th className="py-3 px-2 text-center font-bold text-emerald-800">152 Vert (م)</th>
                    <th className="py-3 px-2 text-center font-bold text-blue-800">152 Bleu (م)</th>
                    <th className="py-3 px-2 text-center font-bold text-neutral-900">152 Noir (م)</th>
                    <th className="py-3 px-2 text-center font-bold text-amber-900">152 K.S (م)</th>
                    <th className="py-3 px-2 text-center font-bold text-orange-950">152 K.F (م)</th>
                    <th className="py-3 px-2 text-center font-bold text-slate-800">152 Gris (م)</th>
                    <th className="py-3 px-2 text-center font-bold text-teal-800">124 Vert (م)</th>
                    <th className="py-3 px-2 text-center font-bold text-sky-800">124 Bleu (م)</th>
                    <th className="py-3 px-3 text-end font-bold text-amber-900">{isAr ? 'المبلغ' : 'Montant'}</th>
                    <th className="py-3 px-3 text-center font-bold">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {combinedOperations.map((row) => {
                    const isEntree = row.type === 'entree';
                    return (
                      <tr key={row.item.id} className="hover:bg-neutral-50/80 transition">
                        {/* Date */}
                        <td className="py-3 px-3 text-neutral-700 whitespace-nowrap font-mono text-[11px]">
                          {row.item.date}
                        </td>

                        {/* Type badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isEntree ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {isAr ? 'استلام' : 'Entrée'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {isAr ? 'بيع' : 'Sortie'}
                            </span>
                          )}
                        </td>

                        {/* Details / Client */}
                        <td className="py-3 px-3 max-w-[180px] truncate text-neutral-800">
                          <div className="font-semibold truncate">
                            {isEntree
                              ? row.item.notes || (isAr ? 'استلام مخزون' : 'Réception')
                              : (row.item as SortieItem).client}
                          </div>
                          {!isEntree && row.item.notes && (
                            <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                              {row.item.notes}
                            </div>
                          )}
                        </td>

                        {/* Wilaya (Sortie) */}
                        <td className="py-3 px-3 whitespace-nowrap text-neutral-700 font-medium text-[11px]">
                          {!isEntree && (row.item as SortieItem).wilaya ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 border border-neutral-200 font-semibold">
                              {(row.item as SortieItem).wilaya}
                            </span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* 152 Vert */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                          {(row.item.qty152Vert || 0) > 0 ? (
                            <span className="text-emerald-700 font-extrabold">{row.item.qty152Vert} <span className="text-[10px] font-normal text-neutral-400">{isAr ? 'م' : 'm'}</span></span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* 152 Bleu */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                          {(row.item.qty152Bleu || 0) > 0 ? (
                            <span className="text-blue-700 font-extrabold">{row.item.qty152Bleu} <span className="text-[10px] font-normal text-neutral-400">{isAr ? 'م' : 'm'}</span></span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* 152 Noir */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                          {(row.item.qty152Noir || 0) > 0 ? (
                            <span className="text-neutral-900 font-extrabold">{row.item.qty152Noir} <span className="text-[10px] font-normal text-neutral-400">{isAr ? 'م' : 'm'}</span></span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* 152 K.S */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                          {(row.item.qty152KS || 0) > 0 ? (
                            <span className="text-amber-800 font-extrabold">{row.item.qty152KS} <span className="text-[10px] font-normal text-neutral-400">{isAr ? 'م' : 'm'}</span></span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* 152 K.F */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                          {(row.item.qty152KF || 0) > 0 ? (
                            <span className="text-orange-950 font-extrabold">{row.item.qty152KF} <span className="text-[10px] font-normal text-neutral-400">{isAr ? 'م' : 'm'}</span></span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* 152 Gris */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                          {(row.item.qty152Gris || 0) > 0 ? (
                            <span className="text-slate-800 font-extrabold">{row.item.qty152Gris} <span className="text-[10px] font-normal text-neutral-400">{isAr ? 'م' : 'm'}</span></span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* 124 Vert */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                          {(row.item.qty124Vert || 0) > 0 ? (
                            <span className="text-teal-700 font-extrabold">{row.item.qty124Vert} <span className="text-[10px] font-normal text-neutral-400">{isAr ? 'م' : 'm'}</span></span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* 124 Bleu */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                          {(row.item.qty124Bleu || 0) > 0 ? (
                            <span className="text-sky-700 font-extrabold">{row.item.qty124Bleu} <span className="text-[10px] font-normal text-neutral-400">{isAr ? 'م' : 'm'}</span></span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* Montant */}
                        <td className="py-3 px-3 text-end font-mono font-bold whitespace-nowrap text-amber-900">
                          {!isEntree && (row.item as SortieItem).montant > 0 ? (
                            `${(row.item as SortieItem).montant.toLocaleString()} دج`
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>

                        {/* Actions: Edit & Delete */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(row)}
                              className="p-1.5 text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title={isAr ? 'تعديل السجل' : 'Modifier'}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title={isAr ? 'حذف السجل' : 'Supprimer'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Compact Google Sheets Bar at Bottom of Page */}
      <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-neutral-800 text-xs truncate max-w-[220px] sm:max-w-none">
                {activeSpreadsheet ? activeSpreadsheet.title : (isAr ? 'ملف Google Sheets' : 'Fichier Google Sheets')}
              </span>
              {activeSpreadsheet ? (
                tokenNeedsRefresh ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-300 shrink-0">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                    <span>{isAr ? 'انتهت الجلسة' : 'Session expirée'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                    <span>{isAr ? 'متصل ✓' : 'Connecté ✓'}</span>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full shrink-0">
                  <span>{isAr ? 'حفظ محلي' : 'Mode local'}</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-400 leading-tight">
              {tokenNeedsRefresh
                ? (isAr ? 'يرجى تجديد الجلسة' : 'Session expirée')
                : (isAr 
                    ? `${entrees.length} وارد • ${sorties.length} مبيعات`
                    : `${entrees.length} entrées • ${sorties.length} sorties`)}
            </p>
          </div>
        </div>

        {/* Small Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {tokenNeedsRefresh && onConnectDriveOnce && (
            <button
              type="button"
              onClick={onConnectDriveOnce}
              disabled={isConnectingDrive}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isConnectingDrive ? 'animate-spin' : ''}`} />
              <span>{isConnectingDrive ? '...' : (isAr ? 'تجديد' : 'Renouveler')}</span>
            </button>
          )}

          {onManualSyncNow && !tokenNeedsRefresh && (
            <button
              type="button"
              onClick={onManualSyncNow}
              disabled={isAutoSyncing}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${isAutoSyncing ? 'animate-spin' : ''}`} />
              <span>{isAutoSyncing ? (isAr ? 'حفظ...' : 'Synchro...') : (isAr ? 'مزامنة' : 'Synchroniser')}</span>
            </button>
          )}

          {activeSpreadsheet?.url ? (
            <div className="flex items-center gap-1">
              <a
                href={activeSpreadsheet.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold transition"
              >
                <ExternalLink className="w-3 h-3 text-neutral-500" />
                <span>{isAr ? 'فتح الملف' : 'Ouvrir'}</span>
              </a>
              {onOpenDriveModal && (
                <button
                  type="button"
                  onClick={onOpenDriveModal}
                  className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition"
                  title={isAr ? 'الإعدادات' : 'Paramètres'}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            onConnectDriveOnce && (
              <button
                type="button"
                onClick={onConnectDriveOnce}
                disabled={isConnectingDrive}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition"
              >
                <Cloud className="w-3 h-3" />
                <span>{isConnectingDrive ? '...' : (isAr ? 'ربط Drive' : 'Lier Drive')}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 6. Edit Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden">
            <div className={`px-5 py-4 text-white flex items-center justify-between ${
              editingRow.type === 'entree' ? 'bg-emerald-700' : 'bg-blue-700'
            }`}>
              <h3 className="text-sm font-bold">
                {editingRow.type === 'entree'
                  ? (isAr ? 'تعديل وصل استلام (Entrée)' : 'Modifier Entrée')
                  : (isAr ? 'تعديل وصل بيع (Sortie)' : 'Modifier Sortie')}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="p-1 text-white/80 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">{isAr ? 'التاريخ' : 'Date'}</label>
                <input
                  type="date"
                  required
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl"
                />
              </div>

              {editingRow.type === 'sortie' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">{isAr ? 'اسم الزبون' : 'Client'}</label>
                    <input
                      type="text"
                      required
                      value={editFormData.client}
                      onChange={(e) => setEditFormData({ ...editFormData, client: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">{isAr ? 'الولاية' : 'Wilaya'}</label>
                    <select
                      value={editFormData.wilaya}
                      onChange={(e) => setEditFormData({ ...editFormData, wilaya: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl bg-white"
                    >
                      <option value="">
                        {isAr ? '-- اختر الولاية --' : '-- Choisir la Wilaya --'}
                      </option>
                      {ALGERIA_WILAYAS_69.map((w) => (
                        <option key={w.code} value={`${w.codeStr} - ${w.nameAr}`}>
                          {w.codeStr} - {isAr ? w.nameAr : `${w.nameFr} (${w.nameAr})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-neutral-700 block">
                  {isAr ? 'الكميات بالمتر (م):' : 'Quantités en mètres (m):'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block font-bold text-emerald-800 text-[11px] mb-1">152 Vert (م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.qty152Vert}
                      onChange={(e) => setEditFormData({ ...editFormData, qty152Vert: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-blue-800 text-[11px] mb-1">152 Bleu (م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.qty152Bleu}
                      onChange={(e) => setEditFormData({ ...editFormData, qty152Bleu: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-blue-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-neutral-900 text-[11px] mb-1">152 Noir (م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.qty152Noir}
                      onChange={(e) => setEditFormData({ ...editFormData, qty152Noir: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-amber-900 text-[11px] mb-1">152 K.S (م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.qty152KS}
                      onChange={(e) => setEditFormData({ ...editFormData, qty152KS: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-orange-950 text-[11px] mb-1">152 K.F (م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.qty152KF}
                      onChange={(e) => setEditFormData({ ...editFormData, qty152KF: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-orange-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 text-[11px] mb-1">152 Gris (م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.qty152Gris}
                      onChange={(e) => setEditFormData({ ...editFormData, qty152Gris: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-teal-800 text-[11px] mb-1">124 Vert (م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.qty124Vert}
                      onChange={(e) => setEditFormData({ ...editFormData, qty124Vert: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-teal-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-sky-800 text-[11px] mb-1">124 Bleu (م)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.qty124Bleu}
                      onChange={(e) => setEditFormData({ ...editFormData, qty124Bleu: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-sky-300 rounded-lg text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {editingRow.type === 'sortie' && (
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">{isAr ? 'المبلغ (دج)' : 'Montant'}</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.montant}
                    onChange={(e) => setEditFormData({ ...editFormData, montant: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-neutral-700 mb-1">{isAr ? 'ملاحظات' : 'Notes'}</label>
                <input
                  type="text"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-bold"
                >
                  {isAr ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800"
                >
                  {isAr ? 'حفظ التعديل ✓' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Row Confirmation Modal */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                {isAr ? 'تأكيد حذف العملية' : 'Confirmer la suppression'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                {isAr
                  ? `هل أنت متأكد من حذف هذه العملية (${rowToDelete.type === 'entree' ? 'وصل استلام' : 'وصل بيع'} بتاريخ ${rowToDelete.item.date}) نهائياً؟`
                  : `Supprimer définitivement cette opération du ${rowToDelete.item.date} ?`}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="px-4 py-2 border border-neutral-200 text-neutral-700 rounded-xl font-bold text-xs hover:bg-neutral-50 transition"
              >
                {isAr ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRow}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition shadow-xs"
              >
                {isAr ? 'نعم، حذف' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
