import { Button, Card, Col, Divider, Form, Input, Row, Select } from '@/shared/antd-imports';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { RootState } from '../../../app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IBillingConfigurationCountry } from '@/types/admin-center/country.types';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IBillingConfiguration } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';

const Configuration: React.FC = React.memo(() => {
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);

  const [countries, setCountries] = useState<IBillingConfigurationCountry[]>([]);
  const [configuration, setConfiguration] = useState<IBillingConfiguration>();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

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
    }
  }, [form]);

  useEffect(() => {
    fetchCountries();
    fetchConfiguration();
  }, [fetchCountries, fetchConfiguration]);

  const handleSave = useCallback(
    async (values: any) => {
      try {
        setLoading(true);
        const res = await adminCenterApiService.updateBillingConfiguration(values);
        if (res.done) {
          fetchConfiguration();
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

  const handlePhoneInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '');
  }, []);

  return (
    <div>
      <Card title={<span style={titleStyle}>Billing Details</span>} style={cardStyle}>
        <Form form={form} initialValues={configuration} onFinish={handleSave}>
          <Row gutter={[0, 0]}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item
                name="name"
                label="Name"
                layout="vertical"
                rules={[
                  {
                    required: true,
                  },
                ]}
              >
                <Input placeholder="Name" disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item
                name="email"
                label="Email Address"
                layout="vertical"
                rules={[
                  {
                    required: true,
                  },
                ]}
              >
                <Input placeholder="Email Address" disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item
                name="phone"
                label="Contact Number"
                layout="vertical"
                rules={[
                  {
                    pattern: /^\d{10}$/,
                    message: 'Phone number must be exactly 10 digits',
                  },
                ]}
              >
                <Input placeholder="Phone Number" maxLength={10} onInput={handlePhoneInput} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ ...dividerStyle, fontSize: '14px' }}>
            <span style={dividerTitleStyle}>Company Details</span>
          </Divider>

          <Row gutter={[0, 0]}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="company_name" label="Company Name" layout="vertical">
                <Input placeholder="Company Name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="address_line_1" label="Address Line 01" layout="vertical">
                <Input placeholder="Address Line 01" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="address_line_2" label="Address Line 02" layout="vertical">
                <Input placeholder="Address Line 02" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[0, 0]}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="country" label="Country" layout="vertical">
                <Select
                  dropdownStyle={{ maxHeight: 256, overflow: 'auto' }}
                  placement="topLeft"
                  showSearch
                  placeholder="Country"
                  optionFilterProp="label"
                  allowClear
                  options={countryOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="city" label="City" layout="vertical">
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="state" label="State" layout="vertical">
                <Input placeholder="State" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[0, 0]}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={colStyle}>
              <Form.Item name="postal_code" label="Postal Code" layout="vertical">
                <Input placeholder="Postal Code" />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col xs={24} sm={24} md={8} lg={8} xl={8} style={{ ...buttonColStyle, marginTop: 8 }}>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Save
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
