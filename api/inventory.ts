import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { EntreeItem, SortieItem } from '../src/types/stock';
import {
  mutateGoogleSheetInventory,
  readGoogleSheetInventory,
  type InventoryKind,
} from '../lib/googleSheets';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ status: 'ok', ...(await readGoogleSheetInventory()) });
    }

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : null;
    if (!body) return res.status(400).json({ error: 'Invalid inventory request.' });
    if (body.sheet !== 'entree' && body.sheet !== 'sortie') {
      return res.status(400).json({ error: 'Invalid inventory type.' });
    }
    const kind: InventoryKind = body.sheet;

    if (body.action === 'add' || body.action === 'update') {
      if (!body.item || typeof body.item !== 'object' || Array.isArray(body.item)) {
        return res.status(400).json({ error: 'Invalid inventory entry.' });
      }
      const item = body.item as EntreeItem | SortieItem;
      if (typeof item.id !== 'string' || !item.id || typeof item.date !== 'string' || !item.date) {
        return res.status(400).json({ error: 'Inventory entry ID and date are required.' });
      }
      const result = await mutateGoogleSheetInventory(body.action, kind, item);
      return res.status(200).json({ status: 'success', ...result });
    }

    if (body.action === 'delete') {
      if (typeof body.id !== 'string' || !body.id) {
        return res.status(400).json({ error: 'Entry ID is required.' });
      }
      const result = await mutateGoogleSheetInventory('delete', kind, body.id);
      return res.status(200).json({ status: 'success', ...result });
    }

    return res.status(400).json({ error: 'Unsupported inventory action.' });
  } catch (error) {
    console.error('Google Sheets inventory API failed:', error);
    const message = error instanceof Error ? error.message : 'Google Sheets request failed.';
    const missingConfig = message.includes('is not configured');
    return res.status(missingConfig ? 503 : 502).json({ error: message });
  }
}
