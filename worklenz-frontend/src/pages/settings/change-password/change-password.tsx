import { EyeInvisibleOutlined, EyeOutlined } from '@/shared/antd-imports';
import { Button, Card, Form, Input, Modal, Row, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import logger from '@/utils/errorLogger';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';

const ChangePassword: React.FC = () => {
  const { t } = useTranslation('settings/change-password');
  useDocumentTitle(t('title', { defaultValue: 'Change Password' }));
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const [loading, setLoading] = useState<boolean>(false);
  const [pendingValues, setPendingValues] = useState<{
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
  } | null>(null);
  // Only accounts with no password yet (e.g. Google-only signups) may skip the current password.
  const [askForCurrentPassword, setAskForCurrentPassword] = useState<boolean>(
    () => session?.has_password !== false
  );
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

  const handleFormSubmit = (values: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    setPendingValues(values);
  };

  const submitPasswordChange = async (logoutOtherSessions: boolean) => {
    if (!pendingValues) return;

    try {
      setLoading(true);
      const body = {
        new_password: pendingValues.newPassword,
        confirm_password: pendingValues.confirmPassword,
        password: askForCurrentPassword ? pendingValues.currentPassword || '' : '',
        logout_other_sessions: logoutOtherSessions,
      };

      const res = await profileSettingsApiService.changePassword(body);
      setPendingValues(null);
      if (res.done) {
        form.resetFields();
        const currentSession = authService.getCurrentSession();
        if (currentSession && !currentSession.has_password) {
          authService.setCurrentSession({ ...currentSession, has_password: true });
        }
        setAskForCurrentPassword(true);
        if (logoutOtherSessions) {
          window.location.href = '/auth/logging-out';
        }
        return;
      }

      const message = String(res.message || '').toLowerCase();
      if (message.includes('old password')) {
        setAskForCurrentPassword(true);
      }
    } catch (error) {
      setPendingValues(null);
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
        <EyeInvisibleOutlined style={{ color: 'var(--ant-color-text-secondary)' }} />
      ) : (
        <EyeOutlined style={{ color: 'var(--ant-color-text-secondary)' }} />
      ),
  });

  return (
    <Card style={{ width: '100%' }}>
      <Modal
        open={pendingValues !== null}
        title={t('logoutOtherSessionsTitle', { defaultValue: 'Log out other sessions?' })}
        onOk={() => submitPasswordChange(true)}
        onCancel={() => submitPasswordChange(false)}
        okText={t('logoutOtherSessionsYes', { defaultValue: 'Yes, log out other sessions' })}
        cancelText={t('logoutOtherSessionsNo', { defaultValue: 'No, keep them signed in' })}
        confirmLoading={loading}
        cancelButtonProps={{ disabled: loading }}
        closable={false}
        keyboard={false}
        maskClosable={false}
      >
        <Typography.Text>
          {t('logoutOtherSessionsDescription', {
            defaultValue:
              'Do you want to log out all browsers and devices using your account, including this one?',
          })}
        </Typography.Text>
      </Modal>
      <Form layout="vertical" form={form} onFinish={handleFormSubmit}>
        {!askForCurrentPassword && (
          <Row style={{ width: '350px', marginBottom: '16px' }}>
            <Typography.Text type="secondary">
              {t('setPasswordHint', {
                defaultValue:
                  'You signed in with Google. Set a password to also sign in with your email.',
              })}
            </Typography.Text>
          </Row>
        )}
        {askForCurrentPassword && (
          <Row>
            <Form.Item
              name="currentPassword"
              label={t('currentPassword', { defaultValue: 'Current Password' })}
              rules={[
                {
                  required: true,
                  message: t('currentPasswordRequired', {
                    defaultValue: 'Please input your current password!',
                  }),
                },
              ]}
              style={{ marginBottom: '24px' }}
            >
              <Input.Password
                {...getPasswordInputProps(
                  t('currentPasswordPlaceholder', { defaultValue: 'Enter your current password' })
                )}
              />
            </Form.Item>
          </Row>
        )}
        <Row>
          <Form.Item
            name="newPassword"
            label={t('newPassword')}
            rules={[
              {
                required: true,
                message: t('newPasswordRequired'),
              },
            ]}
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
