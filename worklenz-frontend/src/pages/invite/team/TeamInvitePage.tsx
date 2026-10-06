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
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { invitationRedirectService } from '@/services/invitation-redirect.service';
import { useTranslation } from 'react-i18next';
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

const TeamInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const authService = useAuthService();
  const currentUser = authService.getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';
  const { t } = useTranslation('invitation');
  const { token: antdToken } = theme.useToken();

  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error' | 'invalid'>(
    'loading'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [teamInfo, setTeamInfo] = useState<any>(null);
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
    invitationRedirectService.storePendingInvitation(token, 'team', currentPath);
    console.log('[TeamInvite] Stored invitation context on mount');

    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    try {
      const response = await teamMembersApiService.validateInvitationLink(token!);
      console.log(response);
      if (response.done) {
        setTeamInfo(response.body);
        setStatus('form');
      } else {
        setStatus('error');
        setErrorMessage(response.message || 'Invalid invitation link');
      }
    } catch (error: any) {
      // Check if this is a 401 error (not authenticated)
      if (error?.response?.status === 401) {
        // The API client will handle the redirect to login
        // Just keep showing loading state
        console.log('[TeamInvite] 401 error - redirecting to login');
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
      const response = await teamMembersApiService.acceptInvitationByLink(token, values);

      if (response.done) {
        setStatus('success');
        // message.success(t('successMessage'));

        // Clear the stored invitation context since we successfully joined
        invitationRedirectService.clearPendingInvitation();
        console.log('[TeamInvite] Cleared invitation context after successful join');

        const teamId = response.body?.team_id;

        // Redirect to login or dashboard after a delay
        setTimeout(() => {
          if (currentUser && teamId) {
            // Force full page reload to refresh session with new active team
            // Backend has already set the active team, so reload will pick it up
            console.log('[TeamInvite] Reloading to refresh session with new active team:', teamId);
            window.location.href = '/worklenz/projects';
          } else if (currentUser) {
            // Fallback: reload to pick up the active team set by backend
            window.location.href = '/worklenz/projects';
          } else {
            navigate('/auth/login', {
              state: {
                message: t('loginPrompt'),
                email: values.email,
              },
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
    console.log('[TeamInvite] Cleared invitation context after skip');

    // Clear the session
    await authService.signOut();
    console.log('[TeamInvite] Cleared session after skip');

    // Redirect to authenticating page
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
              {t('invitedToTeam')}
              <br />
              {teamInfo?.team?.name}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              {t('invitedBy')} <Tag>{teamInfo?.team?.owner_name}</Tag>
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
            title={t('welcomeTeam')}
            subTitle={t('successTeamSubtitle')}
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
              {t('joinTeamButton')}
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

export default TeamInvitePage;
