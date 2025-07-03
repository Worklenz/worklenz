import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, notification, Row, Typography } from 'antd';
import React, { useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import logger from '@/utils/errorLogger';
import { useTranslation } from 'react-i18next';

const ChangePassword: React.FC = () => {
  const { t } = useTranslation('settings/change-password');
  useDocumentTitle(t('title'));
  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm();

  // Password validation regex
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

  const validatePassword = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error(t('newPasswordRequired')));
    }
    if (!passwordRegex.test(value)) {
      return Promise.reject(new Error(t('passwordValidationError')));
    }
    return Promise.resolve();
  };

  const handleFormSubmit = async (values: any) => {
    try {
      setLoading(true);
      const body = {
        new_password: values.newPassword,
        confirm_password: values.confirmPassword,
        password: values.currentPassword,
      };

      const res = await profileSettingsApiService.changePassword(body);
      if (res.done) {
        form.resetFields();
      }
    } catch (error) {
      logger.error('Error changing password', error);
    } finally {
      setLoading(false);
    }
  };

  // Common password input props
  const getPasswordInputProps = (placeholder: string) => ({
    type: 'password',
    style: { width: '350px' },
    placeholder,
    iconRender: (visible: boolean) =>
      visible ? (
        <EyeInvisibleOutlined style={{ color: '#000000d9' }} />
      ) : (
        <EyeOutlined style={{ color: '#000000d9' }} />
      ),
  });

  return (
    <Card style={{ width: '100%' }}>
      <Form layout="vertical" form={form} onFinish={handleFormSubmit}>
        <Row>
          <Form.Item
            name="currentPassword"
            label={t('currentPassword')}
            rules={[
              {
                required: true,
                message: t('currentPasswordRequired'),
              },
            ]}
            style={{ marginBottom: '24px' }}
          >
            <Input.Password {...getPasswordInputProps(t('currentPasswordPlaceholder'))} />
          </Form.Item>
        </Row>
        <Row>
          <Form.Item
            name="newPassword"
            label={t('newPassword')}
            rules={[{ validator: validatePassword }]}
          >
            <Input.Password {...getPasswordInputProps(t('newPasswordPlaceholder'))} />
          </Form.Item>
        </Row>
        <Row>
          <Form.Item
            name="confirmPassword"
            label={t('confirmPassword')}
            dependencies={['newPassword']}
            rules={[
              {
                required: true,
                message: t('newPasswordRequired'),
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('passwordMismatch')));
                },
              }),
            ]}
            style={{ marginBottom: '0px' }}
          >
            <Input.Password {...getPasswordInputProps(t('confirmPasswordPlaceholder'))} />
          </Form.Item>
        </Row>
        <Row style={{ width: '350px', margin: '0.5rem 0' }}>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            {t('passwordRequirements')}
          </Typography.Text>
        </Row>
        <Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t('updateButton')}
            </Button>
          </Form.Item>
        </Row>
      </Form>
    </Card>
  );
};

export default ChangePassword;
