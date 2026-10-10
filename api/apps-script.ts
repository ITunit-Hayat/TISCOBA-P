import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ACTIONS = new Set(['read', 'sync', 'add', 'update', 'delete', 'seed']);

async function verifyGoogleAccessToken(token: string): Promise<boolean> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
  );
  if (!response.ok) return false;

  const info = await response.json();
  const scopes = String(info.scope || '').split(/\s+/);
  return scopes.includes('https://www.googleapis.com/auth/spreadsheets');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookUrl = process.env.SHARED_SHEET_WEBHOOK;
  const webhookToken = process.env.SHARED_SHEET_WEBHOOK_TOKEN;
  const configuredSheetId = process.env.SHARED_SHEET_ID;
  if (!webhookUrl || !webhookToken || !configuredSheetId) {
    return res.status(503).json({
      error: 'Apps Script is not configured. Set SHARED_SHEET_ID, SHARED_SHEET_WEBHOOK, and SHARED_SHEET_WEBHOOK_TOKEN.',
    });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return res.status(500).json({ error: 'SHARED_SHEET_WEBHOOK must be a valid URL.' });
  }
  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(parsedUrl.pathname)
  ) {
    return res.status(500).json({ error: 'SHARED_SHEET_WEBHOOK is not a valid Google Apps Script Web App URL.' });
  }

  const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let authenticated = false;
  try {
    authenticated = Boolean(accessToken && await verifyGoogleAccessToken(accessToken));
  } catch (err) {
    console.error('Google access-token verification failed:', err);
    return res.status(502).json({ error: 'Could not verify the Google sign-in.' });
  }
  if (!authenticated) {
    return res.status(401).json({ error: 'A valid Google Sheets sign-in is required.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = String(body.action || '');
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'Unsupported Apps Script action.' });
  }
  if (body.sheetId !== configuredSheetId) {
    return res.status(400).json({ error: 'The active spreadsheet does not match SHARED_SHEET_ID.' });
  }
  if (action === 'sync' && (!Array.isArray(body.entrees) || !Array.isArray(body.sorties))) {
    return res.status(400).json({ error: 'Sync requires entrees and sorties arrays.' });
  }

  try {
    const targetUrl = new URL(parsedUrl);
    targetUrl.searchParams.set('token', webhookToken);

    const infoUrl = new URL(targetUrl);
    infoUrl.searchParams.set('action', 'info');
    const infoResponse = await fetch(infoUrl, { method: 'GET', redirect: 'follow' });
    const infoText = await infoResponse.text();
    let info: Record<string, unknown>;
    try {
      info = JSON.parse(infoText);
    } catch {
      return res.status(502).json({ error: 'Apps Script returned an invalid info response. Verify its deployment.' });
    }
    const infoTargetUrl = String((info.target as Record<string, unknown> | undefined)?.url || '');
    const infoTargetId = infoTargetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!infoResponse.ok || info.status !== 'ok' || !infoTargetId) {
      return res.status(502).json({ error: String(info.error || 'Apps Script health check failed.') });
    }
    if (infoTargetId !== body.sheetId) {
      return res.status(409).json({
        error: 'The Apps Script Web App is bound to a different spreadsheet than the one selected in the app.',
      });
    }

    if (action === 'read') targetUrl.searchParams.set('action', 'read');
    const upstream = await fetch(
      targetUrl,
      action === 'read'
        ? { method: 'GET', redirect: 'follow' }
        : {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, token: webhookToken }),
          }
    );
    const responseText = await upstream.text();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error('Apps Script returned a non-JSON response:', upstream.status);
      return res.status(502).json({ error: 'Apps Script returned an invalid response. Verify the Web App deployment.' });
    }

    if (!upstream.ok || result.status === 'error' || result.status === 'ignored') {
      const message = String(result.error || result.message || 'Apps Script request failed.');
      return res.status(result.status === 'error' && message.includes('autorisé') ? 502 : 400).json({ error: message });
    }
    const resultTargetUrl = String((result.target as Record<string, unknown> | undefined)?.url || '');
    const resultTargetId = resultTargetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!resultTargetId || resultTargetId !== body.sheetId) {
      return res.status(409).json({
        error: 'The Apps Script Web App is bound to a different spreadsheet than the one selected in the app.',
      });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Apps Script proxy request failed:', err);
    return res.status(502).json({ error: 'Could not reach the Google Apps Script Web App.' });
  }
}
