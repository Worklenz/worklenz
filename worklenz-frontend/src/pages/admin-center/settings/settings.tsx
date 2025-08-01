import React, { useEffect, useState, useMemo } from 'react';
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
  Select,
  Switch,
} from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import logger from '@/utils/errorLogger';
import { scheduleAPIService } from '@/api/schedule/schedule.api.service';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { Settings } from '@/types/schedule/schedule-v2.types';
import OrganizationCalculationMethod from '@/components/admin-center/overview/organization-calculation-method/organization-calculation-method';
import HolidayCalendar from '@/components/admin-center/overview/holiday-calendar/HolidayCalendar';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import {
  fetchOrganizationDetails,
  fetchAdminCenterSettings,
  fetchOrganizationAdmins,
  fetchHolidaySettings,
  updateHolidaySettings,
  fetchCountriesWithStates,
} from '@/features/admin-center/admin-center.slice';

const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    organization,
    holidaySettings,
    countriesWithStates,
    loadingCountries,
  } = useAppSelector((state: RootState) => state.adminCenterReducer);
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const [workingDays, setWorkingDays] = useState<Settings['workingDays']>([]);
  const [workingHours, setWorkingHours] = useState<Settings['workingHours']>(8);
  const [saving, setSaving] = useState(false);
  const [savingHolidays, setSavingHolidays] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();
  const [holidayForm] = Form.useForm();

  const { t } = useTranslation('admin-center/settings');

  const getAdminCenterSettings = async () => {
    try {
      await dispatch(fetchAdminCenterSettings()).unwrap();
    } catch (error) {
      logger.error('Error getting admin center settings', error);
    }
  };

  const getOrganizationAdmins = async () => {
    try {
      await dispatch(fetchOrganizationAdmins()).unwrap();
    } catch (error) {
      logger.error('Error getting organization admins', error);
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
    getAdminCenterSettings();
    getOrganizationAdmins();
    getOrgWorkingSettings();
    dispatch(fetchHolidaySettings());
    dispatch(fetchCountriesWithStates());
  }, []);

  useEffect(() => {
    if (holidaySettings) {
      holidayForm.setFieldsValue({
        country_code: holidaySettings.country_code,
        state_code: holidaySettings.state_code,
        auto_sync_holidays: holidaySettings.auto_sync_holidays ?? true,
      });
      setSelectedCountryCode(holidaySettings.country_code);
    }
  }, [holidaySettings, holidayForm]);

  const handleHolidaySettingsSave = async (values: any) => {
    setSavingHolidays(true);
    try {
      await dispatch(updateHolidaySettings(values)).unwrap();
      message.success(t('holidaySettingsSaved') || 'Holiday settings saved successfully');
    } catch (error) {
      logger.error('Error updating holiday settings', error);
      message.error(t('errorSavingHolidaySettings') || 'Error saving holiday settings');
    } finally {
      setSavingHolidays(false);
    }
  };

  const selectedCountryStates = useMemo(() => {
    const selectedCountry = countriesWithStates.find(
      country => country.code === selectedCountryCode
    );
    return selectedCountry?.states || [];
  }, [countriesWithStates, selectedCountryCode]);

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
            <Row>
              <Col span={6}>
                <Form.Item label={t('workingHours')} name="workingHours">
                  <Input type="number" min={1} max={24} suffix={t('hours')} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                {t('saveButton') || 'Save'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {organization && (
          <OrganizationCalculationMethod
            organization={organization}
            refetch={getAdminCenterSettings}
          />
        )}

        <Card>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('holidaySettings') || 'Holiday Settings'}
          </Typography.Title>
          <Form
            layout="vertical"
            form={holidayForm}
            onFinish={handleHolidaySettingsSave}
            style={{ marginTop: 16 }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={t('country') || 'Country'}
                  name="country_code"
                  rules={[
                    { required: true, message: t('countryRequired') || 'Please select a country' },
                  ]}
                >
                  <Select
                    placeholder={t('selectCountry') || 'Select country'}
                    loading={loadingCountries}
                    onChange={(value) => {
                      holidayForm.setFieldValue('state_code', undefined);
                      setSelectedCountryCode(value);
                    }}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {countriesWithStates.map(country => (
                      <Select.Option key={country.code} value={country.code}>
                        {country.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              {selectedCountryStates.length > 0 && (
                <Col span={12}>
                  <Form.Item label={t('state') || 'State/Province'} name="state_code">
                    <Select
                      placeholder={t('selectState') || 'Select state/province (optional)'}
                      allowClear
                      disabled={!holidayForm.getFieldValue('country_code')}
                      showSearch
                      filterOption={(input, option) =>
                        (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {selectedCountryStates.map(state => (
                        <Select.Option key={state.code} value={state.code}>
                          {state.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              )}
            </Row>
            <Form.Item
              label={t('autoSyncHolidays') || 'Automatically sync official holidays'}
              name="auto_sync_holidays"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={savingHolidays}>
                {t('saveHolidaySettings') || 'Save Holiday Settings'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <HolidayCalendar themeMode={themeMode} workingDays={workingDays} />
      </Space>
    </div>
  );
};

export default SettingsPage;
