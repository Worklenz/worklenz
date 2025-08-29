import React, { useEffect, useState } from 'react';
import { Card, Space, Typography } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import OrganizationAdminsTable from '@/components/admin-center/overview/organization-admins-table/organization-admins-table';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { RootState } from '@/app/store';
import { useTranslation } from 'react-i18next';
import OrganizationName from '@/components/admin-center/overview/organization-name/organization-name';
import OrganizationOwner from '@/components/admin-center/overview/organization-owner/organization-owner';
import {
  fetchOrganizationDetails,
  fetchOrganizationAdmins,
} from '@/features/admin-center/admin-center.slice';
import logger from '@/utils/errorLogger';
import { tr } from 'date-fns/locale';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_overview_visit } from '@/shared/worklenz-analytics-events';

const { Text } = Typography;

const Overview: React.FC = () => {
  const dispatch = useAppDispatch();

  const { trackMixpanelEvent } = useMixpanelTracking();
  const { organization, organizationAdmins, loadingOrganizationAdmins } = useAppSelector(
    (state: RootState) => state.adminCenterReducer
  );

  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const { t } = useTranslation('admin-center/overview');

  const getOrganizationDetails = async () => {
    try {
      await dispatch(fetchOrganizationDetails()).unwrap();
    } catch (error) {
      logger.error('Error getting organization details', error);
    }
  };

  const getOrganizationAdmins = async () => {
    try {
      await dispatch(fetchOrganizationAdmins()).unwrap();
    } catch (error) {
      logger.error('Error getting organization admins', error);
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
            loading={loadingOrganizationAdmins}
            themeMode={themeMode}
          />
        </Card>
      </Space>
    </div>
  );
};

export default Overview;
