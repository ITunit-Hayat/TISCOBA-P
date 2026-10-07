/**
 * Direct Google sign-in via Google Identity Services (GIS) OAuth2 token flow.
 * This bypasses Firebase entirely, so there is NO "auth/unauthorized-domain"
 * error — Google authorizes the origin on YOUR OWN OAuth client
 * (Authorized JavaScript origins) instead of Firebase's domain list.
 */

import { SCOPES } from './googleAuth';
import { getGoogleClientId } from './googleClientId';

declare global {
  interface Window {
    google?: any;
  }
}

let gisLoaded = false;
let gisLoading: Promise<void> | null = null;

const loadGisScript = (): Promise<void> => {
  if (gisLoaded && window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-gis="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('تعذر تحميل مكتبة Google')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.gis = 'true';
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('تعذر تحميل مكتبة Google — تحقق من الاتصال بالإنترنت'));
    document.head.appendChild(script);
  });
  return gisLoading;
};

export interface DirectGoogleUser {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const fetchUserProfile = async (accessToken: string): Promise<DirectGoogleUser> => {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { displayName: null, email: null, photoURL: null };
    const data = await res.json();
    return {
      displayName: data.name ?? null,
      email: data.email ?? null,
      photoURL: data.picture ?? null,
    };
  } catch {
    return { displayName: null, email: null, photoURL: null };
  }
};

/**
 * Opens the Google consent popup directly and resolves with an access token.
 * Throws a friendly Arabic error if the origin is not authorized on the
 * user's OAuth client.
 */
export const directGoogleSignIn = async (): Promise<{
  accessToken: string;
  profile: DirectGoogleUser;
  clientId: string;
}> => {
  const clientId = getGoogleClientId();
  await loadGisScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('تعذر تحميل مكتبة Google — أعد تحميل الصفحة وحاول مجدداً');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(
          new Error(
            'انتهت مهلة تسجيل الدخول. إذا ظهر خطأ origin_mismatch أو 403، أضف دومين موقعك في Google Cloud Console ← Credentials ← OAuth client ← Authorized JavaScript origins.'
          )
        );
      }
    }, 120000);

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        prompt: 'select_account',
        callback: async (response: any) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          if (response?.error || !response?.access_token) {
            const err = response?.error || 'access_denied';
            if (err === 'popup_closed' || err === 'popup_closed_by_user') {
              reject(new Error('أغلقت نافذة تسجيل الدخول قبل الإتمام'));
            } else {
              reject(
                new Error(
                  `رفض Google تسجيل الدخول (${err}). تأكد من إضافة ${window.location.origin} في Authorized JavaScript origins لمعرف العميل.`
                )
              );
            }
            return;
          }
          const profile = await fetchUserProfile(response.access_token);
          resolve({ accessToken: response.access_token, profile, clientId });
        },
        error_callback: (err: any) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          const type = err?.type || 'unknown';
          if (type === 'popup_closed' || type === 'popup_failed_to_open') {
            reject(new Error('تعذر فتح نافذة Google — اسمح بالنوافذ المنبثقة وحاول مجدداً'));
          } else {
            reject(
              new Error(
                `خطأ من Google (${type}). أضف ${window.location.origin} في Google Cloud Console ← Credentials ← Authorized JavaScript origins.`
              )
            );
          }
        },
      });
      client.requestAccessToken();
    } catch (err: any) {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        reject(err);
      }
    }
  });
};
