import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Form, Input, Flex, Button, Typography, Divider, message } from '@/shared/antd-imports';
import { CheckCircleTwoTone, CloseCircleTwoTone } from '@/shared/antd-imports';
import { Rule } from 'antd/es/form';

import googleIcon from '@/assets/images/google-icon.png';
import appleIcon from '@/assets/images/apple-icon.svg';
import PageHeader from '@components/AuthPageHeader';

import { authApiService } from '@/api/auth/auth.api.service';
import { IUserSignUpRequest } from '@/types/auth/signup.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { signUp } from '@/features/auth/authSlice';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_signup_page_visit,
  evt_signup_with_email_click,
  evt_signup_with_google_click,
} from '@/shared/worklenz-analytics-events';

// Add Apple signup event (following existing pattern)
const evt_signup_with_apple_click = 'signup_with_apple_click';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import logger from '@/utils/errorLogger';
import alertService from '@/services/alerts/alertService';
import { WORKLENZ_REDIRECT_PROJ_KEY, AUTH_PRIMARY_BUTTON_COLOR } from '@/shared/constants';

// Define the global grecaptcha type
declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SignupPage = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { t } = useTranslation('auth/signup');

  useDocumentTitle('Signup');

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [urlParams, setUrlParams] = useState({
    email: '',
    name: '',
    teamId: '',
    teamMemberId: '',
    projectId: '',
  });
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordActive, setPasswordActive] = useState(false);

  const setProjectId = (projectId: string) => {
    if (!projectId) {
      localStorage.removeItem(WORKLENZ_REDIRECT_PROJ_KEY);
      return;
    }
    localStorage.setItem(WORKLENZ_REDIRECT_PROJ_KEY, projectId);
  };

  const getProjectId = () => {
    return localStorage.getItem(WORKLENZ_REDIRECT_PROJ_KEY);
  };

  const enableGoogleLogin = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true' || false;
  const enableAppleLogin = import.meta.env.VITE_ENABLE_APPLE_LOGIN === 'true' || false;
  const enableRecaptcha =
    import.meta.env.VITE_ENABLE_RECAPTCHA === 'true' &&
    import.meta.env.VITE_RECAPTCHA_SITE_KEY &&
    import.meta.env.VITE_RECAPTCHA_SITE_KEY !== 'recaptcha-site-key';

  useEffect(() => {
    trackMixpanelEvent(evt_signup_page_visit);
    const searchParams = new URLSearchParams(window.location.search);
    setUrlParams({
      email: searchParams.get('email') || '',
      name: searchParams.get('name') || '',
      teamId: searchParams.get('team') || '',
      teamMemberId: searchParams.get('user') || '',
      projectId: searchParams.get('project') || '',
    });

    setProjectId(searchParams.get('project') || '');

    form.setFieldsValue({
      email: searchParams.get('email') || '',
      name: searchParams.get('name') || '',
    });
  }, [trackMixpanelEvent]);

  useEffect(() => {
    // Only load recaptcha script if recaptcha is enabled and site key is valid
    if (enableRecaptcha && import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
      // Check if site key is not the placeholder value
      if (import.meta.env.VITE_RECAPTCHA_SITE_KEY === 'recaptcha-site-key') {
        console.warn(
          'Using placeholder reCAPTCHA site key. Please set a valid key in your environment variables.'
        );
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${import.meta.env.VITE_RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      return () => {
        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }

        const recaptchaElements = document.getElementsByClassName('grecaptcha-badge');
        while (recaptchaElements.length > 0) {
          const element = recaptchaElements[0];
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        }
      };
    }
  }, [enableRecaptcha]);

  const getInvitationQueryParams = () => {
    const params = [`team=${urlParams.teamId}`, `teamMember=${urlParams.teamMemberId}`];
    if (getProjectId()) {
      params.push(`project=${getProjectId()}`);
    }
    return urlParams.teamId && urlParams.teamMemberId ? `?${params.join('&')}` : '';
  };

  const getRecaptchaToken = async () => {
    if (!enableRecaptcha) return '';

    // Check if site key is valid
    if (
      !import.meta.env.VITE_RECAPTCHA_SITE_KEY ||
      import.meta.env.VITE_RECAPTCHA_SITE_KEY === 'recaptcha-site-key'
    ) {
      console.warn('Invalid reCAPTCHA site key. Skipping reCAPTCHA verification.');
      return 'skip-verification';
    }

    try {
      return new Promise<string>((resolve, reject) => {
        if (!window.grecaptcha) {
          reject('reCAPTCHA not loaded');
          return;
        }

        window.grecaptcha.ready(() => {
          window
            .grecaptcha!.execute(import.meta.env.VITE_RECAPTCHA_SITE_KEY, { action: 'signup' })
            .then((token: string) => {
              resolve(token);
            })
            .catch((error: any) => {
              console.error('reCAPTCHA execution error:', error);
              reject(error);
            });
        });
      });
    } catch (error) {
      console.error('Error getting reCAPTCHA token:', error);
      return '';
    }
  };

  const onFinish = async (values: IUserSignUpRequest) => {
    try {
      setValidating(true);

      if (enableRecaptcha) {
        try {
          const token = await getRecaptchaToken();

          if (!token) {
            logger.error('Failed to get reCAPTCHA token');
            alertService.error(
              t('reCAPTCHAVerificationError'),
              t('reCAPTCHAVerificationErrorMessage')
            );
            return;
          }

          // Skip verification if we're using the special token due to invalid site key
          if (token !== 'skip-verification') {
            const verifyToken = await authApiService.verifyRecaptchaToken(token);

            if (!verifyToken.done) {
              logger.error('Failed to verify reCAPTCHA token');
              return;
            }
          }
        } catch (error) {
          logger.error('reCAPTCHA error:', error);
          // Continue with sign up even if reCAPTCHA fails in development
          if (import.meta.env.DEV) {
            console.warn('Continuing signup despite reCAPTCHA error in development mode');
          } else {
            alertService.error(
              t('reCAPTCHAVerificationError'),
              t('reCAPTCHAVerificationErrorMessage')
            );
            return;
          }
        }
      }

      const body = {
        name: values.name,
        email: values.email.toLowerCase().trim(),
        password: values.password,
      };

      const res = await authApiService.signUpCheck(body);
      if (res.done) {
        await signUpWithEmail(body);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to validate signup details');
    } finally {
      setValidating(false);
    }
  };

  const signUpWithEmail = async (body: IUserSignUpRequest) => {
    try {
      setLoading(true);
      trackMixpanelEvent(evt_signup_with_email_click, {
        email: body.email,
        name: body.name,
      });
      if (urlParams.teamId) {
        body.team_id = urlParams.teamId;
      }
      if (urlParams.teamMemberId) {
        body.team_member_id = urlParams.teamMemberId;
      }
      if (urlParams.projectId) {
        body.project_id = urlParams.projectId;
      }
      const result = await dispatch(signUp(body)).unwrap();
      if (result?.authenticated) {
        message.success('Successfully signed up!');
        setTimeout(() => {
          navigate('/auth/authenticating');
        }, 1000);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignUpClick = () => {
    try {
      trackMixpanelEvent(evt_signup_with_google_click);
      const queryParams = getInvitationQueryParams();
      const url = `${import.meta.env.VITE_API_URL}/secure/google${queryParams ? `?${queryParams}` : ''}`;
      window.location.href = url;
    } catch (error) {
      message.error('Failed to redirect to Google sign up');
    }
  };

  const onAppleSignUpClick = () => {
    try {
      trackMixpanelEvent(evt_signup_with_apple_click);
      const queryParams = getInvitationQueryParams();
      const url = `${import.meta.env.VITE_API_URL}/secure/apple${queryParams ? `?${queryParams}` : ''}`;
      window.location.href = url;
    } catch (error) {
      message.error('Failed to redirect to Apple sign up');
    }
  };

  const formRules = {
    name: [
      {
        required: true,
        message: t('nameRequired'),
        whitespace: true,
      },
      {
        min: 4,
        message: t('nameMinCharacterRequired'),
      },
    ],
    email: [
      {
        required: true,
        type: 'email',
        message: t('emailRequired'),
      },
    ],
    password: [
      {
        required: true,
        message: t('passwordRequired'),
      },
      {
        min: 8,
        message: t('passwordMinCharacterRequired'),
      },
      {
        max: 32,
        message: t('passwordMaxCharacterRequired'),
      },
      {
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
        message: t('passwordPatternRequired'),
      },
    ],
  };

  const passwordChecklistItems = [
    {
      key: 'minLength',
      test: (v: string) => v.length >= 8,
      label: t('passwordChecklist.minLength'),
    },
    {
      key: 'uppercase',
      test: (v: string) => /[A-Z]/.test(v),
      label: t('passwordChecklist.uppercase'),
    },
    {
      key: 'lowercase',
      test: (v: string) => /[a-z]/.test(v),
      label: t('passwordChecklist.lowercase'),
    },
    {
      key: 'number',
      test: (v: string) => /\d/.test(v),
      label: t('passwordChecklist.number'),
    },
    {
      key: 'special',
      test: (v: string) => /[@$!%*?&#]/.test(v),
      label: t('passwordChecklist.special'),
    },
  ];

  return (
    <>
      <PageHeader title={t('headline')} description={t('headerDescription')} />

      {(enableGoogleLogin || enableAppleLogin) && (
        <>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', fontSize: 12, marginBottom: 10 }}
          >
            {t('signUpWithLabel')}
          </Typography.Text>
          <Flex gap={10} style={{ marginBottom: 24 }}>
            {enableGoogleLogin && (
              <Button
                size="large"
                onClick={onGoogleSignUpClick}
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
                onClick={onAppleSignUpClick}
                aria-label={t('signUpWithAppleAriaLabel')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <img src={appleIcon} alt="" style={{ width: 16, height: 16 }} />
                {t('signUpWithAppleButton')}
              </Button>
            )}
          </Flex>
          <Divider style={{ margin: '0 0 22px', fontSize: 12 }}>{t('orText')}</Divider>
        </>
      )}

      <Form
        form={form}
        name="signup"
        layout="vertical"
        autoComplete="off"
        requiredMark={false}
        onFinish={onFinish}
        style={{ width: '100%' }}
        initialValues={{
          email: urlParams.email,
          name: urlParams.name,
        }}
      >
        <Form.Item name="name" label={t('nameLabel')} rules={formRules.name}>
          <Input size="large" placeholder={t('namePlaceholder')} />
        </Form.Item>

        <Form.Item name="email" label={t('emailLabel')} rules={formRules.email as Rule[]}>
          <Input size="large" placeholder={t('emailPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="password"
          label={t('passwordLabel')}
          rules={formRules.password}
          validateTrigger={['onBlur', 'onSubmit']}
        >
          <div>
            <Input.Password
              size="large"
              placeholder={t('passwordPlaceholder')}
              value={passwordValue}
              onFocus={() => setPasswordActive(true)}
              onChange={e => {
                setPasswordValue(e.target.value);
                setPasswordActive(true);
              }}
              onBlur={() => {
                if (!passwordValue) setPasswordActive(false);
              }}
            />
            {passwordActive && (
              <div style={{ marginTop: 8, marginBottom: 4 }}>
                {passwordChecklistItems.map(item => {
                  const passed = item.test(passwordValue);
                  const color = passed
                    ? themeMode === 'dark'
                      ? '#52c41a'
                      : '#389e0d'
                    : themeMode === 'dark'
                      ? '#b0b3b8'
                      : '#bfbfbf';
                  return (
                    <Flex key={item.key} align="center" gap={8} style={{ color, fontSize: 13 }}>
                      {passed ? (
                        <CheckCircleTwoTone twoToneColor="#52c41a" />
                      ) : (
                        <CloseCircleTwoTone
                          twoToneColor={themeMode === 'dark' ? '#b0b3b8' : '#bfbfbf'}
                        />
                      )}
                      <span>{item.label}</span>
                    </Flex>
                  );
                })}
              </div>
            )}
          </div>
        </Form.Item>

        <Button
          block
          type="primary"
          htmlType="submit"
          size="large"
          loading={loading || validating}
          style={{ backgroundColor: AUTH_PRIMARY_BUTTON_COLOR, borderColor: AUTH_PRIMARY_BUTTON_COLOR }}
        >
          {t('signupButton')}
        </Button>

        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 11.5, textAlign: 'center', marginTop: 12, marginBottom: 0 }}
        >
          {t('bySigningUpText')}{' '}
          <a
            href="https://worklenz.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}
          >
            {t('termsOfUseLink')}
          </a>{' '}
          {t('andText')}{' '}
          <a
            href="https://worklenz.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}
          >
            {t('privacyPolicyLink')}
          </a>
          .
        </Typography.Paragraph>
      </Form>

      <Flex justify="center" gap={4} style={{ marginTop: 26, fontSize: 12.5 }}>
        <Typography.Text type="secondary">{t('alreadyHaveAccountText')}</Typography.Text>
        <Link to="/auth/login" className="blue-link" style={{ fontWeight: 600 }}>
          {t('loginButton')}
        </Link>
      </Flex>
    </>
  );
};

export default SignupPage;
