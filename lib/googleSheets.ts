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

async function requestScript(
  config: GoogleSheetsConfig,
  action: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = new URL(config.webhookUrl);
  if (!body) {
    url.searchParams.set('action', action);
    url.searchParams.set('token', config.webhookToken);
  }
  const response = await fetch(url, body
    ? {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, action, token: config.webhookToken }),
      }
    : { method: 'GET', redirect: 'follow' });
  const text = await response.text();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error('Google Apps Script returned an invalid response. Check that the Web App is deployed.');
  }
  if (!response.ok || result.status === 'error' || result.status === 'ignored') {
    throw new Error(typeof result.error === 'string'
      ? result.error
      : typeof result.message === 'string'
        ? result.message
        : 'Google Apps Script request failed.');
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
    item: { ...item, id: `public-${crypto.randomUUID()}` },
  });
  assertTarget(result, config.spreadsheetId);
  if (result.status !== 'success' || result.saved !== true) {
    throw new Error('Google Apps Script did not confirm saving the public entry.');
  }
}
