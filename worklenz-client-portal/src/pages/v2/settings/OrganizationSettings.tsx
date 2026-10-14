import React from 'react';
import { Card, Descriptions, Skeleton } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useClientAccess } from '@/hooks/useClientAccess';

/** Which organization this portal belongs to and who manages it. People live under Members. */
const OrganizationSettings: React.FC = () => {
  const { t } = useTranslation();
  const { me, isLoading } = useClientAccess();

  if (isLoading || !me) return <Card><Skeleton active /></Card>;

  return (
    <Card title={t('settings.nav.organization', { defaultValue: 'Organization' })}>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('settings.organization.name', { defaultValue: 'Organization' })}>
          {me.organizationName}
        </Descriptions.Item>
        {me.operatorName && (
          <Descriptions.Item label={t('settings.organization.managedBy', { defaultValue: 'Managed by' })}>
            {me.operatorName}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
};

export default OrganizationSettings;
