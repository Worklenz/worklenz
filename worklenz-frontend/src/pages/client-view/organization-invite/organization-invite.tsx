import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Spin, Result, Button, Typography, Space } from '@/shared/antd-imports';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useHandleOrganizationInviteMutation } from '@/api/client-portal/client-portal-api';

const { Title, Paragraph } = Typography;

const OrganizationInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [handleInvite, { isLoading }] = useHandleOrganizationInviteMutation();

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    handleOrganizationInvite();
  }, [token]);

  const handleOrganizationInvite = async () => {
    try {
      const response = await handleInvite({ token: token! }).unwrap();

      // If user is already authenticated and linked, redirect to client portal
      if (response.redirectTo === 'client-portal') {
        setStatus('success');
        setTimeout(() => {
          navigate('/client-portal/dashboard');
        }, 2000);
      } else {
        // User needs to authenticate/register
        setStatus('success');
        setTimeout(() => {
          navigate('/auth/login', {
            state: {
              organizationInviteToken: token,
              message: 'Please login or create an account to accept the invitation.',
            },
          });
        }, 2000);
      }
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error?.data?.message || 'Failed to process invitation');
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <Result
            icon={<Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />}
            title="Processing Invitation"
            subTitle="Please wait while we verify your invitation..."
          />
        );

      case 'success':
        return (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 48 }} />}
            title="Invitation Accepted!"
            subTitle="Redirecting you to the portal..."
          />
        );

      case 'error':
        return (
          <Result
            status="error"
            title="Invitation Error"
            subTitle={errorMessage}
            extra={[
              <Button key="home" onClick={() => navigate('/')}>
                Go to Home
              </Button>,
              <Button key="login" type="primary" onClick={() => navigate('/auth/login')}>
                Go to Login
              </Button>,
            ]}
          />
        );

      case 'invalid':
        return (
          <Result
            status="warning"
            title="Invalid Invitation"
            subTitle="No invitation token was provided. Please check your invitation link."
            extra={
              <Button type="primary" onClick={() => navigate('/auth/login')}>
                Go to Login
              </Button>
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        padding: '20px',
      }}
    >
      <Card
        style={{
          maxWidth: 600,
          width: '100%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        {renderContent()}
      </Card>
    </div>
  );
};

export default OrganizationInvitePage;
