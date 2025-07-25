import { Button, Card, Col, Divider, Form, Input, notification, Row, Select } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RootState } from '../../../app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IBillingConfigurationCountry } from '@/types/admin-center/country.types';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IBillingConfiguration } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';

const Configuration: React.FC = () => {
  const { t } = useTranslation('admin-center/configuration');
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
            {t('billingDetails')}
          </span>
        }
        style={{ marginTop: '16px' }}
      >
        <Form
          form={form}
          initialValues={configuration}
          onFinish={handleSave}
        >
          <Row>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item
                name="name"
                label={t('name')}
                layout="vertical"
                rules={[
                  {
                    required: true,
                  },
                ]}
              >
                <Input placeholder={t('name')} />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item
                name="email"
                label={t('emailAddress')}
                layout="vertical"
                rules={[
                  {
                    required: true,
                  },
                ]}
              >
                <Input placeholder={t('name')} disabled />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item
                name="phone"
                label={t('contactNumber')}
                layout="vertical"
                rules={[
                  {
                    pattern: /^\d{10}$/,
                    message: t('phoneNumberValidation'),
                  },
                ]}
              >
                <Input
                  placeholder={t('phoneNumber')}
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
              {t('companyDetails')}
            </span>
          </Divider>

          <Row>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="company_name" label={t('companyName')} layout="vertical">
                <Input placeholder={t('companyName')} />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="address_line_1" label={t('addressLine01')} layout="vertical">
                <Input placeholder={t('addressLine01')} />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="address_line_2" label={t('addressLine02')} layout="vertical">
                <Input placeholder={t('addressLine02')} />
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
              <Form.Item name="country" label={t('country')} layout="vertical">
                <Select
                  dropdownStyle={{ maxHeight: 256, overflow: 'auto' }}
                  placement="topLeft"
                  showSearch
                  placeholder={t('country')}
                  optionFilterProp="label"
                  
                  allowClear
                  options={countryOptions}
                />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="city" label={t('city')} layout="vertical">
                <Input placeholder={t('city')} />
              </Form.Item>
            </Col>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="state" label={t('state')} layout="vertical">
                <Input placeholder={t('state')} />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col span={8} style={{ padding: '0 12px', height: '86px' }}>
              <Form.Item name="postal_code" label={t('postalCode')} layout="vertical">
                <Input placeholder={t('postalCode')} />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col style={{ paddingLeft: '12px' }}>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  {t('save')}
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
