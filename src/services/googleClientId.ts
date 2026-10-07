/**
 * Stores the user's own Google OAuth Client ID (from Google Cloud Console).
 * Using the user's own Client ID bypasses the Firebase authorized-domain
 * restriction entirely — Google checks "Authorized JavaScript origins"
 * on the user's own OAuth client instead.
 */

const STORAGE_KEY = 'stock_google_client_id_v1';

// Fallback Client ID baked from the original project (works on localhost).
const DEFAULT_CLIENT_ID =
  '280305539940-668d9co7895bjsjdk1pl29fcnfogqeg3.apps.googleusercontent.com';

export const getGoogleClientId = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim().endsWith('.apps.googleusercontent.com')) {
      return saved.trim();
    }
  } catch {}
  // Allow override via Vite env as well.
  const envId =
    (import.meta as any)?.env?.VITE_GOOGLE_CLIENT_ID || '';
  if (envId && String(envId).endsWith('.apps.googleusercontent.com')) {
    return String(envId).trim();
  }
  return DEFAULT_CLIENT_ID;
};

export const isCustomClientId = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return !!(saved && saved.trim().endsWith('.apps.googleusercontent.com'));
  } catch {
    return false;
  }
};

export const saveGoogleClientId = (clientId: string): void => {
  const trimmed = clientId.trim();
  if (!trimmed.endsWith('.apps.googleusercontent.com')) {
    throw new Error('معرف العميل غير صالح — يجب أن ينتهي بـ .apps.googleusercontent.com');
  }
  localStorage.setItem(STORAGE_KEY, trimmed);
};

export const clearGoogleClientId = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};
