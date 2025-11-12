import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Spin, Result, Button, Typography, Form, Input, message, Tag, Tooltip } from '@/shared/antd-imports';
import { CheckCircleOutlined, LoadingOutlined, ProjectOutlined, CloseOutlined } from '@ant-design/icons';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { invitationRedirectService } from '@/services/invitation-redirect.service';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('invitation');

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
        message.success(t('successMessage'));
        
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
                message: t('projectLoginPrompt'),
                email: values.email
              }
            });
          }
        }, 2000);
      } else {
        message.error(response.message || t('joinFailed'));
        // Navigate to home page if join failed (using window.location to bypass auth guards)
        setTimeout(() => {
          window.location.href = '/worklenz/home';
        }, 1500);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('joinFailed'));
      // Navigate to home page if join failed (using window.location to bypass auth guards)
      setTimeout(() => {
        window.location.href = '/worklenz/home';
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipInvitation = async () => {
    // Clear the stored invitation context
    invitationRedirectService.clearPendingInvitation();
    console.log('[ProjectInvite] Cleared invitation context after skip');
    
    // Clear the session
    await authService.signOut();
    console.log('[ProjectInvite] Cleared session after skip');
    
    // Redirect to authenticating page
    navigate('/auth/authenticating');
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <Result
            icon={<Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />}
            title={t('validatingInvitation')}
            subTitle={t('validatingSubtitle')}
          />
        );

      case 'form':
        return (
          <div style={{ textAlign: 'center' }}>
            <ProjectOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
            <Title level={3}>{t('joinProject')}</Title>
            <div style={{ marginBottom: 24 }}>
              <Paragraph type="secondary">
                {t('invitedToProject')}
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
                {t('in')} <strong>{projectInfo?.project?.team_name}</strong> {t('invitedBy')} {projectInfo?.project?.owner_name}
              </Paragraph>
              <Paragraph type="secondary" style={{ fontSize: '12px' }}>
                {t('accessLevel')}: <strong>{projectInfo?.invitation?.access_level}</strong>
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
                  {t('loggedInAs', { name: currentUser.name })}
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
                label={t('fullName')}
                rules={[
                  { required: true, message: t('fullNameRequired') },
                  { min: 2, message: t('fullNameMinLength') }
                ]}
              >
                <Input 
                  placeholder={t('fullNamePlaceholder')}
                  disabled={!!currentUser}
                />
              </Form.Item>

              <Form.Item
                name="email"
                label={t('emailAddress')}
                rules={[
                  { required: true, message: t('emailRequired') },
                  { type: 'email', message: t('emailInvalid') }
                ]}
              >
                <Input 
                  placeholder={t('emailPlaceholder')}
                  disabled={!!currentUser}
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 24, textAlign: 'center' }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={submitting}
                  size="large"
                  style={{ minWidth: 120, marginRight: 8 }}
                >
                  {t('joinProjectButton')}
                </Button>
                <Tooltip title={t('skipInvitationTooltip')}>
                  <Button 
                    onClick={handleSkipInvitation}
                    size="large"
                    style={{ minWidth: 120 }}
                  >
                    {t('skipInvitation')}
                  </Button>
                </Tooltip>
              </Form.Item>
            </Form>

            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16 }}>
              {t('projectTermsAgreement')}
            </Paragraph>
          </div>
        );

      case 'success':
        return (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 48 }} />}
            title={t('welcomeProject')}
            subTitle={t('successProjectSubtitle')}
          />
        );

      case 'error':
        return (
          <Result
            status="error"
            title={t('errorNotLoggedIn') || errorMessage}
            subTitle={ errorMessage}
            extra={[
              <Button key="home" onClick={() => navigate('/')}>
                {t('goToHome')}
              </Button>,
              <Button key="login" type="primary" onClick={() => navigate('/auth/login')}>
                {t('goToLogin')}
              </Button>,
            ]}
          />
        );

      case 'invalid':
        return (
          <Result
            status="warning"
            title={t('invalidInvitation')}
            subTitle={t('invalidInvitationSubtitle')}
            extra={
              <Button type="primary" onClick={() => navigate('/auth/login')}>
                {t('goToLogin')}
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
          position: 'relative',
        }}
        extra={
          status === 'form' && (
            <Tooltip title={t('skipInvitationTooltip')}>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={handleSkipInvitation}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  zIndex: 1,
                }}
              />
            </Tooltip>
          )
        }
      >
        {renderContent()}
      </Card>
    </div>
  );
};

export default ProjectInvitePage;