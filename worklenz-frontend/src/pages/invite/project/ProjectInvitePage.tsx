import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Spin, Result, Button, Typography, Form, Input, message, Tag } from '@/shared/antd-imports';
import { CheckCircleOutlined, LoadingOutlined, ProjectOutlined } from '@ant-design/icons';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { invitationRedirectService } from '@/services/invitation-redirect.service';

const { Title, Paragraph } = Typography;

interface FormValues {
  name: string;
  email: string;
}

const ProjectInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const authService = useAuthService();
  const currentUser = authService.getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error' | 'invalid'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    // Store invitation context immediately before any API calls
    // This ensures we preserve the context even if 401 redirect happens
    const currentPath = window.location.pathname;
    invitationRedirectService.storePendingInvitation(token, 'project', currentPath);
    console.log('[ProjectInvite] Stored invitation context on mount');

    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    try {
      const response = await projectMembersApiService.validateInvitationLink(token!);
      
      if (response.done) {
        setProjectInfo(response.body);
        
        // If user is already logged in, pre-fill the form
        if (currentUser) {
          form.setFieldsValue({
            name: currentUser.name || '',
            email: currentUser.email || ''
          });
        }
        
        setStatus('form');
      } else {
        setStatus('error');
        setErrorMessage(response.message || 'Invalid invitation link');
      }
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error?.response?.data?.message || 'Failed to validate invitation');
    }
  };

  const handleSubmit = async (values: FormValues) => {
    if (!token) return;

    try {
      setSubmitting(true);
      const response = await projectMembersApiService.acceptInvitationByLink(token, values);
      
      if (response.done) {
        setStatus('success');
        message.success('Successfully joined the project!');
        
        // Clear the stored invitation context since we successfully joined
        invitationRedirectService.clearPendingInvitation();
        console.log('[ProjectInvite] Cleared invitation context after successful join');
        
        // Redirect to login or project after a delay
        setTimeout(() => {
          if (currentUser) {
            navigate(`/worklenz/projects/${projectInfo?.project?.id}`);
          } else {
            navigate('/auth/login', {
              state: {
                message: 'Please login to access your new project.',
                email: values.email
              }
            });
          }
        }, 2000);
      } else {
        message.error(response.message || 'Failed to join project');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to join project');
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <Result
            icon={<Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />}
            title="Validating Invitation"
            subTitle="Please wait while we verify your invitation..."
          />
        );

      case 'form':
        return (
          <div style={{ textAlign: 'center' }}>
            <ProjectOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
            <Title level={3}>Join Project</Title>
            <div style={{ marginBottom: 24 }}>
              <Paragraph type="secondary">
                You've been invited to join the project
              </Paragraph>
              <div style={{ margin: '16px 0' }}>
                <Tag 
                  color={projectInfo?.project?.color_code || '#1890ff'} 
                  style={{ 
                    fontSize: '16px', 
                    padding: '8px 16px', 
                    borderRadius: '20px',
                    fontWeight: 'bold'
                  }}
                >
                  {projectInfo?.project?.name}
                </Tag>
              </div>
              <Paragraph type="secondary">
                in <strong>{projectInfo?.project?.team_name}</strong> by {projectInfo?.project?.owner_name}
              </Paragraph>
              <Paragraph type="secondary" style={{ fontSize: '12px' }}>
                Access Level: <strong>{projectInfo?.invitation?.access_level}</strong>
              </Paragraph>
            </div>
            
            {currentUser && (
              <div style={{ 
                marginBottom: 16, 
                padding: '8px 12px', 
                backgroundColor: themeMode === 'dark' ? '#1c3a5e' : '#e6f7ff',
                border: `1px solid ${themeMode === 'dark' ? '#2a5a8a' : '#91d5ff'}`,
                borderRadius: '6px' 
              }}>
                <Typography.Text style={{ 
                  fontSize: '12px', 
                  color: themeMode === 'dark' ? '#91d5ff' : '#1890ff' 
                }}>
                  You're logged in as {currentUser.name}. Your details are pre-filled.
                </Typography.Text>
              </div>
            )}
            
            <Form
              form={form}
              onFinish={handleSubmit}
              layout="vertical"
              style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}
            >
              <Form.Item
                name="name"
                label="Full Name"
                rules={[
                  { required: true, message: 'Please enter your full name' },
                  { min: 2, message: 'Name must be at least 2 characters' }
                ]}
              >
                <Input 
                  placeholder="Enter your full name" 
                  disabled={!!currentUser}
                />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email Address"
                rules={[
                  { required: true, message: 'Please enter your email address' },
                  { type: 'email', message: 'Please enter a valid email address' }
                ]}
              >
                <Input 
                  placeholder="Enter your email address" 
                  disabled={!!currentUser}
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 24, textAlign: 'center' }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={submitting}
                  size="large"
                  style={{ minWidth: 120 }}
                >
                  Join Project
                </Button>
              </Form.Item>
            </Form>

            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16 }}>
              By joining, you agree to the project's terms and conditions.
            </Paragraph>
          </div>
        );

      case 'success':
        return (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 48 }} />}
            title="Welcome to the Project!"
            subTitle="You have successfully joined the project. Redirecting you..."
          />
        );

      case 'error':
        return (
          <Result
            status="error"
            title={errorMessage}
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
        backgroundColor: themeMode === 'dark' ? '#141414' : '#f5f5f5',
        padding: '20px',
      }}
    >
      <Card
        style={{
          maxWidth: 500,
          width: '100%',
          boxShadow: themeMode === 'dark' 
            ? '0 4px 12px rgba(0,0,0,0.3)' 
            : '0 4px 12px rgba(0,0,0,0.1)',
          backgroundColor: themeMode === 'dark' ? '#1f1f1f' : '#ffffff',
          border: themeMode === 'dark' ? '1px solid #303030' : undefined,
        }}
      >
        {renderContent()}
      </Card>
    </div>
  );
};

export default ProjectInvitePage;