import { Card, Form, Input, Button, Typography, Flex, Switch, Divider, message } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';

const { TextArea } = Input;

const ClientViewSettings = () => {
  const { t } = useTranslation('client-view-settings');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Get client settings from Redux (replace with API call)
  const clientSettings = useAppSelector((state) => 
    state.clientViewReducer.settingsReducer?.settings || {}
  );

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      console.log('Saving settings:', values);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      message.success(t('settingsSaved'));
    } catch (error) {
      message.error(t('settingsSaveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ marginBlock: 0 }}>
        {t('settings')}
      </Typography.Title>

      <Card title={t('profileSettings')}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={clientSettings}
        >
          <Form.Item
            name="company_name"
            label={t('companyName')}
            rules={[{ required: true, message: t('companyNameRequired') }]}
          >
            <Input placeholder={t('enterCompanyName')} />
          </Form.Item>

          <Form.Item
            name="contact_person"
            label={t('contactPerson')}
            rules={[{ required: true, message: t('contactPersonRequired') }]}
          >
            <Input placeholder={t('enterContactPerson')} />
          </Form.Item>

          <Form.Item
            name="email"
            label={t('email')}
            rules={[
              { required: true, message: t('emailRequired') },
              { type: 'email', message: t('emailInvalid') }
            ]}
          >
            <Input placeholder={t('enterEmail')} />
          </Form.Item>

          <Form.Item
            name="phone"
            label={t('phone')}
          >
            <Input placeholder={t('enterPhone')} />
          </Form.Item>

          <Form.Item
            name="address"
            label={t('address')}
          >
            <TextArea rows={3} placeholder={t('enterAddress')} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t('saveChanges')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title={t('notificationSettings')}>
        <Form layout="vertical">
          <Form.Item
            name="email_notifications"
            label={t('emailNotifications')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="project_updates"
            label={t('projectUpdates')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="invoice_notifications"
            label={t('invoiceNotifications')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="request_updates"
            label={t('requestUpdates')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Card>

      <Card title={t('securitySettings')}>
        <Form layout="vertical">
          <Form.Item
            name="two_factor_auth"
            label={t('twoFactorAuth')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="session_timeout"
            label={t('sessionTimeout')}
          >
            <Input placeholder={t('enterSessionTimeout')} />
          </Form.Item>
        </Form>
      </Card>
    </Flex>
  );
};

export default ClientViewSettings; 