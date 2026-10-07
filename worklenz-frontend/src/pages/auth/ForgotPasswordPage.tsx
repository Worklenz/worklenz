import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Flex, Button, Result } from '@/shared/antd-imports';

import PageHeader from '@components/AuthPageHeader';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_forgot_password_page_visit,
  evt_reset_password_click,
} from '@/shared/worklenz-analytics-events';
import { resetPassword, verifyAuthentication } from '@features/auth/authSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSession } from '@/utils/session-helper';
import { setUser } from '@features/user/userSlice';
import logger from '@/utils/errorLogger';
import { AUTH_PRIMARY_BUTTON_COLOR } from '@/shared/constants';

const ForgotPasswordPage = () => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle('Forgot Password');
  const dispatch = useAppDispatch();

  // Localization
  const { t } = useTranslation('auth/forgot-password');

  useEffect(() => {
    trackMixpanelEvent(evt_forgot_password_page_visit);
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
    void verifyAuthStatus();
  }, [dispatch, navigate, trackMixpanelEvent]);

  const onFinish = useCallback(
    async (values: any) => {
      if (values.email.trim() === '') return;
      try {
        setIsLoading(true);
        // Normalize email to lowercase for case-insensitive comparison
        const normalizedEmail = values.email.toLowerCase().trim();
        const result = await dispatch(resetPassword(normalizedEmail)).unwrap();
        if (result.done) {
          trackMixpanelEvent(evt_reset_password_click);
          setIsSuccess(true);
        }
      } catch (error: any) {
        logger.error('Failed to reset password', error);
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch, trackMixpanelEvent]
  );

  if (isSuccess) {
    return (
      <Result
        status="success"
        title={t('successTitle', { defaultValue: 'Reset instruction sent!' })}
        subTitle={t('successMessage', { defaultValue: 'Reset information has been sent to your email. Please check your email.' })}
      />
    );
  }

  return (
    <>
      <PageHeader title={t('headline')} description={t('headerDescription')} />

      <Form
        name="forgot-password"
        form={form}
        layout="vertical"
        autoComplete="off"
        requiredMark={false}
        onFinish={onFinish}
        style={{ width: '100%' }}
      >
        <Form.Item
          name="email"
          label={t('emailLabel')}
          rules={[
            {
              required: true,
              type: 'email',
              message: t('emailRequired'),
            },
          ]}
        >
          <Input size="large" placeholder={t('emailPlaceholder')} />
        </Form.Item>

        <Button
          block
          type="primary"
          htmlType="submit"
          size="large"
          loading={isLoading}
          style={{ backgroundColor: AUTH_PRIMARY_BUTTON_COLOR, borderColor: AUTH_PRIMARY_BUTTON_COLOR }}
        >
          {t('resetPasswordButton')}
        </Button>
      </Form>

      <Flex justify="center" style={{ marginTop: 18 }}>
        <Link to="/auth/login" className="blue-link" style={{ fontSize: 12.5 }}>
          {t('returnToLoginButton')}
        </Link>
      </Flex>
    </>
  );
};

export default ForgotPasswordPage;
