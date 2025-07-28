import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Form, Card, Input, Flex, Button, Typography, Result } from 'antd/es';
import { LockOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from 'react-responsive';
import { CheckCircleTwoTone, CloseCircleTwoTone } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';

import PageHeader from '@components/AuthPageHeader';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useAppDispatch } from '@/hooks/useAppDispatch';

import { updatePassword } from '@/features/auth/authSlice';
import { evt_verify_reset_email_page_visit } from '@/shared/worklenz-analytics-events';

import logger from '@/utils/errorLogger';
import { IUpdatePasswordRequest } from '@/types/auth/verify-reset-email.types';

const VerifyResetEmailPage = () => {
  const [form] = Form.useForm();
  const { hash, user } = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [urlParams, setUrlParams] = useState({
    hash: hash || '',
    user: user || '',
  });

  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle('Verify Reset Email');
  const dispatch = useAppDispatch();

  const { t } = useTranslation('auth/verify-reset-email');

  const isMobile = useMediaQuery({ query: '(max-width: 576px)' });
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const passwordChecklistItems = [
    {
      key: 'minLength',
      test: (v: string) => v.length >= 8,
      label: t('passwordChecklist.minLength', { defaultValue: 'At least 8 characters' }),
    },
    {
      key: 'uppercase',
      test: (v: string) => /[A-Z]/.test(v),
      label: t('passwordChecklist.uppercase', { defaultValue: 'One uppercase letter' }),
    },
    {
      key: 'lowercase',
      test: (v: string) => /[a-z]/.test(v),
      label: t('passwordChecklist.lowercase', { defaultValue: 'One lowercase letter' }),
    },
    {
      key: 'number',
      test: (v: string) => /\d/.test(v),
      label: t('passwordChecklist.number', { defaultValue: 'One number' }),
    },
    {
      key: 'special',
      test: (v: string) => /[@$!%*?&#]/.test(v),
      label: t('passwordChecklist.special', { defaultValue: 'One special character' }),
    },
  ];

  useEffect(() => {
    trackMixpanelEvent(evt_verify_reset_email_page_visit);
    console.log(urlParams);
  }, [trackMixpanelEvent]);

  const onFinish = useCallback(
    async (values: any) => {
      if (values.newPassword.trim() === '' || values.confirmPassword.trim() === '') return;
      try {
        setIsLoading(true);
        const body: IUpdatePasswordRequest = {
          hash: urlParams.hash,
          user: urlParams.user,
          password: values.newPassword,
          confirmPassword: values.confirmPassword,
        };
        const result = await dispatch(updatePassword(body)).unwrap();
        if (result.done) {
          setIsSuccess(true);
          navigate('/auth/login');
        }
      } catch (error) {
        logger.error('Failed to reset password', error);
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch, t]
  );

  return (
    <Card
      style={{
        width: '100%',
        boxShadow: 'none',
      }}
      styles={{
        body: {
          paddingInline: isMobile ? 24 : 48,
        },
      }}
      variant="outlined"
    >
      {isSuccess ? (
        <Result status="success" title={t('successTitle')} subTitle={t('successMessage')} />
      ) : (
        <>
          <PageHeader description={t('description')} />
          <Form
            name="verify-reset-email"
            form={form}
            layout="vertical"
            autoComplete="off"
            requiredMark={true}
            onFinish={onFinish}
            style={{ width: '100%' }}
          >
            <Form.Item
              name="newPassword"
              required
              rules={[
                {
                  required: true,
                  message: t('passwordRequired'),
                },
              ]}
            >
              <div>
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('placeholder')}
                  size="large"
                  style={{ borderRadius: 4 }}
                  value={passwordValue}
                  onChange={e => {
                    setPasswordValue(e.target.value);
                    if (!passwordTouched) setPasswordTouched(true);
                  }}
                  onBlur={() => setPasswordTouched(true)}
                />
                <div style={{ marginTop: 8, marginBottom: 4 }}>
                  {passwordChecklistItems.map(item => {
                    const passed = item.test(passwordValue);
                    let color = passed
                      ? themeMode === 'dark'
                        ? '#52c41a'
                        : '#389e0d'
                      : themeMode === 'dark'
                        ? '#b0b3b8'
                        : '#bfbfbf';
                    return (
                      <Flex key={item.key} align="center" gap={8} style={{ color, fontSize: 13 }}>
                        {passed ? (
                          <CheckCircleTwoTone
                            twoToneColor={themeMode === 'dark' ? '#52c41a' : '#52c41a'}
                          />
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
              </div>
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              required
              dependencies={['newPassword']}
              rules={[
                {
                  required: true,
                  message: t('confirmPasswordRequired'),
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
            >
              <Input.Password
                onPaste={e => e.preventDefault()}
                prefix={<LockOutlined />}
                placeholder={t('confirmPasswordPlaceholder')}
                size="large"
                style={{ borderRadius: 4 }}
                value={form.getFieldValue('confirmPassword') || ''}
                onChange={e => form.setFieldsValue({ confirmPassword: e.target.value })}
              />
            </Form.Item>

            <Form.Item>
              <Flex vertical gap={8}>
                <Button
                  block
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={isLoading}
                  style={{ borderRadius: 4 }}
                >
                  {t('resetPasswordButton')}
                </Button>
                <Typography.Text style={{ textAlign: 'center' }}>{t('orText')}</Typography.Text>
                <Link to="/auth/forgot-password">
                  <Button
                    block
                    type="default"
                    size="large"
                    style={{
                      borderRadius: 4,
                    }}
                  >
                    {t('resendResetEmail')}
                  </Button>
                </Link>
              </Flex>
            </Form.Item>
          </Form>
        </>
      )}
    </Card>
  );
};

export default VerifyResetEmailPage;
