import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Space,
  Typography,
  Checkbox,
  Col,
  Form,
  Row,
  message,
} from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IOrganization } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { scheduleAPIService } from '@/api/schedule/schedule.api.service';
import { Settings } from '@/types/schedule/schedule-v2.types';
import OrganizationCalculationMethod from '@/components/admin-center/overview/organization-calculation-method/organization-calculation-method';

const SettingsPage: React.FC = () => {
  const [organization, setOrganization] = useState<IOrganization | null>(null);
  const [workingDays, setWorkingDays] = useState<Settings['workingDays']>([]);
  const [workingHours, setWorkingHours] = useState<Settings['workingHours']>(8);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const { t } = useTranslation('admin-center/settings');

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
        setWorkingDays(
          res.body.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        );
        setWorkingHours(res.body.workingHours || 8);
        form.setFieldsValue({
          workingDays: res.body.workingDays || [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
          ],
          workingHours: res.body.workingHours || 8,
        });
      }
    } catch (error) {
      logger.error('Error getting organization working settings', error);
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
  }, []);

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title={<span>{t('settings')}</span>} style={{ padding: '16px 0' }} />

      <Space direction="vertical" style={{ width: '100%' }} size={22}>
        <Card>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('organizationWorkingDaysAndHours') || 'Organization Working Days & Hours'}
          </Typography.Title>
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
                  <Col span={8}>
                    <Checkbox value="Monday">{t('monday')}</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="Tuesday">{t('tuesday')}</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="Wednesday">{t('wednesday')}</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="Thursday">{t('thursday')}</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="Friday">{t('friday')}</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="Saturday">{t('saturday')}</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="Sunday">{t('sunday')}</Checkbox>
                  </Col>
                </Row>
              </Checkbox.Group>
            </Form.Item>
            <Form.Item label={t('workingHours')} name="workingHours">
              <Input type="number" min={1} max={24} suffix={t('hours')} width={100} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                {t('saveButton') || 'Save'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <OrganizationCalculationMethod
          organization={organization}
          refetch={getOrganizationDetails}
        />
      </Space>
    </div>
  );
};

export default SettingsPage;