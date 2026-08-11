import { useRef, useState } from 'react';
import { message } from '@/shared/antd-imports';
import logger from '@/utils/errorLogger';
import { selfHostedBillingApiService } from '@/api/admin-center/self-hosted-billing.api.service';

declare const Paddle: any;

const PADDLE_V2_SCRIPT_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const ACTIVATION_POLL_INTERVAL_MS = 3000;
const ACTIVATION_POLL_TIMEOUT_MS = 60_000;

/**
 * Paddle Billing (v2) checkout for the self-hosted Business plan — distinct from
 * usePaddleCheckout (Paddle Classic, the hosted multi-tenant SaaS flow). Opens a
 * client-side overlay for a single fixed price, then polls license status after checkout
 * while the hosted licensing service (worklenz-license-manager-backend) provisions the
 * Keygen license in the background via webhook.
 */
export function useSelfHostedPaddleCheckout(onActivated: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;

  const pollForActivation = async () => {
    setIsActivating(true);
    const deadline = Date.now() + ACTIVATION_POLL_TIMEOUT_MS;

    const tick = async () => {
      try {
        await selfHostedBillingApiService.activate();
        const statusRes = await selfHostedBillingApiService.getLicenseStatus();
        if (statusRes.done && statusRes.body?.isValid) {
          setIsActivating(false);
          message.success('Business plan activated!');
          onActivatedRef.current();
          return;
        }
      } catch (error) {
        logger.error('Error polling self-hosted license activation', error);
      }

      if (Date.now() < deadline) {
        setTimeout(tick, ACTIVATION_POLL_INTERVAL_MS);
      } else {
        setIsActivating(false);
        message.warning(
          'Payment succeeded but activation is taking longer than expected. It should complete automatically shortly — refresh this page in a minute.'
        );
      }
    };

    void tick();
  };

  const openCheckout = (token: string, priceId: string, installationId: string, customerEmail: string | null) => {
    try {
      Paddle.Initialize({
        token,
        eventCallback: (eventData: any) => {
          if (eventData.name === 'checkout.completed') {
            void pollForActivation();
          }
        },
      });
      Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { worklenz_installation_id: installationId },
        ...(customerEmail ? { customer: { email: customerEmail } } : {}),
      });
    } catch (error) {
      setIsLoading(false);
      message.error('Failed to initialize checkout');
      logger.error('Error initializing Paddle Billing checkout', error);
    }
  };

  const startCheckout = async () => {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
    if (!token) {
      message.error('Self-hosted billing is not configured.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await selfHostedBillingApiService.getCheckoutInfo();
      if (!res.done || !res.body) {
        message.error(res.message || 'Self-hosted billing is not available on this server.');
        setIsLoading(false);
        return;
      }
      const { priceId, installationId, customerEmail } = res.body;

      if (window.Paddle) {
        openCheckout(token, priceId, installationId, customerEmail);
        setIsLoading(false);
        return;
      }

      const script = document.createElement('script');
      script.src = PADDLE_V2_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        openCheckout(token, priceId, installationId, customerEmail);
        setIsLoading(false);
      };
      script.onerror = () => {
        setIsLoading(false);
        message.error('Failed to load payment processor');
        logger.error('Failed to load Paddle v2 script');
      };
      document.getElementsByTagName('head')[0].appendChild(script);
    } catch (error) {
      setIsLoading(false);
      message.error('Failed to start checkout');
      logger.error('Error starting self-hosted checkout', error);
    }
  };

  return { startCheckout, isLoading, isActivating };
}
