/**
 * DirectPay Payment Gateway Helper
 *
 * Utilities for integrating with DirectPay's card management and payment flow
 */

import logger from '@/utils/errorLogger';

export interface DirectPaySessionData {
  url?: string;
  redirect_url?: string;
  session_id?: string;
  [key: string]: any;
}

export interface DirectPayConfig {
  sessionData: DirectPaySessionData;
  stage: string;
}

export interface DirectPayCallbacks {
  onSuccess: (response: any) => void;
  onError: (error: any) => void;
  onCancel: () => void;
}

/**
 * Load DirectPay SDK dynamically
 */
export const loadDirectPaySDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if SDK is already loaded
    if ((window as any).DirectPayCardPayment) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://cdn.directpay.lk/dev/v1/directpayCardPayment.js?v=${Date.now()}`;
    script.type = 'text/javascript';
    script.async = true;

    script.onload = () => {
      setTimeout(() => resolve(), 100);
    };

    script.onerror = () => {
      reject(new Error('Failed to load DirectPay SDK'));
    };

    document.head.appendChild(script);
  });
};

/**
 * Initialize DirectPay payment flow using their SDK
 */
export const initializeDirectPaySDK = (
  config: DirectPayConfig,
  callbacks: DirectPayCallbacks
): void => {
  try {
    const DirectPayCardPayment = (window as any).DirectPayCardPayment;

    if (!DirectPayCardPayment) {
      throw new Error('DirectPay SDK not loaded');
    }

    // Initialize payment with SDK
    DirectPayCardPayment({
      data: config.sessionData,
      onSuccess: callbacks.onSuccess,
      onFailed: callbacks.onError,
      onCancelled: callbacks.onCancel,
    });
  } catch (error) {
    logger.error('DirectPay SDK initialization failed', error);
    callbacks.onError(error);
  }
};

/**
 * Open DirectPay checkout in a popup window (fallback method)
 */
export const openDirectPayPopup = (
  config: DirectPayConfig,
  callbacks: DirectPayCallbacks
): Window | null => {
  try {
    let checkoutUrl: string | null = null;

    // Try to get URL from session data
    if (config.sessionData?.redirect_url) {
      checkoutUrl = config.sessionData.redirect_url;
    } else if (config.sessionData?.url) {
      checkoutUrl = config.sessionData.url;
    } else if (config.sessionData?.session_id) {
      // Construct URL from session ID
      const baseUrl =
        config.stage === 'PROD' || config.stage === 'prod'
          ? 'https://gateway.directpay.lk'
          : 'https://test-gateway.directpay.lk';
      checkoutUrl = `${baseUrl}/payment/session/${config.sessionData.session_id}`;
    }

    if (!checkoutUrl) {
      throw new Error('No checkout URL available from session data');
    }

    // Open popup
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      checkoutUrl,
      'DirectPayCheckout',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    // Setup message listener for popup communication
    const handleMessage = (event: MessageEvent) => {
      // Verify origin
      const validOrigins = ['directpay.lk', 'test-gateway.directpay.lk'];
      if (!validOrigins.some((origin) => event.origin.includes(origin))) {
        return;
      }

      if (!event.data) return;

      // Handle response
      popup?.close();
      window.removeEventListener('message', handleMessage);

      if (event.data.card && event.data.walletId) {
        // Card add response
        if (event.data.status === 200 && event.data.card.status === 'SUCCESS') {
          callbacks.onSuccess(event.data);
        } else {
          callbacks.onError(event.data);
        }
      } else if (event.data.status) {
        // Transaction response
        if (event.data.status === 'SUCCESS' || event.data.status === 200) {
          callbacks.onSuccess(event.data);
        } else if (event.data.status === 'FAILED') {
          callbacks.onError(event.data);
        } else if (event.data.status === 'CANCELLED') {
          callbacks.onCancel();
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Monitor popup close
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        // User closed popup manually - treat as cancel
        callbacks.onCancel();
      }
    }, 1000);

    return popup;
  } catch (error) {
    logger.error('Failed to open DirectPay popup', error);
    callbacks.onError(error);
    return null;
  }
};
