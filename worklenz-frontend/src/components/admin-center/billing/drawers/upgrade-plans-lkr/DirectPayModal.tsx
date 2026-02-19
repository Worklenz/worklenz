import React, { useEffect, useRef } from 'react';
import { Modal } from '@/shared/antd-imports';
import logger from '@/utils/errorLogger';

interface DirectPayModalProps {
  isOpen: boolean;
  paymentUrl: string;
  onSuccess: (response: any) => void;
  onError: (error: any) => void;
  onCancel: () => void;
}

export const DirectPayModal: React.FC<DirectPayModalProps> = ({
  isOpen,
  paymentUrl,
  onSuccess,
  onError,
  onCancel,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isHandledRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when modal closes
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      isHandledRef.current = false;
      return;
    }

    isHandledRef.current = false;

    // Parse DirectPay query params from the return_url redirect
    const handleReturnUrlRedirect = (url: string) => {
      if (isHandledRef.current) return;
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

        isHandledRef.current = true;

        if (status === 'SUCCESS') {
          onSuccess(responseData);
        } else if (status === 'CANCELLED') {
          onCancel();
        } else {
          onError({
            message: desc || 'Payment failed',
            ...responseData,
          });
        }
      } catch (e) {
        // URL parsing failed, ignore
        logger.error('Failed to parse DirectPay return URL', e);
      }
    };

    // Poll iframe location to detect redirect to return_url
    pollIntervalRef.current = setInterval(() => {
      if (isHandledRef.current) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }
      try {
        const iframeUrl = iframeRef.current?.contentWindow?.location?.href;
        if (iframeUrl && iframeUrl.includes(window.location.origin)) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          handleReturnUrlRedirect(iframeUrl);
        }
      } catch (_e) {
        // Cross-origin access blocked — iframe is still on DirectPay domain, keep polling
      }
    }, 500);

    // Setup message listener for iframe communication (fallback)
    const handleMessage = (event: MessageEvent) => {
      if (isHandledRef.current) return;

      // Verify origin
      const validOrigins = ['directpay.lk', 'test-gateway.directpay.lk', 'gateway.directpay.lk'];
      if (!validOrigins.some((origin) => event.origin.includes(origin))) {
        return;
      }

      if (!event.data) return;

      isHandledRef.current = true;

      if (event.data.card && event.data.walletId) {
        // Card add response
        if (event.data.status === 200 && event.data.card.status === 'SUCCESS') {
          onSuccess(event.data);
        } else {
          onError(event.data);
        }
      } else if (event.data.status) {
        // Transaction response
        if (event.data.status === 'SUCCESS' || event.data.status === 200) {
          onSuccess(event.data);
        } else if (event.data.status === 'FAILED') {
          onError(event.data);
        } else if (event.data.status === 'CANCELLED') {
          onCancel();
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, onSuccess, onError, onCancel]);

  return (
    <Modal
      open={isOpen}
      onCancel={onCancel}
      footer={null}
      width={700}
      centered
      destroyOnClose
      styles={{
        body: {
          padding: 0,
          height: '600px',
        },
      }}
    >
      {paymentUrl && (
        <iframe
          ref={iframeRef}
          src={paymentUrl}
          style={{
            width: '100%',
            height: '600px',
            border: 'none',
          }}
          title="DirectPay Payment Gateway"
        />
      )}
    </Modal>
  );
};
