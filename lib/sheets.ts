import { writeAllDataToGoogleSheet } from '../src/services/googleDriveSheets';
import { EntreeItem, SortieItem } from '../src/types/stock';

export async function syncDataToGoogleSheets(
  sheetId: string,
  token: string,
  entrees: EntreeItem[],
  sorties: SortieItem[]
): Promise<boolean> {
  if (!Array.isArray(entrees) || !Array.isArray(sorties) || (entrees.length === 0 && sorties.length === 0)) {
    console.warn('PROTECTION ACTIVE: Skipped syncing empty inventory to Google Sheets');
    return false;
  }

  try {
    await writeAllDataToGoogleSheet(token, sheetId, entrees, sorties);
    return true;
  } catch (err) {
    console.warn('Google Sheets sync error:', err);
    return false;
  }
}
