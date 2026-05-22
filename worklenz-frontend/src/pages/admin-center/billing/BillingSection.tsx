import WorklenzPageHeader from '@/components/common/WorklenzPageHeader';
import { Tabs, TabsProps, notification } from '@/shared/antd-imports';
import React, { useEffect, useMemo } from 'react';
import CurrentBill from '@/components/admin-center/billing/CurrentBill';
import Configuration from '@/components/admin-center/configuration/configuration';
import { useTranslation } from 'react-i18next';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSearchParams } from 'react-router-dom';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import logger from '@/utils/errorLogger';
import {
  evt_current_bill_click,
  evt_billing_configuration_click,
} from '@/shared/worklenz-analytics-events';

const BillingSection: React.FC = React.memo(() => {
  const { t } = useTranslation('admin-center/current-bill');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = useAppSelector(state => state.userReducer);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('status');
    const trnId = searchParams.get('trnId');
    const orderId = searchParams.get('orderId');
    const dpCardAdded = searchParams.get('dp_card_added');

    // On card-add return: skip payment status messages (they belong to the card-add transaction, not a plan payment)
    if (dpCardAdded === '1') {
      searchParams.delete('dp_card_added');
      searchParams.delete('status');
      searchParams.delete('trnId');
      searchParams.delete('orderId');
      setSearchParams(searchParams, { replace: true });

      const pending = localStorage.getItem('dp_pending_plan');
      if (pending) {
        localStorage.removeItem('dp_pending_plan');
        const { amount } = JSON.parse(pending) as { plan: string; amount: number };
        notification.info({ message: 'Card added', description: 'Processing your payment...', duration: 6 });

        // Retry card lookup up to 5 times with 3s intervals to allow webhook time to save
        const chargeCard = async () => {
          for (let attempt = 1; attempt <= 5; attempt++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
              const cardRes = await billingApiService.listCards();
              const card = cardRes?.body?.card_list?.[0];
              if (!card) {
                console.log(`[DirectPay] Card not in DB yet, attempt ${attempt}/5`);
                if (attempt === 5) {
                  notification.error({ message: 'No card found', description: 'Card was not saved. Please contact support.' });
                }
                continue;
              }
              const payOrderId = `WL${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
              const walletId = String((card as any).wallet_id ?? '');
              const cardId = String(card.card_id ?? '');
              console.log('[DirectPay] Charging card — walletId:', walletId, 'cardId:', cardId, 'amount:', amount);
              const payResult = await billingApiService.payWithCard(walletId, cardId, payOrderId, amount);
              if (payResult.done) {
                notification.success({ message: 'Payment successful', description: 'Your plan is being activated.' });
              } else {
                notification.error({ message: 'Payment failed', description: payResult.message || 'Please try again.' });
              }
              return;
            } catch (e) {
              logger.error('DirectPay post-card-add charge failed', e);
              if (attempt === 5) {
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
