import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncDataToGoogleSheets } from '../lib/sheets';

/**
 * Push inventory data to Google Sheets. On Vercel there is no stored token or
 * cache, so the caller must provide the data (and ideally the token). Env vars
 * are used as a fallback:
 *   SHARED_SHEET_ID, SHARED_SHEET_TOKEN
 */

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, entrees, sorties, sheetId } = req.body || {};

    const id = sheetId || process.env.SHARED_SHEET_ID;
    const effectiveToken = token || process.env.SHARED_SHEET_TOKEN;

    if (!id) {
      return res.status(400).json({ error: 'No spreadsheet configured (set SHARED_SHEET_ID or pass sheetId)' });
    }
    if (!effectiveToken) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED' });
    }

    const listE = Array.isArray(entrees) ? entrees : [];
    const listS = Array.isArray(sorties) ? sorties : [];

    const ok = await syncDataToGoogleSheets(id, effectiveToken, listE, listS);
    if (ok) {
      return res.status(200).json({ success: true, count: listE.length + listS.length });
    }
    return res.status(500).json({ error: 'Failed to write to Google Sheets' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Sync error' });
  }
}
