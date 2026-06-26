import React, { useEffect, useState } from 'react';
import { Card, Space, Typography, Row, Col, Divider } from '@/shared/antd-imports';
import WorklenzPageHeader from '@/components/common/WorklenzPageHeader';
import OrganizationAdminsTable from '@/components/admin-center/overview/organization-admins-table/organization-admins-table';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { RootState } from '@/app/store';
import { useTranslation } from 'react-i18next';
import OrganizationName from '@/components/admin-center/overview/organization-name/organization-name';
import OrganizationOwner from '@/components/admin-center/overview/organization-owner/organization-owner';
import OrganizationLogo from '@/components/admin-center/overview/organization-logo/organization-logo';
import {
  fetchOrganizationDetails,
  fetchOrganizationAdmins,
  fetchBillingInfo,
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

  const getBillingInfo = async () => {
    try {
      await dispatch(fetchBillingInfo()).unwrap();
    } catch (error) {
      logger.error('Error getting billing info', error);
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_overview_visit);
    getOrganizationDetails();
    getOrganizationAdmins();
    getBillingInfo();
  }, [trackMixpanelEvent]);

  return (
    <div style={{ width: '100%' }}>
      <WorklenzPageHeader title={<span>{t('overview')}</span>} style={{ padding: '16px 0' }} />

      <Space direction="vertical" style={{ width: '100%' }} size={24}>
        {/* Organization Profile Section */}
        <Card
          style={{
            borderRadius: '8px',
            boxShadow:
              themeMode === 'dark'
                ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Typography.Title level={4} style={{ margin: 0, marginBottom: 20 }}>
            {t('organizationProfile')}
          </Typography.Title>
          <Divider style={{ margin: '16px 0' }} />
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={24} md={12} lg={8}>
              <OrganizationLogo
                themeMode={themeMode}
                organization={organization}
                t={t}
                refetch={getOrganizationDetails}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={8}>
              <OrganizationName
                themeMode={themeMode}
                name={organization?.name || ''}
                t={t}
                refetch={getOrganizationDetails}
              />
            </Col>
            <Col xs={24} sm={24} md={24} lg={8}>
              <OrganizationOwner
                themeMode={themeMode}
                organization={organization}
                t={t}
                refetch={getOrganizationDetails}
              />
            </Col>
          </Row>
        </Card>

        {/* Organization Admins Section */}
        <Card
          style={{
            borderRadius: '8px',
            boxShadow:
              themeMode === 'dark'
                ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Typography.Title level={4} style={{ margin: 0, marginBottom: 16 }}>
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
