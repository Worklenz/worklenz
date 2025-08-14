import { EditOutlined, MailOutlined, PhoneOutlined } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { Button, Card, Input, Space, Tooltip, Typography } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import OrganizationAdminsTable from '@/components/admin-center/overview/organization-admins-table/organization-admins-table';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import { useTranslation } from 'react-i18next';
import OrganizationName from '@/components/admin-center/overview/organization-name/organization-name';
import OrganizationOwner from '@/components/admin-center/overview/organization-owner/organization-owner';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IOrganization, IOrganizationAdmin } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { tr } from 'date-fns/locale';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_overview_visit } from '@/shared/worklenz-analytics-events';

const { Text } = Typography;

const Overview: React.FC = () => {
  const [organization, setOrganization] = useState<IOrganization | null>(null);
  const [organizationAdmins, setOrganizationAdmins] = useState<IOrganizationAdmin[] | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const { t } = useTranslation('admin-center/overview');

  const getOrganizationDetails = async () => {
    try {
      const res = await adminCenterApiService.getOrganizationDetails();
      if (res.done) {
        setOrganization(res.body);
      }
    } catch (error) {
      logger.error('Error getting organization details', error);
    }
  };

  const getOrganizationAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await adminCenterApiService.getOrganizationAdmins();
      if (res.done) {
        setOrganizationAdmins(res.body);
      }
    } catch (error) {
      logger.error('Error getting organization admins', error);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_overview_visit);
    getOrganizationDetails();
    getOrganizationAdmins();
  }, [trackMixpanelEvent]);

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title={<span>{t('overview')}</span>} style={{ padding: '16px 0' }} />

      <Space direction="vertical" style={{ width: '100%' }} size={22}>
        <OrganizationName
          themeMode={themeMode}
          name={organization?.name || ''}
          t={t}
          refetch={getOrganizationDetails}
        />

        <OrganizationOwner
          themeMode={themeMode}
          organization={organization}
          t={t}
          refetch={getOrganizationDetails}
        />

        <Card>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('admins')}
          </Typography.Title>
          <OrganizationAdminsTable
            organizationAdmins={organizationAdmins}
            loading={loadingAdmins}
            themeMode={themeMode}
          />
        </Card>
      </Space>
    </div>
  );
};

export default Overview;
