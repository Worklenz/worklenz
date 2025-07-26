import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatabaseOutlined,
  message,
  Space,
  Typography,
} from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import OrganizationAdminsTable from '@/components/admin-center/overview/organization-admins-table/organization-admins-table';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import { useTranslation } from 'react-i18next';
import OrganizationName from '@/components/admin-center/overview/organization-name/organization-name';
import OrganizationOwner from '@/components/admin-center/overview/organization-owner/organization-owner';
import HolidayCalendar from '@/components/admin-center/overview/holiday-calendar/holiday-calendar';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { holidayApiService } from '@/api/holiday/holiday.api.service';
import { IOrganization, IOrganizationAdmin } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';

const Overview: React.FC = () => {
  const [organization, setOrganization] = useState<IOrganization | null>(null);
  const [organizationAdmins, setOrganizationAdmins] = useState<IOrganizationAdmin[] | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [populatingHolidays, setPopulatingHolidays] = useState(false);

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

  const handlePopulateHolidays = async () => {
    setPopulatingHolidays(true);
    try {
      const res = await holidayApiService.populateCountryHolidays();
      if (res.done) {
        message.success(`Successfully populated ${res.body.total_populated} holidays`);
      }
    } catch (error) {
      logger.error('Error populating holidays', error);
      message.error('Failed to populate holidays');
    } finally {
      setPopulatingHolidays(false);
    }
  };

  useEffect(() => {
    getOrganizationDetails();
    getOrganizationAdmins();
  }, []);

  return (
    <div style={{ width: '100%' }}>
      <PageHeader 
        title={<span>{t('overview')}</span>} 
        style={{ padding: '16px 0' }}
        extra={[
          <Button
            key="populate-holidays"
            icon={<DatabaseOutlined />}
            onClick={handlePopulateHolidays}
            loading={populatingHolidays}
          >
            Populate Holidays Database
          </Button>
        ]}
      />

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

        <HolidayCalendar themeMode={themeMode} />
      </Space>
    </div>
  );
};

export default Overview;
