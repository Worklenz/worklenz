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
    DirectPayCardPayment.init({
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
 * Open DirectPay checkout in an iframe modal (inline payment experience)
 */
export const openDirectPayPopup = (
  config: DirectPayConfig,
  callbacks: DirectPayCallbacks
): Window | null => {
  try {
    let checkoutUrl: string | null = null;

    // Try to get URL from session data (v3 API response format)
    if (config.sessionData?.data?.link) {
      checkoutUrl = config.sessionData.data.link;
    } else if (config.sessionData?.link) {
      checkoutUrl = config.sessionData.link;
    } else if (config.sessionData?.redirect_url) {
      checkoutUrl = config.sessionData.redirect_url;
    } else if (config.sessionData?.url) {
      checkoutUrl = config.sessionData.url;
    } else if (config.sessionData?.data?.token) {
      // Construct URL from token (v3 API)
      const baseUrl =
        config.stage === 'PROD' || config.stage === 'prod'
          ? 'https://gateway.directpay.lk'
          : 'https://test-gateway.directpay.lk';
      checkoutUrl = `${baseUrl}/${config.sessionData.data.token}`;
    } else if (config.sessionData?.session_id) {
      // Construct URL from session ID (older format)
      const baseUrl =
        config.stage === 'PROD' || config.stage === 'prod'
          ? 'https://gateway.directpay.lk'
          : 'https://test-gateway.directpay.lk';
      checkoutUrl = `${baseUrl}/payment/session/${config.sessionData.session_id}`;
    }

    if (!checkoutUrl) {
      throw new Error('No checkout URL available from session data');
    }

    // Create modal overlay with iframe
    const overlay = document.createElement('div');
    overlay.id = 'directpay-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    const modalContainer = document.createElement('div');
    modalContainer.style.cssText = `
      position: relative;
      width: 90%;
      max-width: 600px;
      height: 90%;
      max-height: 700px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      border-radius: 50%;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.onclick = () => {
      document.body.removeChild(overlay);
      callbacks.onCancel();
    };

    const iframe = document.createElement('iframe');
    iframe.src = checkoutUrl;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;

    modalContainer.appendChild(closeButton);
    modalContainer.appendChild(iframe);
    overlay.appendChild(modalContainer);
    document.body.appendChild(overlay);

    let isHandled = false;

    const handleCleanup = () => {
      isHandled = true;
      window.removeEventListener('message', handleMessage);
      if (redirectPollInterval) clearInterval(redirectPollInterval);
      const existingOverlay = document.getElementById('directpay-modal-overlay');
      if (existingOverlay && existingOverlay.parentNode) {
        existingOverlay.parentNode.removeChild(existingOverlay);
      }
    };

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        handleCleanup();
        callbacks.onCancel();
      }
    };

    // Parse DirectPay query params from the return_url redirect
    const handleReturnUrlRedirect = (url: string) => {
      if (isHandled) return;
      try {
        const urlObj = new URL(url);
        const status = urlObj.searchParams.get('status');
        const desc = urlObj.searchParams.get('desc') || urlObj.searchParams.get('description');
        const trnId = urlObj.searchParams.get('trnId');
        const orderId = urlObj.searchParams.get('orderId');

        const responseData = {
          status,
          description: desc,
          transactionId: trnId,
          orderId,
        };

        handleCleanup();

        if (status === 'SUCCESS') {
          callbacks.onSuccess(responseData);
        } else if (status === 'CANCELLED') {
          callbacks.onCancel();
        } else {
          callbacks.onError({
            message: desc || 'Payment failed',
            ...responseData,
          });
        }
      } catch (e) {
        // URL parsing failed, ignore
      }
    };

    // Poll iframe location to detect redirect to return_url
    // DirectPay redirects the iframe to return_url with query params after completion
    const redirectPollInterval = setInterval(() => {
      if (isHandled) {
        clearInterval(redirectPollInterval);
        return;
      }
      try {
        const iframeUrl = iframe.contentWindow?.location?.href;
        if (iframeUrl && iframeUrl.includes(window.location.origin)) {
          clearInterval(redirectPollInterval);
          handleReturnUrlRedirect(iframeUrl);
        }
      } catch (_e) {
        // Cross-origin access blocked — iframe is still on DirectPay domain, keep polling
      }
    }, 500);

    // Setup message listener for iframe communication (fallback)
    const handleMessage = (event: MessageEvent) => {
      if (isHandled) return;

      // Verify origin
      const validOrigins = ['directpay.lk', 'test-gateway.directpay.lk'];
      if (!validOrigins.some((origin) => event.origin.includes(origin))) {
        return;
      }

      if (!event.data) return;

      handleCleanup();

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

    return null;
  } catch (error) {
    logger.error('Failed to open DirectPay popup', error);
    callbacks.onError(error);
    return null;
  }
};
