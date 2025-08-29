import React, { useCallback, useEffect, useState } from 'react';
import { Card, Input, Flex, Checkbox, Button, Typography, Space, Form, message } from '@/shared/antd-imports';
import { Rule } from 'antd/es/form';

import { LockOutlined, UserOutlined } from '@/shared/antd-imports';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from 'react-responsive';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import PageHeader from '@components/AuthPageHeader';
import googleIcon from '@assets/images/google-icon.png';
import { login, verifyAuthentication } from '@/features/auth/authSlice';
import logger from '@/utils/errorLogger';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import {
  evt_login_page_visit,
  evt_login_with_email_click,
  evt_login_with_google_click,
  evt_login_remember_me_click,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import alertService from '@/services/alerts/alertService';
import { useAuthService } from '@/hooks/useAuth';
import { WORKLENZ_REDIRECT_PROJ_KEY } from '@/shared/constants';

interface LoginFormValues {
  email: string;
  password: string;
  remember?: boolean;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('auth/login');
  const isMobile = useMediaQuery({ query: '(max-width: 576px)' });
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector(state => state.auth);
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [form] = Form.useForm<LoginFormValues>();
  const currentSession = useAuthService().getCurrentSession();
  const [urlParams, setUrlParams] = useState({
    teamId: '',
    projectId: '',
  });

  const enableGoogleLogin = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true' || false;

  useDocumentTitle('Login');

  const validationRules = {
    email: [
      { required: true, message: t('emailRequired') },
      { type: 'email', message: t('validationMessages.email') },
    ],
    password: [
      { required: true, message: t('passwordRequired') },
      { min: 8, message: t('validationMessages.password') },
    ],
  };

  const verifyAuthStatus = async () => {
    try {
      const session = await dispatch(verifyAuthentication()).unwrap();

      if (session?.authenticated) {
        setSession(session.user);
        dispatch(setUser(session.user));
        navigate('/worklenz/home');
      }
    } catch (error) {
      logger.error('Failed to verify authentication status', error);
    }
  };

  useEffect(() => {
    // Check and unregister ngsw-worker if present
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        const ngswWorker = registrations.find(reg => reg.active?.scriptURL.includes('ngsw-worker'));
        if (ngswWorker) {
          ngswWorker.unregister().then(() => {
            window.location.reload();
          });
        }
      });
    }

    trackMixpanelEvent(evt_login_page_visit);
    if (currentSession && !currentSession?.setup_completed) {
      navigate('/worklenz/setup');
      return;
    }
    void verifyAuthStatus();
  }, [dispatch, navigate, trackMixpanelEvent]);

  const onFinish = useCallback(
    async (values: LoginFormValues) => {
      try {
        trackMixpanelEvent(evt_login_with_email_click);

        // if (teamId) {
        //   localStorage.setItem(WORKLENZ_REDIRECT_PROJ_KEY, teamId);
        // }

        // Normalize email to lowercase for case-insensitive comparison
        const normalizedValues = {
          ...values,
          email: values.email.toLowerCase().trim(),
        };

        const result = await dispatch(login(normalizedValues)).unwrap();
        if (result.authenticated) {
          message.success(t('successMessage'));
          setSession(result.user);
          dispatch(setUser(result.user));
          navigate('/auth/authenticating');
        }
      } catch (error) {
        logger.error('Login failed', error);
        alertService.error(
          t('errorMessages.loginErrorTitle'),
          t('errorMessages.loginErrorMessage')
        );
      }
    },
    [dispatch, navigate, t, trackMixpanelEvent]
  );

  const handleGoogleLogin = useCallback(() => {
    try {
      trackMixpanelEvent(evt_login_with_google_click);
      window.location.href = `${import.meta.env.VITE_API_URL}/secure/google`;
    } catch (error) {
      logger.error('Google login failed', error);
    }
  }, [trackMixpanelEvent, t]);

  const handleRememberMeChange = useCallback(
    (checked: boolean) => {
      trackMixpanelEvent(evt_login_remember_me_click, { checked });
    },
    [trackMixpanelEvent]
  );

  const styles = {
    card: {
      width: '100%',
      boxShadow: 'none',
    },
    button: {
      borderRadius: 4,
    },
    googleButton: {
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    link: {
      fontSize: 14,
    },
    googleIcon: {
      maxWidth: 20,
      marginRight: 8,
    },
  };

  return (
    <Card
      style={styles.card}
      styles={{ body: { paddingInline: isMobile ? 24 : 48 } }}
      variant="outlined"
    >
      <PageHeader description={t('headerDescription')} />

      <Form
        form={form}
        name="login"
        layout="vertical"
        autoComplete="off"
        requiredMark="optional"
        initialValues={{ remember: true }}
        onFinish={onFinish}
        style={{ width: '100%' }}
      >
        <Form.Item name="email" rules={validationRules.email as Rule[]}>
          <Input
            prefix={<UserOutlined />}
            placeholder={t('emailPlaceholder')}
            size="large"
            style={styles.button}
          />
        </Form.Item>

        <Form.Item name="password" rules={validationRules.password}>
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('passwordPlaceholder')}
            size="large"
            style={styles.button}
          />
        </Form.Item>

        <Form.Item>
          <Flex justify="space-between" align="center">
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox onChange={e => handleRememberMeChange(e.target.checked)}>
                {t('rememberMe')}
              </Checkbox>
            </Form.Item>
            <Link
              to="/auth/forgot-password"
              className="ant-typography ant-typography-link blue-link"
              style={styles.link}
            >
              {t('forgotPasswordButton')}
            </Link>
          </Flex>
        </Form.Item>

        <Form.Item>
          <Flex vertical gap={8}>
            <Button
              block
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoading}
              style={styles.button}
            >
              {t('loginButton')}
            </Button>

            {enableGoogleLogin && (
              <>
                <Typography.Text style={{ textAlign: 'center' }}>{t('orText')}</Typography.Text>

                <Button
                  block
                  type="default"
                  size="large"
                  onClick={handleGoogleLogin}
                  style={styles.googleButton}
                >
                  <img src={googleIcon} alt="Google" style={styles.googleIcon} />
                  {t('signInWithGoogleButton')}
                </Button>
              </>
            )}
          </Flex>
        </Form.Item>

        <Form.Item>
          <Space>
            <Typography.Text style={styles.link}>{t('dontHaveAccountText')}</Typography.Text>
            <Link
              to="/auth/signup"
              className="ant-typography ant-typography-link blue-link"
              style={styles.link}
            >
              {t('signupButton')}
            </Link>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default LoginPage;
