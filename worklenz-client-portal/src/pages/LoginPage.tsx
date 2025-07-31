import React, { useCallback, useEffect } from 'react';
import { Card, Input, Flex, Checkbox, Button, Typography, Form, message, Alert } from '@/shared/antd-imports';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import AuthPageHeader from '@/components/AuthPageHeader';
import { loginUser, setError } from '@/store/slices/authSlice';
import type { RootState } from '@/store';

interface LoginFormValues {
  email: string;
  password: string;
  remember?: boolean;
}

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isLoading, error, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  const [form] = Form.useForm<LoginFormValues>();

  const validationRules = {
    email: [
      { required: true, message: t('login.email') },
      { type: 'email' as const, message: t('login.email') },
    ],
    password: [
      { required: true, message: t('login.password') },
      { min: 8, message: t('login.password') },
    ],
  };

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, isAuthenticated]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      dispatch(setError(null));
    };
  }, [dispatch]);

  const onFinish = useCallback(
    async (values: LoginFormValues) => {
      try {
        const result = await dispatch(loginUser({
          email: values.email,
          password: values.password
        }));
        
        if (loginUser.fulfilled.match(result)) {
          message.success(t('login.success'));
          navigate('/dashboard', { replace: true });
        } else {
          // Error is already set in the slice
          const errorMessage = result.payload as string || t('login.failed');
          message.error(errorMessage);
        }
      } catch (error) {
        console.error('Login failed', error);
        message.error(t('login.failed'));
      }
    },
    [dispatch, navigate, t]
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

  return (
    <div style={{ 
      minHeight: '100vh', 
      width: '100%',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f0f2f5',
      flexDirection: 'column',
      margin: 0,
      padding: 0
    }}>
      <Card
        style={styles.card}
        styles={{ body: { padding: 32 } }}
        variant="outlined"
      >
        <AuthPageHeader description={t('login.description')} />

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
          name="login"
          layout="vertical"
          autoComplete="off"
          requiredMark="optional"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          style={{ width: '100%' }}
        >
          <Form.Item name="email" rules={validationRules.email}>
            <Input
              prefix={<UserOutlined />}
              placeholder={t('login.email')}
              size="large"
              style={styles.button}
            />
          </Form.Item>

          <Form.Item name="password" rules={validationRules.password}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('login.password')}
              size="large"
              style={styles.button}
            />
          </Form.Item>

          <Form.Item>
            <Flex justify="space-between" align="center">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>
                  {t('login.remember')}
                </Checkbox>
              </Form.Item>
              <Link
                to="/forgot-password"
                className="ant-typography ant-typography-link blue-link"
                style={styles.link}
              >
                {t('login.forgot')}
              </Link>
            </Flex>
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
              {t('login.signin')}
            </Button>
          </Form.Item>

          <Form.Item>
            <Typography.Text style={{ ...styles.link, textAlign: 'center', display: 'block' }}>
              {t('login.invite_only')}
            </Typography.Text>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage; 