import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Flex, Result, Spin } from 'antd';
import { MailOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { usePortal } from './portal-context';
import { portalApi } from './portal-api';

const PPM_BLUE = '#0061FF';
const { Title, Text } = Typography;

const PortalLoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login, loading: sessionLoading } = usePortal();

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && user) {
      navigate('/portal/deliverables', { replace: true });
    }
  }, [user, sessionLoading, navigate]);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !validating) {
      setValidating(true);
      setError(null);
      login(token).then((success) => {
        if (success) {
          navigate('/portal/deliverables', { replace: true });
        } else {
          setError('This magic link is invalid or has expired. Please request a new one.');
          setValidating(false);
        }
      });
    }
  }, [searchParams, login, navigate, validating]);

  const handleSubmit = async (values: { email: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await portalApi.requestMagicLink(values.email);
      if (res.done) {
        setSent(true);
      } else {
        setError(res.message || 'Failed to send magic link');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Card style={{ width: 400, textAlign: 'center', borderRadius: 12 }}>
          <Flex vertical align="center" gap={16} style={{ padding: '24px 0' }}>
            <Spin size="large" />
            <Text type="secondary">Signing you in...</Text>
          </Flex>
        </Card>
      </Flex>
    );
  }

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh', padding: 16 }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 12,
        }}
      >
        {sent ? (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Check your email"
            subTitle="We've sent a sign-in link to your email. Click it to access your project portal."
            extra={
              <Button type="link" onClick={() => { setSent(false); form.resetFields(); }}>
                Use a different email
              </Button>
            }
          />
        ) : (
          <>
            <Flex vertical align="center" gap={8} style={{ marginBottom: 32 }}>
              <svg width={24} height={36} viewBox="0 0 13 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.83268 0H0V19.648L4.47421 12.5322H9.83268C11.4847 12.5322 12.8226 11.1943 12.8226 9.54237V2.98983C12.8226 1.33786 11.4847 0 9.83268 0Z" fill={PPM_BLUE} />
              </svg>
              <Title level={3} style={{ margin: 0 }}>Client Portal</Title>
              <Text type="secondary">Sign in to view your deliverables</Text>
            </Flex>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="you@company.com"
                  size="large"
                  autoFocus
                />
              </Form.Item>

              {error && (
                <div style={{ marginBottom: 16 }}>
                  <Text type="danger">{error}</Text>
                </div>
              )}

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={submitting}
                >
                  Send magic link
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Card>
    </Flex>
  );
};

export default PortalLoginPage;
