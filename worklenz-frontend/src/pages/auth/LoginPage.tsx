import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Card,
  Input,
  Flex,
  Checkbox,
  Button,
  Typography,
  Space,
  Form,
  message,
} from '@/shared/antd-imports';
import { Rule } from 'antd/es/form';

import { LockOutlined, UserOutlined } from '@/shared/antd-imports';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from 'react-responsive';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import PageHeader from '@components/AuthPageHeader';
import googleIcon from '@assets/images/google-icon.png';
import appleIcon from '@assets/images/apple-icon.svg';
import { login, verifyAuthentication } from '@/features/auth/authSlice';
import { setActiveTeam } from '@/features/teams/teamSlice';
import logger from '@/utils/errorLogger';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import {
  evt_login_page_visit,
  evt_login_with_email_click,
  evt_login_with_google_click,
  evt_login_remember_me_click,
  evt_login_page_login,
} from '@/shared/worklenz-analytics-events';

// Add Apple login event (following existing pattern)
const evt_login_with_apple_click = 'login_with_apple_click';
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
    userId: '',
    projectId: '',
  });

  const enableGoogleLogin = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true' || false;
  const enableAppleLogin = import.meta.env.VITE_ENABLE_APPLE_LOGIN === 'true' || false;

  // Use ref to prevent multiple executions of auth check
  const hasCheckedAuth = useRef(false);

  useDocumentTitle('Login');

  // Extract invitation parameters and verify auth status
  useEffect(() => {
    // Prevent multiple executions
    if (hasCheckedAuth.current) {
      return;
    }
    hasCheckedAuth.current = true;

    // First, extract invitation parameters from URL
    const searchParams = new URLSearchParams(window.location.search);
    const teamId = searchParams.get('team') || '';
    const userId = searchParams.get('user') || '';
    const projectId = searchParams.get('project') || '';

    if (teamId || userId || projectId) {
      setUrlParams({ teamId, userId, projectId });

      // Store project ID for redirect after login
      if (projectId) {
        localStorage.setItem(WORKLENZ_REDIRECT_PROJ_KEY, projectId);
      }
    }

    // Then, check and unregister ngsw-worker if present
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

    // Verify auth status with the extracted params
    const checkAuth = async () => {
      try {
        const session = await dispatch(verifyAuthentication()).unwrap();

        if (session?.authenticated) {
          setSession(session.user);
          dispatch(setUser(session.user));

          // Check if user came from invitation link
          if (teamId) {
            // For already logged-in users, try to switch to the invited team
            try {
              // Step 1: Set the invited team as active
              await dispatch(setActiveTeam(teamId)).unwrap();

              // Step 2: Verify authentication again to ensure session is updated with new team
              const updatedSession = await dispatch(verifyAuthentication()).unwrap();

              if (updatedSession?.authenticated) {
                // Step 3: Redirect based on whether there's a project ID
                if (projectId) {
                  // Redirect to the specific project
                  window.location.href = `/worklenz/projects/${projectId}`;
                } else {
                  // Team-only invitation, redirect to home with the new active team
                  window.location.href = '/worklenz/home';
                }
              } else {
                // Session verification failed after team switch
                message.error('Failed to update session. Please try again.');
                window.location.href = '/worklenz/home';
              }
            } catch (error) {
              // Could not switch team - user is not a team member yet
              // Redirect to home with message to accept invitation
              message.info('Please check your notifications to accept the team invitation.');

              setTimeout(() => {
                window.location.href = '/worklenz/home';
              }, 2000);
            }
          } else {
            // No invitation params, redirect to home
            window.location.href = '/worklenz/home';
          }
        }
      } catch (error) {
        // Authentication failed or session expired
        // User is not logged in, so just stay on login page
        // They can log in with the invitation parameters
        logger.error('Failed to verify authentication status', error);
      }
    };

    void checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

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

  const onFinish = useCallback(
    async (values: LoginFormValues) => {
      try {
        trackMixpanelEvent(evt_login_page_login);
        trackMixpanelEvent(evt_login_with_email_click);

        // Store project ID for redirect after login if present
        if (urlParams.projectId) {
          localStorage.setItem(WORKLENZ_REDIRECT_PROJ_KEY, urlParams.projectId);
        }

        // Normalize email to lowercase for case-insensitive comparison
        const normalizedValues = {
          ...values,
          email: values.email.toLowerCase().trim(),
          // Include invitation parameters in login request
          team_id: urlParams.teamId || undefined,
          team_member_id: urlParams.userId || undefined,
          project_id: urlParams.projectId || undefined,
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
    [dispatch, navigate, t, trackMixpanelEvent, urlParams]
  );

  const handleGoogleLogin = useCallback(() => {
    try {
      trackMixpanelEvent(evt_login_page_login);
      trackMixpanelEvent(evt_login_with_google_click);

      // Include invitation parameters in Google OAuth redirect
      const params = new URLSearchParams();
      if (urlParams.teamId) params.append('team', urlParams.teamId);
      if (urlParams.userId) params.append('teamMember', urlParams.userId);
      if (urlParams.projectId) params.append('project', urlParams.projectId);

      const queryString = params.toString();
      const url = `${import.meta.env.VITE_API_URL}/secure/google${queryString ? `?${queryString}` : ''}`;
      window.location.href = url;
    } catch (error) {
      logger.error('Google login failed', error);
    }
  }, [trackMixpanelEvent, urlParams]);

  const handleAppleLogin = useCallback(() => {
    try {
      trackMixpanelEvent(evt_login_page_login);
      trackMixpanelEvent(evt_login_with_apple_click);

      // Include invitation parameters in Apple OAuth redirect
      const params = new URLSearchParams();
      if (urlParams.teamId) params.append('team', urlParams.teamId);
      if (urlParams.userId) params.append('teamMember', urlParams.userId);
      if (urlParams.projectId) params.append('project', urlParams.projectId);

      const queryString = params.toString();
      const url = `${import.meta.env.VITE_API_URL}/secure/apple${queryString ? `?${queryString}` : ''}`;
      window.location.href = url;
    } catch (error) {
      logger.error('Apple login failed', error);
    }
  }, [trackMixpanelEvent, urlParams]);

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

            {(enableGoogleLogin || enableAppleLogin) && (
              <>
                <Typography.Text style={{ textAlign: 'center' }}>{t('orText')}</Typography.Text>

                {enableGoogleLogin && (
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
                )}

                {enableAppleLogin && (
                  <Button
                    block
                    type="default"
                    size="large"
                    onClick={handleAppleLogin}
                    style={styles.googleButton}
                  >
                    <img src={appleIcon} alt="Apple" style={styles.googleIcon} />
                    {t('signInWithAppleButton', { defaultValue: 'Sign in with Apple' })}
                  </Button>
                )}
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
