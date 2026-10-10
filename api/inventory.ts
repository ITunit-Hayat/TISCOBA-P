import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * On Vercel there is no persistent filesystem, so this endpoint cannot store a
 * server-side inventory cache. The app keeps its data in localStorage and syncs
 * directly to Google Sheets from the client using the user's access token.
 *
 * - GET  -> returns empty data so the client falls back to its local cache.
 * - POST -> acknowledges the write (the real Google Sheets sync happens client-side).
 */

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, data: null });
  }

  if (req.method === 'POST') {
    const { entrees, sorties, author } = req.body || {};
    return res.status(200).json({
      success: true,
      data: {
        entrees: Array.isArray(entrees) ? entrees : [],
        sorties: Array.isArray(sorties) ? sorties : [],
        author: author || 'Team',
        updatedAt: new Date().toISOString(),
      },
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
