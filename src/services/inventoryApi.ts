import { EntreeItem, SortieItem } from '../types/stock';

export interface InventorySnapshot {
  entrees: EntreeItem[];
  sorties: SortieItem[];
  target?: { file: string; url: string; entreeTab: string; entreeRows: number; sortieTab: string; sortieRows: number };
}

export type InventoryOp =
  | { action: 'add'; sheet: 'entree'; item: EntreeItem }
  | { action: 'add'; sheet: 'sortie'; item: SortieItem }
  | { action: 'update'; sheet: 'entree'; item: EntreeItem }
  | { action: 'update'; sheet: 'sortie'; item: SortieItem }
  | { action: 'delete'; sheet: 'entree' | 'sortie'; id: string };

// رابط Apps Script (يعمل على GitHub Pages أيضاً لأنه لا يحتاج خادماً). يمكن تغييره بـ VITE_SHEET_WEBHOOK_URL
const WEBHOOK_URL: string =
  ((import.meta as any).env?.VITE_SHEET_WEBHOOK_URL as string) ||
  'https://script.google.com/macros/s/AKfycbz_YAxQXJQaMZjLWxpd8_MUj4YKuAT50OIIvH34cf10cMmBXdjDLPK7E4Ivf8USXDDx/exec';

async function parse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Google returns an HTML page when the deployment is not "Anyone" or the URL is wrong
    throw new Error('WEBHOOK_NOT_JSON (تحقق من نشر السكربت: Anyone)');
  }
}

/** القراءة: ما في الجدول فقط (أي متصفح أو هاتف) */
export async function fetchInventory(): Promise<InventorySnapshot> {
  const res = await fetch(`${WEBHOOK_URL}?action=read&t=${Date.now()}`, { redirect: 'follow' });
  const json = await parse(res);
  if (json?.status !== 'ok' || !Array.isArray(json.entrees) || !Array.isArray(json.sorties)) {
    throw new Error(
      json?.error ||
        (json?.message ? 'السكربت القديم ما زال منشوراً — انشر إصداراً جديداً من Code.gs' : 'SHEET_READ_FAILED')
    );
  }
  return { entrees: json.entrees, sorties: json.sorties, target: json.target };
}

/** الكتابة: عملية واحدة على سطر واحد، والرد هو الحالة الحقيقية من الجدول */
export async function sendInventoryOp(op: InventoryOp): Promise<InventorySnapshot> {
  // text/plain يتجنب طلب preflight الذي لا يدعمه Apps Script
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(op),
    redirect: 'follow',
  });
  const json = await parse(res);
  if (json?.status !== 'success' || !Array.isArray(json.entrees) || !Array.isArray(json.sorties)) {
    throw new Error(json?.error || json?.message || 'SHEET_WRITE_FAILED');
  }
  return { entrees: json.entrees, sorties: json.sorties, target: json.target };
}
