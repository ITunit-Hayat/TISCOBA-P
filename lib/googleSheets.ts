import type { EntreeItem, SortieItem } from '../src/types/stock';

export type InventoryKind = 'entree' | 'sortie';

interface GoogleSheetsConfig {
  spreadsheetId: string;
  webhookUrl: URL;
  webhookToken: string;
}

function getConfig(): GoogleSheetsConfig {
  const spreadsheetId = process.env.SHARED_SHEET_ID?.trim();
  const rawWebhookUrl = process.env.SHARED_SHEET_WEBHOOK?.trim();
  const webhookToken = process.env.SHARED_SHEET_WEBHOOK_TOKEN?.trim();
  if (!spreadsheetId || !rawWebhookUrl || !webhookToken) {
    throw new Error('Google Sheets is not configured. Set SHARED_SHEET_ID, SHARED_SHEET_WEBHOOK, and SHARED_SHEET_WEBHOOK_TOKEN.');
  }

  let webhookUrl: URL;
  try {
    webhookUrl = new URL(rawWebhookUrl);
  } catch {
    throw new Error('SHARED_SHEET_WEBHOOK must be a valid URL.');
  }
  if (
    webhookUrl.protocol !== 'https:' ||
    webhookUrl.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(webhookUrl.pathname)
  ) {
    throw new Error('SHARED_SHEET_WEBHOOK must be a Google Apps Script Web App URL.');
  }

  return { spreadsheetId, webhookUrl, webhookToken };
}

const CONTENT_SERVICE_HOST = 'script.googleusercontent.com';
const CONTENT_RETRY_DELAYS_MS = [250, 700, 1400];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responsePreview(text: string): string {
  // Keep diagnostics useful without returning an entire HTML login/error page.
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

async function fetchContentResponse(url: URL): Promise<Response> {
  // Apps Script ContentService redirects its output to a one-time URL. Google has
  // had intermittent 404s on that second hop; retry only this GET, never the POST
  // that performs a mutation, to avoid duplicate stock movements.
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt <= CONTENT_RETRY_DELAYS_MS.length; attempt++) {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'application/json' },
    });
    lastResponse = response;
    const retryable = [404, 429, 500, 502, 503, 504].includes(response.status);
    if (response.ok || !retryable || attempt === CONTENT_RETRY_DELAYS_MS.length) {
      return response;
    }
    // Drain the body before retrying to release the connection.
    await response.text();
    await wait(CONTENT_RETRY_DELAYS_MS[attempt]);
  }
  return lastResponse!;
}

async function requestScript(
  config: GoogleSheetsConfig,
  action: string,
  body: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  // Keep the shared token in the POST body rather than the URL query string.
  // Do not let fetch automatically follow the initial 302: Apps Script's
  // ContentService response is served from a separate script.googleusercontent.com URL.
  const initial = await fetch(config.webhookUrl, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...body, action, token: config.webhookToken }),
  });

  let response = initial;
  if (initial.status >= 300 && initial.status < 400) {
    const location = initial.headers.get('location');
    if (!location) {
      const text = await initial.text();
      throw new Error(`Google Apps Script returned HTTP ${initial.status} without a redirect location. ${responsePreview(text)}`);
    }

    let destination: URL;
    try {
      destination = new URL(location, config.webhookUrl);
    } catch {
      throw new Error('Google Apps Script returned an invalid redirect URL. Verify SHARED_SHEET_WEBHOOK.');
    }

    if (destination.hostname !== CONTENT_SERVICE_HOST) {
      if (destination.hostname === 'accounts.google.com' || destination.hostname.endsWith('.google.com')) {
        throw new Error('Google Apps Script redirected to Google sign-in. In Deploy → Manage deployments, set Execute as = Me and Who has access = Anyone, then update the active Web App deployment and SHARED_SHEET_WEBHOOK.');
      }
      throw new Error(`Google Apps Script redirected to an unexpected host (${destination.hostname}). Verify that SHARED_SHEET_WEBHOOK is the /exec Web App URL.`);
    }

    response = await fetchContentResponse(destination);
  }

  const text = await response.text();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(text);
  } catch {
    const contentType = response.headers.get('content-type') || 'unknown content type';
    const htmlHint = /<html|<!doctype html/i.test(text)
      ? ' Google returned an HTML page instead of JSON; check Web App access permissions and the active /exec deployment.'
      : '';
    const preview = responsePreview(text);
    throw new Error(`Google Apps Script returned non-JSON content (HTTP ${response.status}, ${contentType}).${htmlHint}${preview ? ` Response: ${preview}` : ''}`);
  }
  if (!response.ok || result.status === 'error' || result.status === 'ignored') {
    throw new Error(typeof result.error === 'string'
      ? result.error
      : typeof result.message === 'string'
        ? result.message
        : `Google Apps Script request failed (HTTP ${response.status}).`);
  }
  return result;
}

function assertTarget(result: Record<string, unknown>, spreadsheetId: string): void {
  const target = result.target;
  const url = target && typeof target === 'object'
    ? (target as Record<string, unknown>).url
    : undefined;
  const targetId = typeof url === 'string'
    ? url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1]
    : undefined;
  if (targetId !== spreadsheetId) {
    throw new Error('Google Apps Script is connected to a different spreadsheet than SHARED_SHEET_ID.');
  }
}

export async function readGoogleSheetInventory(): Promise<{
  entrees: EntreeItem[];
  sorties: SortieItem[];
}> {
  const config = getConfig();
  const info = await requestScript(config, 'info');
  assertTarget(info, config.spreadsheetId);
  const result = await requestScript(config, 'read');
  assertTarget(result, config.spreadsheetId);
  if (result.status !== 'ok' || !Array.isArray(result.entrees) || !Array.isArray(result.sorties)) {
    throw new Error('Google Apps Script returned invalid inventory data.');
  }
  return {
    entrees: result.entrees as EntreeItem[],
    sorties: result.sorties as SortieItem[],
  };
}

export async function mutateGoogleSheetInventory(
  action: 'add' | 'update' | 'delete',
  kind: InventoryKind,
  itemOrId: EntreeItem | SortieItem | string
): Promise<{ entrees: EntreeItem[]; sorties: SortieItem[] }> {
  const config = getConfig();
  const info = await requestScript(config, 'info');
  assertTarget(info, config.spreadsheetId);
  const data = typeof itemOrId === 'string'
    ? { sheet: kind, id: itemOrId }
    : { sheet: kind, item: itemOrId };
  const result = await requestScript(config, action, data);
  assertTarget(result, config.spreadsheetId);
  if (result.status !== 'success' || !Array.isArray(result.entrees) || !Array.isArray(result.sorties)) {
    throw new Error('Google Apps Script returned an invalid inventory update response.');
  }
  return {
    entrees: result.entrees as EntreeItem[],
    sorties: result.sorties as SortieItem[],
  };
}

export async function addPublicGoogleSheetEntry(
  kind: InventoryKind,
  item: EntreeItem | SortieItem
): Promise<void> {
  const config = getConfig();
  const info = await requestScript(config, 'info');
  assertTarget(info, config.spreadsheetId);
  const result = await requestScript(config, 'publicAdd', {
    sheet: kind,
    item: { ...item, id: item.id || `public-${crypto.randomUUID()}` },
  });
  assertTarget(result, config.spreadsheetId);
  if (result.status !== 'success' || result.saved !== true) {
    throw new Error('Google Apps Script did not confirm saving the public entry.');
  }
}
