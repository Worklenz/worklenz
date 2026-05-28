import WorklenzPageHeader from '@/components/common/WorklenzPageHeader';
import { Tabs, TabsProps, notification } from '@/shared/antd-imports';
import React, { useEffect, useMemo } from 'react';
import CurrentBill from '@/components/admin-center/billing/CurrentBill';
import Configuration from '@/components/admin-center/configuration/configuration';
import { useTranslation } from 'react-i18next';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSearchParams } from 'react-router-dom';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import logger from '@/utils/errorLogger';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import {
  evt_current_bill_click,
  evt_billing_configuration_click,
} from '@/shared/worklenz-analytics-events';

const BillingSection: React.FC = React.memo(() => {
  const { t } = useTranslation('admin-center/current-bill');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = useAppSelector(state => state.userReducer);
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('status');
    const trnId = searchParams.get('trnId');
    const orderId = searchParams.get('orderId');
    const dpCardAdded = searchParams.get('dp_card_added');

    // On card-add return: skip payment status messages (they belong to the card-add transaction, not a plan payment)
    if (dpCardAdded === '1') {
      const dpDesc = searchParams.get('desc') || searchParams.get('description') || '';
      const descLower = dpDesc.toLowerCase();
      const isCardAlreadyExists = descLower.includes('card already exist');
      const isCardAddSuccess = descLower.includes('success') || descLower.includes('successful');
      const isDirectPayError = dpDesc.length > 0 && !isCardAlreadyExists && !isCardAddSuccess;

      searchParams.delete('dp_card_added');
      searchParams.delete('status');
      searchParams.delete('trnId');
      searchParams.delete('orderId');
      searchParams.delete('desc');
      searchParams.delete('description');
      setSearchParams(searchParams, { replace: true });

      if (isDirectPayError) {
        // DirectPay returned a non-recoverable error — clear pending plan and show error
        localStorage.removeItem('dp_pending_plan');
        notification.error({ message: 'Card add failed', description: dpDesc, duration: 8 });
        return;
      }

      const pending = localStorage.getItem('dp_pending_plan');
      if (pending) {
        localStorage.removeItem('dp_pending_plan');
        const { plan, amount } = JSON.parse(pending) as { plan: string; amount: number };
        const description = isCardAlreadyExists
          ? 'Card already exists in DirectPay. Checking for saved card...'
          : 'Processing your payment...';
        notification.info({ message: isCardAlreadyExists ? 'Card already on file' : 'Card added', description, duration: 6 });

        // Poll for subscription activation — the webhook (chargeAndActivate) handles charging.
        // Only fall back to payWithCard if the webhook hasn't activated within the polling window.
        const chargeCard = async () => {
          for (let attempt = 1; attempt <= 8; attempt++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
              // Check if the webhook already activated the subscription
              const billingInfo = await adminCenterApiService.getBillingAccountInfo();
              const subStatus = billingInfo?.body?.status;
              const subType = billingInfo?.body?.subscription_type;
              if (subType === ISUBSCRIPTION_TYPE.ANNUAL_BUSINESS && subStatus === 'active') {
                console.log('[DirectPay] Subscription activated by webhook — skipping payWithCard');
                notification.success({ message: 'Payment successful', description: 'Your plan has been activated.' });
                dispatch(verifyAuthentication());
                return;
              }

              // Subscription not active yet — check card is in DB for fallback charge
              const cardRes = await billingApiService.listCards();
              const card = cardRes?.body?.card_list?.[0];
              if (!card) {
                console.log(`[DirectPay] Card not in DB yet, attempt ${attempt}/8`);
                if (attempt === 8) {
                  notification.error({ message: 'No card found', description: 'Card was not saved. Please contact support.' });
                }
                continue;
              }

              // Only attempt fallback charge on the last attempt to avoid racing the webhook
              if (attempt < 8) {
                console.log(`[DirectPay] Waiting for webhook activation, attempt ${attempt}/8`);
                continue;
              }

              const payOrderId = `WL${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
              const walletId = String((card as any).wallet_id ?? '');
              const cardId = String(card.card_id ?? '');
              console.log('[DirectPay] Webhook did not activate — falling back to payWithCard');
              const payResult = await billingApiService.payWithCard(walletId, cardId, payOrderId, amount, 'LKR', plan);
              if (payResult.done) {
                notification.success({ message: 'Payment successful', description: 'Your plan has been activated.' });
                dispatch(verifyAuthentication());
              } else {
                notification.error({ message: 'Payment failed', description: payResult.message || 'Please try again.' });
              }
              return;
            } catch (e) {
              logger.error('DirectPay post-card-add charge failed', e);
              if (attempt === 8) {
                notification.error({ message: 'Payment error', description: 'Could not charge card. Please try again.' });
              }
            }
          }
        };
        chargeCard();
      }
      return;
    }

    if (status) {
      if (status === 'success' || status === '1' || status === '200') {
        notification.success({
          message: 'Payment Successful',
          description: trnId
            ? `Your payment was processed successfully. Transaction ID: ${trnId}`
            : 'Your payment was processed successfully. Your plan will be updated shortly.',
          duration: 8,
        });
      } else {
        notification.error({
          message: 'Payment Failed',
          description: orderId
            ? `Your payment could not be processed (Order: ${orderId}). Please try again or contact support.`
            : 'Your payment could not be processed. Please try again or contact support.',
          duration: 8,
        });
      }
      searchParams.delete('status');
      searchParams.delete('trnId');
      searchParams.delete('orderId');
      setSearchParams(searchParams, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: TabsProps['items'] = useMemo(
    () => [
      {
        key: '1',
        label: t('currentBill'),
        children: <CurrentBill />,
      },
      {
        key: '2',
        label: t('configuration'),
        children: <Configuration />,
      },
    ],
    [t]
  );

  const pageHeaderStyle = useMemo(() => ({ padding: '16px 0' }), []);

  const handleTabChange = (key: string) => {
    if (key === '1') {
      trackMixpanelEvent(evt_current_bill_click, {
        user_type: currentSession?.subscription_type?.toLowerCase(),
        source: 'billing_section',
      });
    } else if (key === '2') {
      trackMixpanelEvent(evt_billing_configuration_click, {
        user_type: currentSession?.subscription_type?.toLowerCase(),
        source: 'billing_section',
      });
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <WorklenzPageHeader title={<span>{t('title')}</span>} style={pageHeaderStyle} />
      <Tabs defaultActiveKey="1" items={items} onChange={handleTabChange} destroyOnHidden />
    </div>
  );
});

BillingSection.displayName = 'BillingSection';

export default BillingSection;
