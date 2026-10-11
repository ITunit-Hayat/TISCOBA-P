import { EntreeItem, SortieItem } from '../types/stock';

type InventoryType = 'entree' | 'sortie';

type InventoryMutation =
  | { action: 'add'; sheet: InventoryType; item: EntreeItem | SortieItem }
  | { action: 'update'; sheet: InventoryType; item: EntreeItem | SortieItem }
  | { action: 'delete'; sheet: InventoryType; id: string };

interface InventoryData {
  entrees: EntreeItem[];
  sorties: SortieItem[];
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'تعذر الاتصال بجدول Google Sheets.');
  }
  return result;
}

export async function submitPublicEntry(
  kind: InventoryType,
  item: EntreeItem | SortieItem
): Promise<void> {
  const response = await fetch('/api/public-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...item, kind }),
  });
  const result = await readResponse(response);
  if (result.status !== 'success') {
    throw new Error(typeof result.error === 'string' ? result.error : 'تعذر حفظ العملية في Google Sheets.');
  }
}

export async function readInventory(accessToken?: string | null): Promise<InventoryData> {
  const response = await fetch('/api/inventory', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  const result = await readResponse(response);
  if (result.status !== 'ok') {
    throw new Error(typeof result.error === 'string' ? result.error : 'تعذر قراءة جدول Google Sheets.');
  }
  return {
    entrees: Array.isArray(result.entrees) ? result.entrees as EntreeItem[] : [],
    sorties: Array.isArray(result.sorties) ? result.sorties as SortieItem[] : [],
  };
}

export async function mutateInventory(
  accessToken: string | null | undefined,
  mutation: InventoryMutation
): Promise<InventoryData> {
  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mutation),
  });
  const result = await readResponse(response);
  if (result.status !== 'success') {
    throw new Error(typeof result.error === 'string' ? result.error : 'تعذر حفظ العملية في Google Sheets.');
  }
  return {
    entrees: Array.isArray(result.entrees) ? result.entrees as EntreeItem[] : [],
    sorties: Array.isArray(result.sorties) ? result.sorties as SortieItem[] : [],
  };
}
