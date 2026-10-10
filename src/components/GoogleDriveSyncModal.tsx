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

    // Protected v2 Google Apps Script (source of truth). Stored as a JSON string
  // so quotes/backslashes/newlines are escaped safely for TypeScript.
  // Layout: Entrée = Date|8 produits|Notes|ID ; Sortie = Date|Client|8 produits|Montant|Notes|Wilaya|ID.
  // It never clears the sheet, works row-by-row by ID, and logs edits to a "Journal" sheet.
  const APPS_SCRIPT_CODE = "/**\r\n * نظام إدارة المخزون والمبيعات (152 & 124) — النسخة المحمية\r\n *\r\n * المبدأ: الجدول (Google Sheet) هو المصدر الوحيد للحقيقة.\r\n *  - لا يوجد أي مسح (clear) للجدول إطلاقاً.\r\n *  - كل عملية = سطر واحد فقط (إضافة / تعديل / حذف) بواسطة المعرّف ID.\r\n *  - أي تعديل أو حذف يُسجَّل أولاً في ورقة \"Journal\" (نسخة احتياطية).\r\n *  - LockService يمنع تضارب جهازين يكتبان في نفس اللحظة.\r\n *  - القراءة (doGet?action=read) تعيد ما في الجدول فقط، لأي متصفح أو هاتف.\r\n */\r\n\r\nvar SH_IN = \"Feuille 1 Entrée\";\r\nvar SH_OUT = \"Feuille 2 Sortie\";\r\nvar SH_SYN = \"Feuille 3 Synthèse\";\r\nvar SH_LOG = \"Journal\";\r\n\r\nvar QTY = [\"qty152Vert\", \"qty152Bleu\", \"qty152Noir\", \"qty152KS\", \"qty152KF\", \"qty152Gris\", \"qty124Vert\", \"qty124Bleu\"];\r\n\r\n// ترتيب الأعمدة (المعرّف ID في آخر عمود حتى لا تتغير الأعمدة القديمة)\r\nvar IN_HEAD = [\"Date\", \"152 Vert\", \"152 Bleu\", \"152 Noir\", \"152 K.S\", \"152 K.F\", \"152 Gris\", \"124 Vert\", \"124 Bleu\", \"Notes\", \"ID\"];\r\nvar OUT_HEAD = [\"Date\", \"Client\", \"152 Vert\", \"152 Bleu\", \"152 Noir\", \"152 K.S\", \"152 K.F\", \"152 Gris\", \"124 Vert\", \"124 Bleu\", \"Montant\", \"Notes\", \"Wilaya\", \"ID\"];\r\n\r\nfunction json_(obj) {\r\n  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);\r\n}\r\n\r\nfunction norm_(t) {\r\n  return String(t).toLowerCase().normalize(\"NFD\").replace(/[\\u0300-\\u036f]/g, \"\");\r\n}\r\n\r\n/** يبحث عن الورقة الموجودة فعلاً (حتى لو اسمها مختلف قليلاً) قبل إنشاء ورقة جديدة */\r\nfunction findSheet_(ss, name) {\r\n  var exact = ss.getSheetByName(name);\r\n  if (exact) return exact;\r\n  var re = name === SH_IN ? /entree|وارد/ : name === SH_OUT ? /sortie|صادر|مبيع/ : name === SH_SYN ? /synthese|ملخص/ : null;\r\n  if (!re) return null;\r\n  var all = ss.getSheets();\r\n  for (var i = 0; i < all.length; i++) {\r\n    if (re.test(norm_(all[i].getName())) && all[i].getName() !== SH_LOG) return all[i];\r\n  }\r\n  return null;\r\n}\r\n\r\nfunction sheet_(name, head) {\r\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\r\n  var sh = findSheet_(ss, name) || ss.insertSheet(name);\r\n  if (sh.getLastRow() === 0) {\r\n    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight(\"bold\");\r\n    sh.setFrozenRows(1);\r\n  } else if (sh.getLastColumn() < head.length) {\r\n    // ترقية جدول قديم: إضافة الأعمدة الناقصة (Wilaya / ID) دون لمس البيانات\r\n    var old = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];\r\n    if (old.join(\"|\") !== head.slice(0, old.length).join(\"|\")) {\r\n      throw new Error(\"Structure inattendue dans \" + name + \" — modification refusée pour protéger les données.\");\r\n    }\r\n    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight(\"bold\");\r\n  }\r\n  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat(\"@\"); // التاريخ كنص\r\n  return sh;\r\n}\r\n\r\nfunction newId_(prefix) {\r\n  return prefix + \"-\" + Utilities.getUuid().slice(0, 8);\r\n}\r\n\r\nfunction dateStr_(v) {\r\n  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), \"yyyy-MM-dd\");\r\n  return String(v || \"\");\r\n}\r\n\r\n/** يعطي معرّفاً لأي سطر قديم ليس له ID (ترحيل لمرة واحدة، لا يغيّر الكميات) */\r\nfunction ensureIds_(sh, idCol, prefix) {\r\n  var last = sh.getLastRow();\r\n  if (last < 2) return;\r\n  var rng = sh.getRange(2, idCol, last - 1, 1);\r\n  var vals = rng.getValues();\r\n  var changed = false;\r\n  for (var i = 0; i < vals.length; i++) {\r\n    if (!vals[i][0]) { vals[i][0] = newId_(prefix); changed = true; }\r\n  }\r\n  if (changed) rng.setValues(vals);\r\n}\r\n\r\nfunction readIn_() {\r\n  var sh = sheet_(SH_IN, IN_HEAD);\r\n  ensureIds_(sh, 11, \"e\");\r\n  var last = sh.getLastRow();\r\n  if (last < 2) return [];\r\n  return sh.getRange(2, 1, last - 1, 11).getValues()\r\n    .filter(function (r) { return r[10]; })\r\n    .map(function (r) {\r\n      var o = { id: String(r[10]), date: dateStr_(r[0]), notes: String(r[9] || \"\") };\r\n      QTY.forEach(function (k, i) { o[k] = Number(r[1 + i]) || 0; });\r\n      return o;\r\n    });\r\n}\r\n\r\nfunction readOut_() {\r\n  var sh = sheet_(SH_OUT, OUT_HEAD);\r\n  ensureIds_(sh, 14, \"s\");\r\n  var last = sh.getLastRow();\r\n  if (last < 2) return [];\r\n  return sh.getRange(2, 1, last - 1, 14).getValues()\r\n    .filter(function (r) { return r[13]; })\r\n    .map(function (r) {\r\n      var o = { id: String(r[13]), date: dateStr_(r[0]), client: String(r[1] || \"\"),\r\n                montant: Number(r[10]) || 0, notes: String(r[11] || \"\"), wilaya: String(r[12] || \"\") };\r\n      QTY.forEach(function (k, i) { o[k] = Number(r[2 + i]) || 0; });\r\n      return o;\r\n    });\r\n}\r\n\r\nfunction rowIn_(it) {\r\n  return [dateStr_(it.date)].concat(QTY.map(function (k) { return Number(it[k]) || 0; }), [it.notes || \"\", it.id]);\r\n}\r\n\r\nfunction rowOut_(it) {\r\n  return [dateStr_(it.date), it.client || \"Client\"].concat(QTY.map(function (k) { return Number(it[k]) || 0; }),\r\n    [Number(it.montant) || 0, it.notes || \"\", it.wilaya || \"\", it.id]);\r\n}\r\n\r\nfunction log_(action, kind, before, after) {\r\n  var sh = sheet_(SH_LOG, [\"Horodatage\", \"Action\", \"Feuille\", \"Avant\", \"Après\"]);\r\n  sh.appendRow([new Date(), action, kind, before ? JSON.stringify(before) : \"\", after ? JSON.stringify(after) : \"\"]);\r\n}\r\n\r\nfunction findRow_(sh, idCol, id) {\r\n  var last = sh.getLastRow();\r\n  if (last < 2) return -1;\r\n  var ids = sh.getRange(2, idCol, last - 1, 1).getValues();\r\n  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;\r\n  return -1;\r\n}\r\n\r\nfunction ensureSynthese_() {\r\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\r\n  var s3 = findSheet_(ss, SH_SYN);\r\n  if (s3 && s3.getLastRow() > 0) return; // لا نلمس ملخصاً موجوداً\r\n  s3 = s3 || ss.insertSheet(SH_SYN);\r\n  var names = [\"152 Vert\", \"152 Bleu\", \"152 Noir\", \"152 K.S\", \"152 K.F\", \"152 Gris\", \"124 Vert\", \"124 Bleu\"];\r\n  var cols = [\"B\", \"C\", \"D\", \"E\", \"F\", \"G\", \"H\", \"I\"];\r\n  var outCols = [\"C\", \"D\", \"E\", \"F\", \"G\", \"H\", \"I\", \"J\"];\r\n  var rows = [[\"Produit\", \"Total Entrées\", \"Total Sorties\", \"Stock Restant\", \"Statut du Stock\"]];\r\n  names.forEach(function (n, i) {\r\n    var r = i + 2;\r\n    rows.push([n, \"=SUM('\" + SH_IN + \"'!\" + cols[i] + \"2:\" + cols[i] + \")\", \"=SUM('\" + SH_OUT + \"'!\" + outCols[i] + \"2:\" + outCols[i] + \")\",\r\n      \"=B\" + r + \"-C\" + r, '=IF(D' + r + '<=10, \"⚠️ Stock Faible\", \"✅ Disponible\")']);\r\n  });\r\n  rows.push([\"\", \"\", \"\", \"\", \"\"]);\r\n  rows.push([\"Chiffre d’affaires Total\", \"=SUM('\" + SH_OUT + \"'!K2:K)\", \"DZD\", \"\", \"\"]);\r\n  s3.getRange(1, 1, rows.length, 5).setValues(rows);\r\n}\r\n\r\n/** أين يكتب السكربت بالضبط؟ (ملف + أسماء الأوراق + عدد الأسطر) */\r\nfunction target_() {\r\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\r\n  var i = sheet_(SH_IN, IN_HEAD), o = sheet_(SH_OUT, OUT_HEAD);\r\n  return { file: ss.getName(), url: ss.getUrl(), entreeTab: i.getName(), entreeRows: Math.max(i.getLastRow() - 1, 0),\r\n           sortieTab: o.getName(), sortieRows: Math.max(o.getLastRow() - 1, 0) };\r\n}\r\n\r\n/** القراءة: ما في الجدول فقط */\r\nfunction doGet(e) {\r\n  try {\r\n    if (e && e.parameter && e.parameter.action === \"read\") {\r\n      return json_({ status: \"ok\", entrees: readIn_(), sorties: readOut_(), readAt: new Date().toISOString() });\r\n    }\r\n    if (e && e.parameter && e.parameter.action === \"info\") {\r\n      return json_({ status: \"ok\", version: \"protected-v2\", target: target_() });\r\n    }\r\n    return json_({ status: \"ok\", version: \"protected-v2\", message: \"Webhook actif (mode protégé)\" });\r\n  } catch (err) {\r\n    return json_({ status: \"error\", error: String(err) });\r\n  }\r\n}\r\n\r\n/** الكتابة: عملية واحدة على سطر واحد */\r\nfunction doPost(e) {\r\n  var lock = LockService.getScriptLock();\r\n  try {\r\n    lock.waitLock(20000);\r\n    var data = JSON.parse(e.postData.contents);\r\n    var kind = data.sheet; // \"entree\" | \"sortie\"\r\n\r\n    // توافق مع النسخة القديمة: لا نكتب فوق شيء أبداً\r\n    if (!data.action) {\r\n      return json_({ status: \"ignored\", message: \"Remplacement complet désactivé pour protéger les données.\" });\r\n    }\r\n\r\n    if (data.action === \"seed\") {\r\n      // تعبئة أولية فقط إذا كان الجدولان فارغين تماماً\r\n      if (readIn_().length === 0 && readOut_().length === 0) {\r\n        var shI = sheet_(SH_IN, IN_HEAD), shO = sheet_(SH_OUT, OUT_HEAD);\r\n        (data.entrees || []).forEach(function (it) { it.id = it.id || newId_(\"e\"); shI.appendRow(rowIn_(it)); });\r\n        (data.sorties || []).forEach(function (it) { it.id = it.id || newId_(\"s\"); shO.appendRow(rowOut_(it)); });\r\n        ensureSynthese_();\r\n        return json_({ status: \"success\", seeded: true, entrees: readIn_(), sorties: readOut_() });\r\n      }\r\n      return json_({ status: \"ignored\", message: \"Le tableau contient déjà des données.\" });\r\n    }\r\n\r\n    var isIn = kind === \"entree\";\r\n    var sh = isIn ? sheet_(SH_IN, IN_HEAD) : sheet_(SH_OUT, OUT_HEAD);\r\n    var idCol = isIn ? 11 : 14;\r\n    var width = isIn ? 11 : 14;\r\n    var toRow = isIn ? rowIn_ : rowOut_;\r\n    var item = data.item || {};\r\n\r\n    if (data.action === \"add\") {\r\n      item.id = item.id || newId_(isIn ? \"e\" : \"s\");\r\n      if (findRow_(sh, idCol, item.id) === -1) {          // منع التكرار عند إعادة الإرسال\r\n        sh.appendRow(toRow(item));\r\n        log_(\"add\", kind, null, item);\r\n      }\r\n    } else if (data.action === \"update\") {\r\n      var r = findRow_(sh, idCol, item.id);\r\n      if (r === -1) return json_({ status: \"error\", error: \"Ligne introuvable (peut-être supprimée sur un autre appareil).\" });\r\n      var before = sh.getRange(r, 1, 1, width).getValues()[0];\r\n      log_(\"update\", kind, before, item);\r\n      sh.getRange(r, 1, 1, width).setValues([toRow(item)]);\r\n    } else if (data.action === \"delete\") {\r\n      var rd = findRow_(sh, idCol, data.id);\r\n      if (rd !== -1) {\r\n        log_(\"delete\", kind, sh.getRange(rd, 1, 1, width).getValues()[0], null);\r\n        sh.deleteRow(rd);\r\n      }\r\n    } else {\r\n      return json_({ status: \"error\", error: \"Action inconnue\" });\r\n    }\r\n\r\n    ensureSynthese_();\r\n    // نعيد الحالة الحقيقية من الجدول ليتحدّث كل جهاز بها\r\n    return json_({ status: \"success\", entrees: readIn_(), sorties: readOut_(), target: target_() });\r\n  } catch (err) {\r\n    return json_({ status: \"error\", error: String(err) });\r\n  } finally {\r\n    try { lock.releaseLock(); } catch (x) {}\r\n  }\r\n}\r\n";

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
                      ? 'مزامنة Apps Script الآمنة'
                      : 'URL Webhook Google Apps Script :'}
                  </span>
                </div>
                <div className="text-[11px] leading-relaxed text-neutral-600">
                  {lang === 'ar'
                    ? 'تُضبط الوصلة والرمز السري في متغيرات Vercel؛ لا تضع الرمز السري في هذه الصفحة. يلزم تسجيل الدخول بحساب Google للمزامنة.'
                    : 'Configurez l’URL et le secret dans les variables Vercel. Le secret ne doit pas apparaître dans cette page.'}
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
