import { Button, Card, Col, Divider, Form, Input, notification, Row, Select } from 'antd';
import React, { useEffect, useState } from 'react';
import { RootState } from '../../../app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IBillingConfigurationCountry } from '@/types/admin-center/country.types';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IBillingConfiguration } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';

const Configuration: React.FC = () => {
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);

  const [countries, setCountries] = useState<IBillingConfigurationCountry[]>([]);
  const [configuration, setConfiguration] = useState<IBillingConfiguration>();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const fetchCountries = async () => {
    try {
      const res = await adminCenterApiService.getCountries();
      if (res.done) {
        setCountries(res.body);
      }
    } catch (error) {
      logger.error('Error fetching countries:', error);
    }
  };

  const fetchConfiguration = async () => {
    const res = await adminCenterApiService.getBillingConfiguration();
    if (res.done) {
      setConfiguration(res.body);
      form.setFieldsValue(res.body);
    }
  };

  useEffect(() => {
    fetchCountries();
    fetchConfiguration();
  }, []);

  const handleSave = async (values: any) => {
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
  };

  const countryOptions = countries.map(country => ({
    label: country.name,
    value: country.id,
  }));

  return (
    <div>
      <Card
        title={
          <span
            style={{
              color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
              fontWeight: 500,
              fontSize: '16px',
              display: 'flex',
              gap: '4px',
            }}
          >
            Billing Details
          </span>
        }
        style={{ marginTop: '16px' }}
      >
        <Form form={form} initialValues={configuration} onFinish={handleSave}>
          <Row>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
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
                <Input placeholder="Name" />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
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
                <Input placeholder="Name" disabled />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
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
                <Input
                  placeholder="Phone Number"
                  maxLength={10}
                  onInput={e => {
                    const input = e.target as HTMLInputElement; // Type assertion to access 'value'
                    input.value = input.value.replace(/[^0-9]/g, ''); // Restrict non-numeric input
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '16px 0' }}>
            <span
              style={{
                color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
                fontWeight: 600,
                fontSize: '16px',
                display: 'flex',
                gap: '4px',
              }}
            >
              Company Details
            </span>
          </Divider>

          <Row>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="company_name" label="Company Name" layout="vertical">
                <Input placeholder="Company Name" />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="address_line_1" label="Address Line 01" layout="vertical">
                <Input placeholder="Address Line 01" />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="address_line_2" label="Address Line 02" layout="vertical">
                <Input placeholder="Address Line 02" />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col
              span={8}
              style={{
                padding: '0 12px',
                height: '86px',
                scrollbarColor: 'red',
              }}
            >
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
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="city" label="City" layout="vertical">
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="state" label="State" layout="vertical">
                <Input placeholder="State" />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="postal_code" label="Postal Code" layout="vertical">
                <Input placeholder="Postal Code" />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col style={{ paddingLeft: '12px' }}>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Save
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
};

export default Configuration;
