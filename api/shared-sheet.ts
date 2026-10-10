import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * On Vercel there is no persistent filesystem, so the shared spreadsheet
 * configuration is read from environment variables instead of a JSON file.
 * Configure these in the Vercel dashboard (Project Settings -> Environment Variables):
 *   SHARED_SHEET_ID, SHARED_SHEET_TITLE, SHARED_SHEET_URL, SHARED_SHEET_WEBHOOK
 */

interface SharedSheet {
  id?: string;
  title?: string;
  url?: string;
  sharedBy?: string;
  webhookUrl?: string;
  updatedAt?: string;
}

function getConfigFromEnv(): SharedSheet | null {
  const id = process.env.SHARED_SHEET_ID;
  if (!id) return null;
  return {
    id,
    title: process.env.SHARED_SHEET_TITLE || 'Tiscobap - Gestion de Stock (152 & 124)',
    url: process.env.SHARED_SHEET_URL || `https://docs.google.com/spreadsheets/d/${id}/edit`,
    sharedBy: process.env.SHARED_SHEET_BY || 'Admin',
    webhookUrl: process.env.SHARED_SHEET_WEBHOOK || undefined,
    updatedAt: new Date().toISOString(),
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ sheet: getConfigFromEnv() });
  }

  if (req.method === 'POST') {
    // Vercel is stateless: we acknowledge the save but cannot persist a file.
    // The client should rely on SHARED_SHEET_* env vars for team-wide sharing.
    const body = (req.body || {}) as SharedSheet;
    return res.status(200).json({
      success: true,
      sheet: getConfigFromEnv() || {
        id: body.id,
        title: body.title,
        url: body.url,
        sharedBy: body.sharedBy || 'Admin',
        webhookUrl: body.webhookUrl,
        updatedAt: new Date().toISOString(),
      },
      note: 'Stateless mode: set SHARED_SHEET_* environment variables for persistent team sharing.',
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
