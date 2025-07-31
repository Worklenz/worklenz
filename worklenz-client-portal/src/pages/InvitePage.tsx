import React, { useCallback, useEffect } from 'react';
import { Card, Input, Button, Typography, Form, message, Alert } from '@/shared/antd-imports';
import { LockOutlined, UserOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import AuthPageHeader from '@/components/AuthPageHeader';
import { validateInviteToken, acceptInvite, setError } from '@/store/slices/authSlice';
import type { RootState } from '@/store';
import { clientPortalAPI } from '@/services/api';

interface InviteFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const InvitePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { isLoading, error, inviteToken, inviteValid, inviteLoading, inviteDetails, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  const [form] = Form.useForm<InviteFormValues>();

  const validationRules = {
    name: [
      { required: true, message: t('invite.name_required') },
      { min: 2, message: t('invite.name_min') },
    ],
    email: [
      { required: true, message: t('invite.email_required') },
      { type: 'email' as const, message: t('invite.email_invalid') },
    ],
    password: [
      { required: true, message: t('invite.password_required') },
      { min: 8, message: t('invite.password_min') },
    ],
    confirmPassword: [
      { required: true, message: t('invite.confirm_password_required') },
      ({ getFieldValue }: { getFieldValue: (field: string) => string }) => ({
        validator(_: unknown, value: string) {
          if (!value || getFieldValue('password') === value) {
            return Promise.resolve();
          }
          return Promise.reject(new Error(t('invite.password_mismatch')));
        },
      }),
    ],
  };

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, isAuthenticated]);

  // Validate invite token on page load
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      dispatch(validateInviteToken(token));
    }
  }, [searchParams, dispatch]);

  // Handle organization invites automatically
  useEffect(() => {
    if (inviteDetails?.isOrganizationInvite && inviteToken) {
      // For organization invites, automatically process the invitation
      const handleOrgInvite = async () => {
        try {
          const response = await clientPortalAPI.handleOrganizationInvite(inviteToken);
          if (response.body.redirectTo === 'client-portal') {
            navigate('/dashboard', { replace: true });
          } else {
            // Redirect to login
            navigate('/auth/login', { 
              state: { 
                organizationInviteToken: inviteToken,
                message: 'Please login to accept the organization invitation.'
              } 
            });
          }
        } catch (error) {
          dispatch(setError('Failed to process organization invitation'));
        }
      };
      
      handleOrgInvite();
    }
  }, [inviteDetails, inviteToken, navigate, dispatch]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      dispatch(setError(null));
    };
  }, [dispatch]);

  // Autofill form when invitation details are loaded
  useEffect(() => {
    if (inviteDetails) {
      form.setFieldsValue({
        email: inviteDetails.email || '',
        name: inviteDetails.name || '',
      });
    }
  }, [inviteDetails, form]);

  const onFinish = useCallback(
    async (values: InviteFormValues) => {
      if (!inviteToken) {
        message.error(t('invite.invalid_token'));
        return;
      }

      try {
        const result = await dispatch(acceptInvite({
          token: inviteToken,
          name: values.name,
          email: values.email,
          password: values.password
        }));
        
        if (acceptInvite.fulfilled.match(result)) {
          message.success(t('invite.success'));
          navigate('/dashboard', { replace: true });
        } else {
          const errorMessage = result.payload as string || t('invite.acceptance_error');
          message.error(errorMessage);
        }
      } catch (error) {
        console.error('Invite acceptance failed:', error);
        message.error(t('invite.acceptance_error'));
      }
    },
    [dispatch, navigate, t, inviteToken]
  );

  const styles = {
    card: {
      width: 500,
      maxWidth: '90vw',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    },
    button: {
      borderRadius: 4,
    },
    link: {
      fontSize: 14,
    },
  };

  if (inviteLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <Card style={styles.card}>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Typography.Title level={3}>{t('invite.validating')}</Typography.Title>
            <Typography.Text>{t('invite.validating_description')}</Typography.Text>
          </div>
        </Card>
      </div>
    );
  }

  if (!inviteValid) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <Card style={styles.card}>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Typography.Title level={3} style={{ color: '#ff4d4f' }}>
              {t('invite.invalid_title')}
            </Typography.Title>
            <Typography.Text style={{ marginBottom: 24, display: 'block' }}>
              {t('invite.invalid_description')}
            </Typography.Text>
            <Link to="/auth/login">
              <Button type="primary" size="large">
                {t('invite.back_to_login')}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f0f2f5'
    }}>
      <Card
        style={styles.card}
        styles={{ body: { padding: 32 } }}
        variant="outlined"
      >
        <AuthPageHeader description={t('invite.description')} />

        <Alert
          message={t('invite.welcome_message')}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {error && (
          <Alert
            message={error}
            type="error"
            closable
            onClose={() => dispatch(setError(null))}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          name="invite"
          layout="vertical"
          autoComplete="off"
          requiredMark="optional"
          onFinish={onFinish}
          style={{ width: '100%' }}
        >
          <Form.Item name="name" rules={validationRules.name}>
            <Input
              prefix={<UserOutlined />}
              placeholder={t('invite.name_placeholder')}
              size="large"
              style={styles.button}
            />
          </Form.Item>

          <Form.Item name="email" rules={validationRules.email}>
            <Input
              prefix={<MailOutlined />}
              placeholder={t('invite.email_placeholder')}
              size="large"
              style={styles.button}
              disabled={!!inviteDetails?.email}
            />
          </Form.Item>

          <Form.Item name="password" rules={validationRules.password}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('invite.password_placeholder')}
              size="large"
              style={styles.button}
            />
          </Form.Item>

          <Form.Item name="confirmPassword" rules={validationRules.confirmPassword}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('invite.confirm_password_placeholder')}
              size="large"
              style={styles.button}
            />
          </Form.Item>

          <Form.Item>
            <Button
              block
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoading}
              style={styles.button}
            >
              {t('invite.accept_invite')}
            </Button>
          </Form.Item>

          <Form.Item>
            <Typography.Text style={{ ...styles.link, textAlign: 'center', display: 'block' }}>
              {t('invite.already_have_account')}{' '}
              <Link to="/auth/login" className="ant-typography ant-typography-link blue-link">
                {t('invite.sign_in')}
              </Link>
            </Typography.Text>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default InvitePage; 