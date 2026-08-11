import React, { useEffect, useState } from 'react';
import { Card, Flex, Typography, Button, Spin, Tag, Alert } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import WorklenzPageHeader from '@/components/common/WorklenzPageHeader';
import logger from '@/utils/errorLogger';
import {
  selfHostedBillingApiService,
  IBusinessLicenseStatus,
  ISelfHostedManagementLinks,
} from '@/api/admin-center/self-hosted-billing.api.service';
import { useSelfHostedPaddleCheckout } from './hooks/useSelfHostedPaddleCheckout';

const { Text, Paragraph, Link: TypographyLink } = Typography;

const SelfHostedBilling: React.FC = () => {
  const { t } = useTranslation('admin-center/self-hosted-billing');

  const [licenseStatus, setLicenseStatus] = useState<IBusinessLicenseStatus | null>(null);
  const [managementLinks, setManagementLinks] = useState<ISelfHostedManagementLinks | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await selfHostedBillingApiService.getLicenseStatus();
      if (res.done && res.body) {
        setLicenseStatus(res.body);
        if (res.body.isValid) {
          const linksRes = await selfHostedBillingApiService.getManagementLinks();
          if (linksRes.done) setManagementLinks(linksRes.body);
        }
      } else {
        setIsUnavailable(true);
      }
    } catch (error) {
      logger.error('Error loading self-hosted license status', error);
      setIsUnavailable(true);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const { startCheckout, isLoading, isActivating } = useSelfHostedPaddleCheckout(loadStatus);

  const renderContent = () => {
    if (isLoadingStatus) {
      return (
        <Flex justify="center" style={{ padding: '48px 0' }}>
          <Spin />
        </Flex>
      );
    }

    if (isUnavailable) {
      return (
        <Alert
          type="info"
          showIcon
          message={t('unavailableTitle', { defaultValue: 'Business Edition licensing is not available' })}
          description={t('unavailableDescription', {
            defaultValue:
              'This deployment is running the Community Edition Docker image. Switch to the Business Edition image to purchase and activate the Business plan.',
          })}
        />
      );
    }

    if (isActivating) {
      return (
        <Flex vertical align="center" gap={12} style={{ padding: '32px 0' }}>
          <Spin />
          <Text>
            {t('activating', { defaultValue: 'Payment received — activating your Business plan license...' })}
          </Text>
        </Flex>
      );
    }

    if (licenseStatus?.isValid) {
      return (
        <Flex vertical gap={16}>
          <Flex align="center" gap={8}>
            <Tag color="green">{t('active', { defaultValue: 'Active' })}</Tag>
            <Text>{licenseStatus.status}</Text>
          </Flex>
          {licenseStatus.maxUsers && (
            <Text type="secondary">
              {t('maxUsers', { defaultValue: 'Up to {{count}} users', count: licenseStatus.maxUsers })}
            </Text>
          )}
          {managementLinks && (
            <Flex vertical gap={4}>
              <TypographyLink href={managementLinks.cancelUrl} target="_blank" rel="noopener noreferrer">
                {t('cancelSubscription', { defaultValue: 'Cancel subscription' })}
              </TypographyLink>
              {managementLinks.updatePaymentMethodUrl && (
                <TypographyLink
                  href={managementLinks.updatePaymentMethodUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('updatePaymentMethod', { defaultValue: 'Update payment method' })}
                </TypographyLink>
              )}
            </Flex>
          )}
        </Flex>
      );
    }

    return (
      <Flex vertical gap={16}>
        <Paragraph>
          {t('subscribeDescription', {
            defaultValue:
              'Subscribe to the Business plan to unlock Business Edition features on this self-hosted installation — billed monthly via Paddle.',
          })}
        </Paragraph>
        <Button type="primary" loading={isLoading} onClick={() => void startCheckout()} style={{ alignSelf: 'flex-start' }}>
          {t('subscribeButton', { defaultValue: 'Subscribe to Business Plan' })}
        </Button>
      </Flex>
    );
  };

  return (
    <Flex vertical gap={16}>
      <WorklenzPageHeader
        title={t('title', { defaultValue: 'Business Plan' })}
      />
      <Card>{renderContent()}</Card>
    </Flex>
  );
};

export default SelfHostedBilling;
