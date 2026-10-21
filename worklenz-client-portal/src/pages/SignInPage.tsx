import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Input,
  MailOutlined,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import AuthPageHeader from '@/components/AuthPageHeader';
import clientPortalAPI from '@/services/api';
import { setError, verifySignInCode } from '@/store/slices/authSlice';
import type { RootState } from '@/store';
import { clearReturnTo, peekReturnTo } from '@/utils/returnTo';

type Step = 'email' | 'code';

/** What went wrong with an emailed link, as opposed to a plain request failure. */
type LinkProblem = 'invalid' | 'unavailable' | null;

interface EmailFormValues {
  email: string;
}

const CODE_LENGTH = 6;

/** The server's error code and message, from an axios error. */
const readApiError = (error: unknown): { code: string | null; status: number | null; message: string | null } => {
  const response = (error as { response?: { status?: number; data?: { message?: string; body?: { code?: string } } } })
    ?.response;
  return {
    code: response?.data?.body?.code ?? null,
    status: response?.status ?? null,
    message: response?.data?.message ?? null,
  };
};

/**
 * Sign in with a one-time code. There are no passwords.
 *
 *   /auth/login     the person types the address the project team added and receives a code.
 *   /invite?token=  the emailed link carries the address: opening it sends the code straight away.
 *
 * Either way the code screen is the same: six digits, valid for ten minutes, usable once.
 */
const SignInPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const {
    token: { colorBgLayout },
  } = theme.useToken();
  const { isAuthenticated, error: authError } = useAppSelector((state: RootState) => state.auth);

  const inviteToken = searchParams.get('token');
  // Where to land after signing in (an emailed deep link). Read once: the value is cleared on success.
  const returnTo = useRef(peekReturnTo());
  const landingPath = (): string => {
    clearReturnTo();
    return returnTo.current ?? '/dashboard';
  };

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(Boolean(inviteToken));
  const [requestError, setRequestError] = useState<string | null>(null);
  const [linkProblem, setLinkProblem] = useState<LinkProblem>(null);
  const [cooldown, setCooldown] = useState(0);
  const [verifying, setVerifying] = useState(false);
  // Changing the key empties the code boxes after a wrong code.
  const [codeBoxKey, setCodeBoxKey] = useState(0);
  const [form] = Form.useForm<EmailFormValues>();

  // Opening the link twice (StrictMode, or an email scanner followed by the person) must not race.
  const linkRequestedFor = useRef<string | null>(null);
  // The address a link is for cannot be changed, so "use a different address" only exists without one.
  const addressIsFixed = Boolean(inviteToken) && linkProblem === null;

  useEffect(() => {
    if (isAuthenticated) {
      clearReturnTo();
      navigate(returnTo.current ?? '/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => {
      dispatch(setError(null));
    };
  }, [dispatch]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const requestCode = useCallback(
    async (input: { email?: string; inviteToken?: string }, { announce }: { announce: boolean }) => {
      setRequesting(true);
      setRequestError(null);
      dispatch(setError(null));
      try {
        const response = await clientPortalAPI.requestSignInCode(input);
        const body = response.body;
        setEmail(body.email);
        setMaskedEmail(body.maskedEmail);
        setOrganizationName(body.organizationName);
        setCooldown(body.resendAfterSeconds);
        setLinkProblem(null);
        setStep('code');
        if (announce) message.success(t('signIn.resent', { defaultValue: 'A new code is on its way.' }));
      } catch (error) {
        const { code, status, message: serverMessage } = readApiError(error);
        if (code === 'LINK_INVALID') {
          setLinkProblem('invalid');
          setStep('email');
        } else if (code === 'ACCESS_UNAVAILABLE') {
          setLinkProblem('unavailable');
          setStep('email');
        } else if (status === 429) {
          setRequestError(
            t('signIn.tooManyRequests', { defaultValue: 'Too many attempts. Please wait a few minutes and try again.' })
          );
        } else {
          setRequestError(
            serverMessage ?? t('signIn.requestFailed', { defaultValue: 'We could not send a code. Please try again in a moment.' })
          );
        }
      } finally {
        setRequesting(false);
      }
    },
    [dispatch, t]
  );

  // An emailed link names the address, so the code goes out as soon as the page opens.
  useEffect(() => {
    if (!inviteToken || linkRequestedFor.current === inviteToken) return;
    linkRequestedFor.current = inviteToken;
    void requestCode({ inviteToken }, { announce: false });
  }, [inviteToken, requestCode]);

  const handleEmailSubmit = (values: EmailFormValues) =>
    requestCode({ email: values.email.trim() }, { announce: false });

  const handleResend = () => {
    if (cooldown > 0 || requesting) return;
    void requestCode(addressIsFixed && inviteToken ? { inviteToken } : { email }, { announce: true });
  };

  const handleVerify = useCallback(
    async (code: string) => {
      if (code.length !== CODE_LENGTH || verifying) return;
      setVerifying(true);
      try {
        const result = await dispatch(verifySignInCode({ email, code }));
        if (verifySignInCode.fulfilled.match(result)) {
          message.success(t('signIn.success', { defaultValue: 'Signed in. Redirecting...' }));
          navigate(landingPath(), { replace: true });
        } else {
          setCodeBoxKey(key => key + 1);
        }
      } finally {
        setVerifying(false);
      }
    },
    [dispatch, email, navigate, t, verifying]
  );

  const chooseAnotherEmail = () => {
    setStep('email');
    setEmail('');
    setRequestError(null);
    dispatch(setError(null));
    form.resetFields();
  };

  const shownError = requestError ?? authError;

  const renderLoading = () => (
    <Flex vertical align="center" gap={12} style={{ padding: '24px 0' }} role="status" aria-live="polite">
      <Typography.Text type="secondary">{t('signIn.preparing', { defaultValue: 'Preparing your sign-in...' })}</Typography.Text>
    </Flex>
  );

  const renderEmailStep = () => (
    <>
      {linkProblem === 'invalid' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          message={t('signIn.linkInvalidTitle', { defaultValue: 'This link is no longer valid' })}
          description={t('signIn.linkInvalidDescription', {
            defaultValue:
              'It has expired or a newer link replaced it. Enter your email address below and we will send you a code instead.',
          })}
        />
      )}
      {linkProblem === 'unavailable' && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
          message={t('signIn.linkUnavailable', {
            defaultValue: 'Your access is not available right now. Please contact your project team.',
          })}
        />
      )}

      <Form
        form={form}
        name="sign-in-email"
        layout="vertical"
        autoComplete="on"
        requiredMark={false}
        onFinish={handleEmailSubmit}
      >
        <Form.Item
          name="email"
          label={t('signIn.emailLabel', { defaultValue: 'Email address' })}
          rules={[
            { required: true, message: t('signIn.emailRequired', { defaultValue: 'Please enter your email address' }) },
            { type: 'email', message: t('signIn.emailInvalid', { defaultValue: 'Please enter a valid email address' }) },
          ]}
        >
          <Input
            type="email"
            size="large"
            prefix={<MailOutlined />}
            autoFocus
            autoComplete="email"
            placeholder={t('signIn.emailPlaceholder', { defaultValue: 'you@company.com' })}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button block type="primary" size="large" htmlType="submit" loading={requesting}>
            {t('signIn.sendCode', { defaultValue: 'Send me a code' })}
          </Button>
        </Form.Item>

        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 0 }}>
          {t('signIn.accessNote', {
            defaultValue:
              'You can sign in with the email address your project team added. If you are not sure it was added, ask them.',
          })}
        </Typography.Paragraph>
      </Form>
    </>
  );

  const renderCodeStep = () => (
    <Flex vertical gap={16}>
      <Typography.Paragraph style={{ textAlign: 'center', marginBottom: 0 }}>
        {organizationName
          ? t('signIn.codeDescriptionOrganization', {
              email: maskedEmail,
              organization: organizationName,
              defaultValue:
                'We sent a 6-digit code to {{email}} to open your {{organization}} portal. It works once and expires in 10 minutes.',
            })
          : t('signIn.codeDescription', {
              email: maskedEmail,
              defaultValue: 'We sent a 6-digit code to {{email}}. It works once and expires in 10 minutes.',
            })}
      </Typography.Paragraph>

      <Flex vertical align="center" gap={8}>
        <Typography.Text strong>
          {t('signIn.codeLabel', { defaultValue: 'Sign-in code' })}
        </Typography.Text>
        <Input.OTP
          key={codeBoxKey}
          length={CODE_LENGTH}
          size="large"
          autoFocus
          disabled={verifying}
          formatter={value => value.replace(/\D/g, '')}
          onChange={value => {
            if (value.length === CODE_LENGTH) void handleVerify(value);
          }}
        />
      </Flex>

      {verifying && (
        <Typography.Text type="secondary" style={{ textAlign: 'center' }} role="status">
          {t('signIn.verifying', { defaultValue: 'Signing in...' })}
        </Typography.Text>
      )}

      <Flex vertical align="center" gap={4}>
        <Button type="link" onClick={handleResend} disabled={cooldown > 0 || requesting} loading={requesting}>
          {cooldown > 0
            ? t('signIn.resendIn', { seconds: cooldown, defaultValue: 'Send a new code in {{seconds}}s' })
            : t('signIn.resend', { defaultValue: 'Send a new code' })}
        </Button>
        {!addressIsFixed && (
          <Button type="link" onClick={chooseAnotherEmail}>
            {t('signIn.useAnotherEmail', { defaultValue: 'Use a different email address' })}
          </Button>
        )}
      </Flex>
    </Flex>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colorBgLayout,
        padding: 24,
      }}
    >
      <Card style={{ width: 420, maxWidth: '100%' }} styles={{ body: { padding: 32 } }}>
        <AuthPageHeader
          description={
            step === 'code'
              ? t('signIn.codeTitle', { defaultValue: 'Check your email' })
              : t('signIn.description', {
                  defaultValue: 'Enter your email address and we will send you a one-time code. There is no password.',
                })
          }
        />

        {returnTo.current && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            message={t('signIn.returnToBanner', { defaultValue: 'Sign in to open the item from your email.' })}
          />
        )}

        {shownError && (
          <Alert
            type="error"
            showIcon
            closable
            style={{ marginBottom: 24 }}
            message={shownError}
            onClose={() => {
              setRequestError(null);
              dispatch(setError(null));
            }}
          />
        )}

        {requesting && step === 'email' && inviteToken && linkProblem === null
          ? renderLoading()
          : step === 'code'
            ? renderCodeStep()
            : renderEmailStep()}
      </Card>
    </div>
  );
};

export default SignInPage;
