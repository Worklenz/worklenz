import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import { authApiService } from '@/api/auth/auth.api.service';

interface GoogleCredentialResponse { credential: string }
interface GoogleIdentityApi {
  initialize: (config: { client_id: string; nonce: string; auto_select: boolean;
    callback: (response: GoogleCredentialResponse) => void }) => void;
  prompt: () => void;
  cancel: () => void;
}

declare global {
  interface Window { google?: { accounts?: { id?: GoogleIdentityApi } } }
}

let scriptPromise: Promise<void> | undefined;
function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { script.remove(); reject(new Error('Google Identity unavailable')); };
      document.head.appendChild(script);
    }).catch(error => { scriptPromise = undefined; throw error; });
  }
  return scriptPromise;
}

/** The prompt is optional; ordinary sign-in remains available if GIS cannot load. */
export function useGoogleOneTap(isAuthPage: boolean): void {
  const navigate = useNavigate();
  const { t } = useTranslation('auth/auth-common');

  useEffect(() => {
    if (!isAuthPage) return;
    let cancelled = false;
    let initialized = false;
    let isSubmitting = false;

    const start = async () => {
      try {
        const config = await authApiService.googleOneTapConfig();
        if (cancelled || !config.enabled || !config.clientId) return;
        const session = await authApiService.verify(true);
        if (cancelled || session.authenticated) return;
        const nonce = await authApiService.googleOneTapChallenge();
        if (cancelled) return;
        await loadGoogleIdentity();
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: config.clientId,
          nonce,
          auto_select: false,
          callback: ({ credential }) => {
            if (cancelled || isSubmitting || !credential) return;
            isSubmitting = true;
            void authApiService.googleOneTapLogin(credential).then(() => {
              if (!cancelled) navigate('/auth/authenticating', { replace: true });
            }).catch(() => {
              if (!cancelled) message.error(t('googleOneTapFailed', {
                defaultValue: 'Google sign-in could not be completed. Please use another sign-in method.',
              }));
            });
          },
        });
        initialized = true;
        window.google.accounts.id.prompt();
      } catch {
        // Keep the existing sign-in controls usable if configuration or GIS is unavailable.
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (initialized) window.google?.accounts?.id?.cancel();
    };
  }, [isAuthPage, navigate, t]);
}
