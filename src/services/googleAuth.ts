import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

export let app: any = null;
export let auth: any = null;
let provider: GoogleAuthProvider | null = null;

// The Google OAuth token is short-lived. Keeping it for a limited period
// avoids showing a disconnected state after a normal page refresh.
const ACCESS_TOKEN_STORAGE_KEY = 'stock_google_access_token_v2';
const ACCESS_TOKEN_MAX_AGE_MS = 50 * 60 * 1000;

interface StoredAccessToken {
  token: string;
  expiresAt: number;
}

const readStoredAccessToken = (): string | null => {
  try {
    const raw = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredAccessToken;
    if (!stored.token || !stored.expiresAt || stored.expiresAt <= Date.now()) {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      return null;
    }
    return stored.token;
  } catch {
    return null;
  }
};

const storeAccessToken = (token: string) => {
  try {
    localStorage.setItem(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify({ token, expiresAt: Date.now() + ACCESS_TOKEN_MAX_AGE_MS })
    );
  } catch {
    // Keep using the in-memory token if browser storage is unavailable.
  }
};

const clearStoredAccessToken = () => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {}
};

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider?.addScope(scope));
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase persistence warning:', err);
  });
} catch (err) {
  console.warn('Firebase initialization warning:', err);
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  cachedAccessToken = readStoredAccessToken();

  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      clearStoredAccessToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth || !provider) {
    throw new Error('Google Auth n’est pas initialisé.');
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google sign in');
    }

    cachedAccessToken = credential.accessToken;
    storeAccessToken(cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    const code = error?.code || '';
    if (code === 'auth/unauthorized-domain' || /unauthorized-domain/i.test(error?.message || '')) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'Vercel';
      throw new Error(
        `Firebase: Error (auth/unauthorized-domain). ` +
          `الدومين الحالي «${host}» غير مصرّح به في مشروع Firebase. ` +
          `الحل: Firebase Console ← Authentication ← Settings ← Authorized domains ← Add domain ← أضف «${host}».`
      );
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = readStoredAccessToken();
  }
  return cachedAccessToken;
};

export const logout = async () => {
  if (auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
  clearStoredAccessToken();
};
