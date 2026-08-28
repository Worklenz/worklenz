import { Button, Card, Col, Divider, Form, Input, Row, Select } from '@/shared/antd-imports';
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { RootState } from '../../../app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IBillingConfigurationCountry } from '@/types/admin-center/country.types';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IBillingConfiguration } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { validatePhoneNumber } from '@/utils/validatePhoneNumber';
import PhoneInput from '@/components/PhoneInput/PhoneInput';
import { useTranslation } from 'react-i18next';

const Configuration: React.FC = React.memo(() => {
  const { t } = useTranslation('admin-center/configuration');
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);

  const [countries, setCountries] = useState<IBillingConfigurationCountry[]>([]);
  const [configuration, setConfiguration] = useState<IBillingConfiguration>();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [form] = Form.useForm();

  // Holds the last-saved values so we can diff against them on every field change
  const savedConfigRef = useRef<IBillingConfiguration | null>(null);

  const fetchCountries = useCallback(async () => {
    try {
      const res = await adminCenterApiService.getCountries();
      if (res.done) {
        setCountries(res.body);
      }
    } catch (error) {
      logger.error('Error fetching countries:', error);
    }
  }, []);

  const fetchConfiguration = useCallback(async () => {
    const res = await adminCenterApiService.getBillingConfiguration();
    if (res.done) {
      setConfiguration(res.body);
      form.setFieldsValue(res.body);
      // Snapshot the server truth so handleValuesChange can diff against it
      savedConfigRef.current = res.body;
      setIsDirty(false);
    }
  }, [form]);

  useEffect(() => {
    fetchCountries();
    fetchConfiguration();
  }, [fetchCountries, fetchConfiguration]);

  // Fired on every field change by Ant Design's onValuesChange prop.
  // Compares live form values against the saved snapshot to set isDirty.
  // This also correctly handles the case where the user reverts a change back
  // to the original value — the button will disable again.
  const handleValuesChange = useCallback(() => {
    if (!savedConfigRef.current) return;
    const current = form.getFieldsValue();
    const saved = savedConfigRef.current as Record<string, unknown>;
    const changed = Object.keys(current).some(
      key => current[key] !== saved[key]
    );
    setIsDirty(changed);
  }, [form]);

  const handleSave = useCallback(
    async (values: any) => {
      try {
        setLoading(true);
        const res = await adminCenterApiService.updateBillingConfiguration(values);
        if (res.done) {
          // Re-fetch to sync with server; fetchConfiguration also resets isDirty
          // and updates savedConfigRef — no need for form.resetFields() which
          // would revert to the stale initialValues from the first render.
          await fetchConfiguration();
        }
      } catch (error) {
        logger.error('Error updating configuration:', error);
      } finally {
        setLoading(false);
      }
    },
    [fetchConfiguration]
  );

  const countryOptions = useMemo(
    () =>
      countries.map(country => ({
        label: country.name,
        value: country.id,
      })),
    [countries]
  );

  const titleStyle = useMemo(
    () => ({
      color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
      fontWeight: 500,
      fontSize: '16px',
      display: 'flex',
      gap: '4px',
    }),
    [themeMode]
  );

  const dividerTitleStyle = useMemo(
    () => ({
      color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
      fontWeight: 600,
      fontSize: '16px',
      display: 'flex',
      gap: '4px',
    }),
    [themeMode]
  );

  const cardStyle = useMemo(() => ({ marginTop: '16px' }), []);
  const colStyle = useMemo(() => ({ padding: '0 12px', height: '86px' }), []);
  const dividerStyle = useMemo(() => ({ margin: '16px 0' }), []);
  const buttonColStyle = useMemo(() => ({ paddingLeft: '12px' }), []);

  return (
    <div>
        <Card title={<span style={titleStyle}>{t('billingDetails', { defaultValue: 'Billing Details' })}</span>} style={cardStyle}>
        <Form
          form={form}
          initialValues={configuration}
          onFinish={handleSave}
          onValuesChange={handleValuesChange}
        >
          <Row gutter={[0, 0]}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item
                name="name"
                label={t('name', { defaultValue: 'Name' })}
                layout="vertical"
                rules={[{ required: true }]}
              >
                <Input placeholder={t('namePlaceholder', { defaultValue: 'Enter name' })} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item
                name="email"
                label={t('emailAddress', { defaultValue: 'Email Address' })}
                layout="vertical"
                rules={[{ required: true }]}
              >
                <Input placeholder={t('emailPlaceholder', { defaultValue: 'Enter email' })} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item
                name="phone"
                label={t('contactNumber', { defaultValue: 'Contact Number' })}
                layout="vertical"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value || value.trim() === '') return Promise.resolve();
                      if (validatePhoneNumber(value)) return Promise.resolve();
                      return Promise.reject(new Error(t('phoneValidationError', { defaultValue: 'Please enter a valid phone number' })));
                    },
                  },
                ]}
              >
                <PhoneInput placeholder={t('phoneNumberPlaceholder', { defaultValue: 'Enter phone number' })} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ ...dividerStyle, fontSize: '14px' }}>
            <span style={dividerTitleStyle}>{t('companyDetails', { defaultValue: 'Company Details' })}</span>
          </Divider>

          <Row gutter={[0, 0]}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="company_name" label={t('companyName', { defaultValue: 'Company Name' })} layout="vertical">
                <Input placeholder={t('companyNamePlaceholder', { defaultValue: 'Enter company name' })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="address_line_1" label={t('addressLine01', { defaultValue: 'Address Line 1' })} layout="vertical">
                <Input placeholder={t('addressLine01Placeholder', { defaultValue: 'Street address' })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="address_line_2" label={t('addressLine02', { defaultValue: 'Address Line 2' })} layout="vertical">
                <Input placeholder={t('addressLine02Placeholder', { defaultValue: 'Apt, suite, etc.' })} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[0, 0]}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="country" label={t('country', { defaultValue: 'Country' })} layout="vertical">
                <Select
                  dropdownStyle={{ maxHeight: 256, overflow: 'auto' }}
                  placement="topLeft"
                  showSearch
                  placeholder={t('countryPlaceholder', { defaultValue: 'Select country' })}
                  optionFilterProp="label"
                  allowClear
                  options={countryOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="city" label={t('city', { defaultValue: 'City' })} layout="vertical">
                <Input placeholder={t('cityPlaceholder', { defaultValue: 'Enter city' })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="state" label={t('state', { defaultValue: 'State' })} layout="vertical">
                <Input placeholder={t('statePlaceholder', { defaultValue: 'Enter state' })} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[0, 0]}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="postal_code" label={t('postalCode', { defaultValue: 'Postal Code' })} layout="vertical">
                <Input placeholder={t('postalCodePlaceholder', { defaultValue: 'Enter postal code' })} />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={{ ...buttonColStyle, marginTop: 8 }}>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  disabled={!isDirty}
                  block
                >
                  {t('save', { defaultValue: 'Save' })}
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
});

Configuration.displayName = 'Configuration';

export default Configuration;