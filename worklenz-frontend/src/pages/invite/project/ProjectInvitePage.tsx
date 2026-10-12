import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Spin,
  Result,
  Button,
  Typography,
  Form,
  Input,
  message,
  Tag,
  Tooltip,
  theme,
} from '@/shared/antd-imports';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { invitationRedirectService } from '@/services/invitation-redirect.service';
import { useTranslation } from 'react-i18next';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';
import { AUTH_PRIMARY_BUTTON_COLOR } from '@/shared/constants';
import logo from '@/assets/images/worklenz-light-mode.png';
import logoDark from '@/assets/images/worklenz-dark-mode.png';
import InviteFooterUtils from '../InviteFooterUtils';

import '../invite.css';

const { Title, Paragraph } = Typography;

interface FormValues {
  name: string;
  email: string;
}

const formatAccessLevel = (level?: string) =>
  level ? level.charAt(0).toUpperCase() + level.slice(1).toLowerCase() : '';

const ProjectInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const authService = useAuthService();
  const currentUser = authService.getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';
  const dispatch = useAppDispatch();
  const { t } = useTranslation('invitation');
  const { token: antdToken } = theme.useToken();

  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error' | 'invalid'>(
    'loading'
  );
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
    const currentPath = window.location.pathname;
    invitationRedirectService.storePendingInvitation(token, 'project', currentPath);

    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    try {
      const response = await projectMembersApiService.validateInvitationLink(token!);

      if (response.done) {
        setProjectInfo(response.body);
        setStatus('form');
      } else {
        setStatus('error');
        setErrorMessage(response.message || 'Invalid invitation link');
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        return;
      }
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

        const projectId = response.body?.project_id || projectInfo?.project?.id;

        // Refresh the session so it picks up the new active team set by the backend
        setTimeout(async () => {
          try {
            const authResult = await dispatch(verifyAuthentication()).unwrap();
            if (authResult.authenticated) {
              dispatch(setUser(authResult.user));
            }
          } catch {
            // session refresh failed, proceed anyway
          }
          window.location.href = `/worklenz/projects/${projectId}`;
        }, 1500);
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
    invitationRedirectService.clearPendingInvitation();
    await authService.signOut();
    navigate('/auth/authenticating');
  };

  const handleJoinClick = () => {
    if (currentUser) {
      handleSubmit({ name: currentUser.name || '', email: currentUser.email || '' });
    } else {
      form.submit();
    }
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
          <div>
            <Title level={3} style={{ marginBottom: 16 }}>
              {t('invitedToProject')}
              <br />
              {projectInfo?.project?.name}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              {t('in')} <Tag>{projectInfo?.project?.team_name}</Tag>{' '}
              {t('invitedBy')} <Tag>{projectInfo?.project?.owner_name}</Tag>{' '}
              {t('asRolePrefix')}{' '}
              <Tag>{formatAccessLevel(projectInfo?.invitation?.access_level)}</Tag>
              {t('asRoleSuffix')}
            </Paragraph>

            {!currentUser && (
              // Not logged in - show form for guest users (submitted via the footer Join button)
              <Form
                form={form}
                onFinish={handleSubmit}
                layout="vertical"
                style={{ textAlign: 'left', maxWidth: 380, margin: '0 auto' }}
              >
                <Form.Item
                  name="name"
                  label={t('fullName')}
                  rules={[
                    { required: true, message: t('fullNameRequired') },
                    { min: 2, message: t('fullNameMinLength') },
                  ]}
                >
                  <Input placeholder={t('fullNamePlaceholder')} />
                </Form.Item>

                <Form.Item
                  name="email"
                  label={t('emailAddress')}
                  rules={[
                    { required: true, message: t('emailRequired') },
                    { type: 'email', message: t('emailInvalid') },
                  ]}
                >
                  <Input placeholder={t('emailPlaceholder')} />
                </Form.Item>
              </Form>
            )}

            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 20 }}>
              {t('byJoiningTermsText')}{' '}
              <a
                href="https://worklenz.com/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="invite-terms-link"
              >
                {t('termsOfServiceLink')}
              </a>{' '}
              {t('andText')}{' '}
              <a
                href="https://worklenz.com/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="invite-terms-link"
              >
                {t('privacyPolicyLink')}
              </a>
              .
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
            status="warning"
            title={errorMessage}
            subTitle={t('invalidInvitationSubtitle')}
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
      className="invite-shell"
      style={{ backgroundColor: antdToken.colorBgLayout, color: antdToken.colorText }}
    >
      <div className="invite-header">
        <div className="invite-logo">
          <img src={isDarkMode ? logoDark : logo} alt="Worklenz" style={{ height: 26 }} />
        </div>
      </div>

      <div className="invite-body">
        <div className="invite-page-wrap invite-body-inner">{renderContent()}</div>

        {status === 'form' && currentUser && (
          <div className="invite-page-wrap invite-joining-as">
            <Paragraph type="secondary" italic style={{ fontSize: 12, marginBottom: 0 }}>
              {t('joiningAs', { name: currentUser.name, email: currentUser.email })}
            </Paragraph>
          </div>
        )}
      </div>

      {status === 'form' && (
        <div className="invite-footer" style={{ borderTop: `1px solid ${antdToken.colorBorder}` }}>
          <div className="invite-page-wrap invite-footer-inner">
            <Tooltip title={t('skipInvitationTooltip')}>
              <Button
                type="text"
                onClick={handleSkipInvitation}
                style={{
                  color: AUTH_PRIMARY_BUTTON_COLOR,
                  fontSize: 12,
                  paddingInline: 12,
                  marginLeft: -12,
                }}
              >
                {t('skipInvitation')}
              </Button>
            </Tooltip>
            <Button
              type="primary"
              loading={submitting}
              onClick={handleJoinClick}
              style={{
                fontSize: 12,
                padding: '0 20px',
                backgroundColor: AUTH_PRIMARY_BUTTON_COLOR,
                borderColor: AUTH_PRIMARY_BUTTON_COLOR,
              }}
            >
              {t('joinProjectButton')}
            </Button>
          </div>

          <InviteFooterUtils
            isDarkMode={isDarkMode}
            userTimezone={currentUser?.timezone}
            isAuthenticated={!!currentUser}
          />
        </div>
      )}
    </div>
  );
};

export default ProjectInvitePage;
