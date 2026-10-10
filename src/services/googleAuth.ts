import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

let app: any = null;
export let auth: any = null;
let provider: GoogleAuthProvider | null = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider?.addScope(scope));
} catch (err) {
  console.warn('Firebase initialization warning:', err);
}

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    return localStorage.getItem('gdrive_access_token');
  } catch {
    return null;
  }
})();

export interface StoredUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export const getStoredUser = (): StoredUserProfile | null => {
  try {
    const saved = localStorage.getItem('gdrive_user_profile');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const setCachedToken = (token: string | null, user?: User | StoredUserProfile | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('gdrive_access_token', token);
    } else {
      localStorage.removeItem('gdrive_access_token');
    }

    if (user) {
      const profile: StoredUserProfile = {
        uid: user.uid,
        displayName: user.displayName || null,
        email: user.email || null,
        photoURL: user.photoURL || null,
      };
      localStorage.setItem('gdrive_user_profile', JSON.stringify(profile));
    } else if (token === null) {
      localStorage.removeItem('gdrive_user_profile');
    }
  } catch {}
};

export const initAuth = (
  onAuthSuccess?: (user: User | any, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check if we already have a saved session in localStorage
  const storedToken = cachedAccessToken || (() => {
    try {
      return localStorage.getItem('gdrive_access_token');
    } catch {
      return null;
    }
  })();
  const storedProfile = getStoredUser();

  if (storedToken && storedProfile && onAuthSuccess) {
    onAuthSuccess(storedProfile as any, storedToken);
  }

  if (!auth) {
    if (!storedToken && onAuthFailure) onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = cachedAccessToken || localStorage.getItem('gdrive_access_token');
      if (token) {
        setCachedToken(token, user);
        if (onAuthSuccess) onAuthSuccess(user, token);
      }
    } else {
      // If user logged out of firebase, check if we still have local token
      const token = cachedAccessToken || localStorage.getItem('gdrive_access_token');
      const profile = getStoredUser();
      if (token && profile && onAuthSuccess) {
        onAuthSuccess(profile as any, token);
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export function isAccessDeniedError(error: any): boolean {
  if (!error) return false;
  const str = (
    String(error?.message || '') +
    ' ' +
    String(error?.code || '') +
    ' ' +
    String(error?.name || '')
  ).toLowerCase();
  return (
    str.includes('access_denied') ||
    str.includes('403') ||
    str.includes('access-denied') ||
    str.includes('popup-closed-by-user') || // Most users close popup right after Google shows 403 access_denied
    str.includes('operation-not-allowed')
  );
}

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

    setCachedToken(credential.accessToken, result.user);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    if (isAccessDeniedError(error)) {
      error.isAccessDenied403 = true;
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    return localStorage.getItem('gdrive_access_token');
  } catch {
    return null;
  }
};

export const logout = async () => {
  if (auth) {
    try {
      await auth.signOut();
    } catch {}
  }
  setCachedToken(null, null);
};
