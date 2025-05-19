import { EditOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { PageHeader } from '@ant-design/pro-components';
import { Button, Card, Input, Space, Tooltip, Typography, Checkbox, Col, Form, Row, message } from 'antd';
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
import { scheduleAPIService } from '@/api/schedule/schedule.api.service';
import { Settings } from '@/types/schedule/schedule-v2.types';

const { Text } = Typography;

const Overview: React.FC = () => {
  const [organization, setOrganization] = useState<IOrganization | null>(null);
  const [organizationAdmins, setOrganizationAdmins] = useState<IOrganizationAdmin[] | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [workingDays, setWorkingDays] = useState<Settings['workingDays']>([]);
  const [workingHours, setWorkingHours] = useState<Settings['workingHours']>(8);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

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

  const getOrgWorkingSettings = async () => {
    try {
      const res = await scheduleAPIService.fetchScheduleSettings();
      if (res && res.done) {
        setWorkingDays(res.body.workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday']);
        setWorkingHours(res.body.workingHours || 8);
        form.setFieldsValue({ workingDays: res.body.workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday'], workingHours: res.body.workingHours || 8 });
      }
    } catch (error) {
      logger.error('Error getting organization working settings', error);
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

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const res = await scheduleAPIService.updateScheduleSettings({
        workingDays: values.workingDays,
        workingHours: values.workingHours,
      });
      if (res && res.done) {
        message.success(t('saved'));
        setWorkingDays(values.workingDays);
        setWorkingHours(values.workingHours);
        getOrgWorkingSettings();
      }
    } catch (error) {
      logger.error('Error updating organization working days/hours', error);
      message.error(t('errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    getOrganizationDetails();
    getOrgWorkingSettings();
    getOrganizationAdmins();
  }, []);

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
          <Typography.Title level={5} style={{ margin: 0 }}>{t('organizationWorkingDaysAndHours') || 'Organization Working Days & Hours'}</Typography.Title>
          <Form
            layout="vertical"
            form={form}
            initialValues={{ workingDays, workingHours }}
            onFinish={handleSave}
            style={{ marginTop: 16 }}
          >
            <Form.Item label={t('workingDays')} name="workingDays">
              <Checkbox.Group>
                <Row>
                  <Col span={8}><Checkbox value="Monday">{t('monday')}</Checkbox></Col>
                  <Col span={8}><Checkbox value="Tuesday">{t('tuesday')}</Checkbox></Col>
                  <Col span={8}><Checkbox value="Wednesday">{t('wednesday')}</Checkbox></Col>
                  <Col span={8}><Checkbox value="Thursday">{t('thursday')}</Checkbox></Col>
                  <Col span={8}><Checkbox value="Friday">{t('friday')}</Checkbox></Col>
                  <Col span={8}><Checkbox value="Saturday">{t('saturday')}</Checkbox></Col>
                  <Col span={8}><Checkbox value="Sunday">{t('sunday')}</Checkbox></Col>
                </Row>
              </Checkbox.Group>
            </Form.Item>
            <Form.Item label={t('workingHours')} name="workingHours">
              <Input type="number" min={1} max={24} suffix={t('hours')} width={100} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>{t('saveButton') || 'Save'}</Button>
            </Form.Item>
          </Form>
        </Card>

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
