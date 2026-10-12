import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Input, Flex, Button, Typography, Form, Divider, message } from '@/shared/antd-imports';
import { Rule } from 'antd/es/form';

import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
  evt_login_page_login,
} from '@/shared/worklenz-analytics-events';

// Add Apple login event (following existing pattern)
const evt_login_with_apple_click = 'login_with_apple_click';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import alertService from '@/services/alerts/alertService';
import { WORKLENZ_REDIRECT_PROJ_KEY, AUTH_PRIMARY_BUTTON_COLOR } from '@/shared/constants';
import { validateEmail } from '@/utils/validateEmail';
import { getDefaultAuthenticatedPath } from '@/utils/guest-session';

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('auth/login');
  const dispatch = useAppDispatch();
  const { isLoading } = useAppSelector(state => state.auth);
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [form] = Form.useForm<LoginFormValues>();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [urlParams, setUrlParams] = useState({
    teamId: '',
    userId: '',
    projectId: '',
  });

  const enableGoogleLogin = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true' || false;
  const enableAppleLogin = import.meta.env.VITE_ENABLE_APPLE_LOGIN === 'true' || false;

  const emailValue = Form.useWatch('email', form);
  const passwordValue = Form.useWatch('password', form);
  const isEmailValid = validateEmail((emailValue ?? '').trim());
  const isPasswordValid = !!passwordValue && passwordValue.length >= 8;

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
                  // Team-only invitation — guests land on Projects, others on Home
                  window.location.href = getDefaultAuthenticatedPath(updatedSession.user);
                }
              } else {
                // Session verification failed after team switch
                message.error('Failed to update session. Please try again.');
                window.location.href = getDefaultAuthenticatedPath(session.user);
              }
            } catch (error) {
              // Could not switch team - user is not a team member yet
              // Redirect to home with message to accept invitation
              message.info('Please check your notifications to accept the team invitation.');

              setTimeout(() => {
                window.location.href = getDefaultAuthenticatedPath(session.user);
              }, 2000);
            }
          } else {
            // No invitation params — guests land on Projects, others on Home
            window.location.href = getDefaultAuthenticatedPath(session.user);
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

        // Normalize email to lowercase for case-insensitive comparison.
        // The email field is unmounted once we're on the password step, so
        // `values.email` is not registered with the form anymore - use the
        // confirmed email captured when the user advanced past that step.
        const normalizedValues = {
          ...values,
          email: confirmedEmail.toLowerCase().trim(),
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
    [dispatch, navigate, t, trackMixpanelEvent, urlParams, confirmedEmail]
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

  const goNext = useCallback(async () => {
    try {
      await form.validateFields(['email']);
      setConfirmedEmail(form.getFieldValue('email'));
      setStep('password');
    } catch {
      // validation errors are rendered inline by the form
    }
  }, [form]);

  const changeEmail = useCallback(() => {
    setStep('email');
  }, []);

  return (
    <>
      <PageHeader title={t('headline')} description={t('headerDescription')} />

      {(enableGoogleLogin || enableAppleLogin) && (
        <>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', fontSize: 12, marginBottom: 10 }}
          >
            {t('signInWithLabel')}
          </Typography.Text>
          <Flex gap={10} style={{ marginBottom: 24 }}>
            {enableGoogleLogin && (
              <Button
                size="large"
                onClick={handleGoogleLogin}
                aria-label={t('signInWithGoogleAriaLabel')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <img src={googleIcon} alt="" style={{ width: 18, height: 18 }} />
                {t('signInWithGoogleButton')}
              </Button>
            )}
            {enableAppleLogin && (
              <Button
                size="large"
                onClick={handleAppleLogin}
                aria-label={t('signInWithAppleAriaLabel')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <img src={appleIcon} alt="" style={{ width: 16, height: 16 }} />
                {t('signInWithAppleButton')}
              </Button>
            )}
          </Flex>
          <Divider style={{ margin: '0 0 22px', fontSize: 12 }}>{t('orText')}</Divider>
        </>
      )}

      <Form
        form={form}
        name="login"
        layout="vertical"
        autoComplete="off"
        requiredMark={false}
        onFinish={onFinish}
        style={{ width: '100%' }}
      >
        {step === 'email' ? (
          <>
            <Form.Item name="email" label={t('emailLabel')} rules={validationRules.email as Rule[]}>
              <Input
                size="large"
                placeholder={t('emailPlaceholder')}
                autoFocus
                onPressEnter={e => {
                  e.preventDefault();
                  void goNext();
                }}
              />
            </Form.Item>
            <Button
              block
              type="primary"
              size="large"
              disabled={!isEmailValid}
              onClick={goNext}
              style={
                isEmailValid
                  ? { backgroundColor: AUTH_PRIMARY_BUTTON_COLOR, borderColor: AUTH_PRIMARY_BUTTON_COLOR }
                  : undefined
              }
            >
              {t('nextButton')}
            </Button>
          </>
        ) : (
          <>
            <Flex justify="space-between" align="center" style={{ marginBottom: 14 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                {confirmedEmail}
              </Typography.Text>
              <Typography.Link onClick={changeEmail} style={{ fontSize: 12.5, fontWeight: 600 }}>
                {t('changeEmailLink')}
              </Typography.Link>
            </Flex>

            <Form.Item name="password" label={t('passwordLabel')} rules={validationRules.password as Rule[]}>
              <Input.Password size="large" placeholder={t('passwordPlaceholder')} autoFocus />
            </Form.Item>

            <div style={{ textAlign: 'right', marginTop: -10, marginBottom: 14 }}>
              <Link to="/auth/forgot-password" className="blue-link" style={{ fontSize: 12 }}>
                {t('forgotPasswordButton')}
              </Link>
            </div>

            <Button
              block
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoading}
              disabled={!isPasswordValid}
              style={
                isPasswordValid
                  ? { backgroundColor: AUTH_PRIMARY_BUTTON_COLOR, borderColor: AUTH_PRIMARY_BUTTON_COLOR }
                  : undefined
              }
            >
              {t('loginButton')}
            </Button>

            <Typography.Paragraph
              type="secondary"
              style={{ fontSize: 11.5, textAlign: 'center', marginTop: 12, marginBottom: 0 }}
            >
              {t('bySigningInText')}{' '}
              <a
                href="https://worklenz.com/terms/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, textDecoration: 'underline' }}
              >
                {t('termsOfServiceLink')}
              </a>{' '}
              {t('andText')}{' '}
              <a
                href="https://worklenz.com/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, textDecoration: 'underline' }}
              >
                {t('privacyPolicyLink')}
              </a>
              .
            </Typography.Paragraph>
          </>
        )}
      </Form>

      <Flex justify="center" gap={4} style={{ marginTop: 26, fontSize: 12.5 }}>
        <Typography.Text type="secondary">{t('dontHaveAccountText')}</Typography.Text>
        <Link to="/auth/signup" className="blue-link" style={{ fontWeight: 600 }}>
          {t('signupButton')}
        </Link>
      </Flex>
    </>
  );
};

export default LoginPage;
