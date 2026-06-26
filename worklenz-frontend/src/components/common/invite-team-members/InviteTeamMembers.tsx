import {
  Button,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Select,
  Tabs,
  Typography,
} from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  toggleInviteMemberDrawer,
  triggerTeamMembersRefresh,
} from '../../../features/settings/member/memberSlice';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { ROLE_DEFINITIONS, ROLE_NAMES } from '@/types/roles/role.types';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_team_invite_sent } from '@/shared/worklenz-analytics-events';
import { useAuthService } from '@/hooks/useAuth';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { RolePermissionsPopover } from '@/components/settings/role-permissions-popover';
import { SeatLimitModal } from '@/components/common/seat-limit-modal';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useNavigate } from 'react-router-dom';

interface FormValues {
  emails: string[];
  jobTitle: string;
  access: 'member' | 'team-lead' | 'admin';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const InviteTeamMembers = () => {
  // Email invitation states
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Link invitation states
  const [activeTab, setActiveTab] = useState<string>('email');
  const [linkLoading, setLinkLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [linkExpiry, setLinkExpiry] = useState<string>('');
  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Seat limit modal states
  const [seatLimitModalOpen, setSeatLimitModalOpen] = useState(false);
  const [seatLimitData, setSeatLimitData] = useState<any>(null);
  const [pendingInvite, setPendingInvite] = useState<ITeamMemberCreateRequest | null>(null);

  const [form] = Form.useForm<FormValues>();
  const navigate = useNavigate();

  const { t } = useTranslation('settings/team-members');
  const isDrawerOpen = useAppSelector(state => state.memberReducer.isInviteMemberDrawerOpen);
  const dispatch = useAppDispatch();
  const { promptUpgrade } = useUpgradePrompt();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isInviteRestricted = Boolean(currentSession?.is_expired);
  const inviteRestrictedMessage = t('license-expired-subtitle', {
    defaultValue:
      'Your Worklenz subscription has ended. Please renew to continue enjoying all features.',
  });
  const currentRole = getSessionRoleName(currentSession);
  const translatedRoleOptions = [
    ROLE_DEFINITIONS[ROLE_NAMES.MEMBER],
    ROLE_DEFINITIONS[ROLE_NAMES.TEAM_LEAD],
    ROLE_DEFINITIONS[ROLE_NAMES.ADMIN],
  ].map(role => ({
    value:
      role.value === ROLE_NAMES.MEMBER
        ? 'member'
        : role.value === ROLE_NAMES.TEAM_LEAD
          ? 'team-lead'
          : 'admin',
    label: t(role.labelKey, { defaultValue: role.labelDefaultValue }),
    description: t(role.descriptionKey, { defaultValue: role.descriptionDefaultValue }),
  }));
  const isAdmin = currentRole === ROLE_NAMES.ADMIN || currentRole === ROLE_NAMES.OWNER;



  // Check existing link when modal opens and tab changes to link
  useEffect(() => {
    if (isDrawerOpen && activeTab === 'link') {
      checkExistingInvitationLink();
    }
  }, [isDrawerOpen, activeTab]);

  // Check if link is expired based on expires_at date
  const isLinkExpired = (expiresAt: string): boolean => {
    try {
      const expiryDate = new Date(expiresAt);
      const now = new Date();
      return expiryDate <= now;
    } catch {
      return true;
    }
  };

  // Check existing invitation link status
  const checkExistingInvitationLink = async () => {
    try {
      const res = await teamMembersApiService.getInvitationLinkStatus();
      
      if (res.done && res.body.has_active_link && res.body.expires_at) {
        // Keep the link in state even if expired (for deactivate button)
        setHasActiveLink(true);
        setInvitationLink(res.body.invitation_url || '');
        setLinkExpiry(res.body.expires_at);
        
        if (isLinkExpired(res.body.expires_at)) {
          setHasActiveLink(false);
        } else {
          setHasActiveLink(true);
        }
      } else {
        setHasActiveLink(false);
        setInvitationLink('');
        setLinkExpiry('');
      }
    } catch (error) {
      console.error('Error checking invitation link status:', error);
    }
  };

  const handleGenerateAndCopyLink = async () => {
    if (isInviteRestricted) {
      message.error(inviteRestrictedMessage);
      return;
    }

    try {
      setLinkLoading(true);
      
      // Generate link with current form settings
      const linkData = {
        job_title_id: selectedJobTitle || undefined,
        role_name:
          form.getFieldValue('access') === 'team-lead'
            ? ROLE_NAMES.TEAM_LEAD
            : form.getFieldValue('access') === 'admin'
              ? ROLE_NAMES.ADMIN
              : ROLE_NAMES.MEMBER,
        is_admin: form.getFieldValue('access') === 'admin',
        max_usage: null, // Unlimited usage
      };

      const res = await teamMembersApiService.generateInvitationLink(linkData);
      
      // Check for seat limit exceeded error
      if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
        setSeatLimitData(res.body);
        setPendingInvite({
          job_title: selectedJobTitle,
          emails: [], // Link generation doesn't have emails yet
          is_admin: linkData.is_admin,
          role_name: linkData.role_name,
        });
        setSeatLimitModalOpen(true);
        return;
      }
      
      if (res.done && res.body.invitation_url) {
        // Update state with new link
        setInvitationLink(res.body.invitation_url);
        setLinkExpiry(res.body.expires_at);
        setHasActiveLink(true);
        
        // Copy to clipboard
        await navigator.clipboard.writeText(res.body.invitation_url);

        // Track team invitation link copy
        trackMixpanelEvent(evt_team_invite_sent, {
          invite_method: 'copy_link',
          role: form.getFieldValue('access') || 'member',
          has_job_title: !!selectedJobTitle,
        });

        setLinkCopied(true);
        message.success(
          t('Invitation link copied to clipboard', {
            defaultValue: 'Invitation link copied to clipboard',
          })
        );
        
        setTimeout(() => setLinkCopied(false), 2000);
      }
    } catch (error) {
      message.error(
        t('Failed to generate invitation link', {
          defaultValue: 'Failed to generate invitation link',
        })
      );
    } finally {
      setLinkLoading(false);
    }
  };

  const handleDeactivateLink = async () => {
    if (isInviteRestricted) {
      message.error(inviteRestrictedMessage);
      return;
    }

    try {
      setLinkLoading(true);
      const res = await teamMembersApiService.revokeInvitationLink();
      if (res.done) {
        setHasActiveLink(false);
        setInvitationLink('');
        setLinkExpiry('');
        message.success(
          t('Invitation link deactivated', {
            defaultValue: 'Invitation link deactivated',
          })
        );
      }
    } catch (error) {
      message.error(
        t('Failed to deactivate link', {
          defaultValue: 'Failed to deactivate link',
        })
      );
    } finally {
      setLinkLoading(false);
    }
  };

  const handleFormSubmit = async (values: FormValues) => {
    if (isInviteRestricted) {
      message.error(inviteRestrictedMessage);
      return;
    }

    try {
      setLoading(true);
      const normalizedEmails = (values.emails || []).map(email => String(email).trim()).filter(Boolean);

      const body: ITeamMemberCreateRequest = {
        job_title: selectedJobTitle,
        emails: normalizedEmails,
        is_admin: values.access === 'admin',
        role_name:
          values.access === 'team-lead'
            ? ROLE_NAMES.TEAM_LEAD
            : values.access === 'admin'
              ? ROLE_NAMES.ADMIN
              : ROLE_NAMES.MEMBER,
      };
      const res = await teamMembersApiService.createTeamMember(body);
      
      // Check for seat limit exceeded error
      if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
        setSeatLimitData(res.body);
        setPendingInvite(body);
        setSeatLimitModalOpen(true);
        return;
      }
      
      if (res.done) {
        // Track team invitation via email
        trackMixpanelEvent(evt_team_invite_sent, {
          invite_method: 'email',
          invite_count: normalizedEmails.length,
          role: values.access,
          has_job_title: !!selectedJobTitle,
        });

        form.resetFields();
        setSelectedJobTitle(null);
        dispatch(triggerTeamMembersRefresh()); // Trigger refresh in TeamMembersSettings
        dispatch(toggleInviteMemberDrawer());
      }
    } catch (error) {
      message.error(t('createMemberErrorMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setSelectedJobTitle(null);
    setActiveTab('email');
    setLinkCopied(false);
    dispatch(toggleInviteMemberDrawer());
  };

  const handleSeatLimitUpgrade = () => {
    setSeatLimitModalOpen(false);
    promptUpgrade();
  };

  const handleSeatLimitDeactivate = () => {
    setSeatLimitModalOpen(false);
    // Store pending invite in localStorage for auto-send after deactivation
    if (pendingInvite) {
      localStorage.setItem('pendingTeamInvite', JSON.stringify(pendingInvite));
    }
    // Navigate to Settings > Members
    navigate('/worklenz/settings/team-members');
  };

  const handleSeatLimitModalClose = () => {
    setSeatLimitModalOpen(false);
    setPendingInvite(null);
    setSeatLimitData(null);
  };

  const handleEmailChange = (value: string[]) => {
    const normalizedEmails = (value || []).map(email => String(email).trim()).filter(Boolean);
    form.setFieldValue('emails', normalizedEmails);
    void form.validateFields(['emails']).catch(() => undefined);
  };

  const formatExpiryDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      } else {
        return 'Expired';
      }
    } catch {
      return 'Unknown';
    }
  };

  const tabItems = [
    {
      key: 'email',
      label: t('Invite with Email', {
        defaultValue: 'Invite with Email',
      }),
      children: (
        <Form
          form={form}
          onFinish={handleFormSubmit}
          layout="vertical"
          initialValues={{ access: 'member' }}
        >
          {isInviteRestricted && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 16 }}>
              {inviteRestrictedMessage}
            </Typography.Text>
          )}
          <Form.Item
            name="emails"
            label={t('memberEmailLabel')}
            rules={[
              {
                validator: (_, value) => {
                  const normalizedEmails = Array.isArray(value)
                    ? value
                    : typeof value === 'string' && value
                      ? [value]
                      : [];
                  if (!normalizedEmails.length) {
                    return Promise.reject(t('memberEmailRequiredError'));
                  }
                  const hasInvalidEmail = normalizedEmails.some(
                    (email: string) => !EMAIL_REGEX.test(String(email).trim())
                  );
                  if (hasInvalidEmail) return Promise.reject(t('memberEmailRequiredError'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Flex vertical gap={4}>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                placeholder={t('memberEmailPlaceholder')}
                onChange={handleEmailChange}
                disabled={isInviteRestricted}
                notFoundContent={
                  <Typography.Text type="secondary">{t('noResultFound')}</Typography.Text>
                }
                tokenSeparators={[',', ' ', ';']}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('addMemberEmailHint')}
              </Typography.Text>
            </Flex>
          </Form.Item>

          <Form.Item
            label={
              <Flex align="center" gap={6}>
                <span>{t('memberAccessLabel', { defaultValue: 'Access Level' })}</span>
                <RolePermissionsPopover />
              </Flex>
            }
            name="access"
          >
            <Select
              disabled={isInviteRestricted}
              options={translatedRoleOptions}
              optionRender={option => (
                <Flex vertical gap={2} style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
                  <Typography.Text style={{ whiteSpace: 'normal' }}>
                    {String(option.data.label)}
                  </Typography.Text>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, whiteSpace: 'normal', lineHeight: 1.4 }}
                  >
                    {option.data.description}
                  </Typography.Text>
                </Flex>
              )}
            />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'link',
      label: t('Invite with Link', {
        defaultValue: 'Invite with Link',
      }),
      children: (
        <Flex vertical gap={16}>
          {isInviteRestricted && (
            <Typography.Text type="danger">{inviteRestrictedMessage}</Typography.Text>
          )}
          <div>
            <Typography.Text strong>
              {t('Your Invite Link', {
                defaultValue: 'Your Invite Link',
              })}
            </Typography.Text>
            <Input
              value={invitationLink}
              disabled
              placeholder={
                hasActiveLink && isLinkExpired(linkExpiry)
                  ? t('Link expired - click Copy Link to generate new', {
                      defaultValue: 'Link expired - click Copy Link to generate new',
                    })
                  : t('No active invitation link', {
                      defaultValue: 'No active invitation link',
                    })
              }
              style={{ marginTop: 8 }}
              suffix={
                invitationLink && !isLinkExpired(linkExpiry) && (
                  <Button
                    type="text"
                    size="small"
                    icon={linkCopied ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={handleGenerateAndCopyLink}
                    disabled={isInviteRestricted}
                    style={{ color: linkCopied ? '#52c41a' : undefined }}
                  />
                )
              }
            />
            {linkExpiry && !isLinkExpired(linkExpiry) && (
              <Typography.Text
                type="secondary"
                style={{ fontSize: 12, marginTop: 4, display: 'block' }}
              >
                {t('This link will automatically expire in')} {formatExpiryDate(linkExpiry)}.
              </Typography.Text>
            )}
          </div>

          <Flex gap={8}>
            <Button
              type="primary"
              loading={linkLoading}
              onClick={handleGenerateAndCopyLink}
              icon={linkCopied ? <CheckOutlined /> : <CopyOutlined />}
              disabled={isInviteRestricted}
            >
              {linkCopied
                ? t('Copied!', {
                    defaultValue: 'Copied!',
                  })
                : hasActiveLink && !isLinkExpired(linkExpiry)
                  ? t('Copy Link', {
                      defaultValue: 'Copy Link',
                    })
                  : t('Generate & Copy Link', {
                      defaultValue: 'Copy Link',
                    })}
            </Button>
            {isAdmin && hasActiveLink && (
              <Button
                loading={linkLoading}
                onClick={handleDeactivateLink}
                disabled={isInviteRestricted}
                danger
              >
                {t('Deactivate Link', {
                  defaultValue: 'Deactivate Link',
                })}
              </Button>
            )}
          </Flex>
        </Flex>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <Typography.Text strong style={{ fontSize: 16 }}>
            {t('addMemberDrawerTitle', { defaultValue: 'Invite Team Members' })}
          </Typography.Text>
        }
        open={isDrawerOpen}
        onCancel={handleClose}
        destroyOnHidden={false}
        width={500}
        loading={loading && activeTab === 'email'}
        footer={
          activeTab === 'email' ? (
            <Flex justify="end">
              <Button onClick={form.submit} disabled={isInviteRestricted}>
                {t('addToTeamButton', { defaultValue: 'Send Invitation' })}
              </Button>
            </Flex>
          ) : null
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
      </Modal>

      {/* Seat Limit Modal */}
      {seatLimitData && (
        <SeatLimitModal
          open={seatLimitModalOpen}
          onClose={handleSeatLimitModalClose}
          currentMembers={seatLimitData.current_members}
          planLimit={seatLimitData.plan_seat_limit}
          businessLimit={seatLimitData.business_plan_limit}
          isAppSumoUser={seatLimitData.is_appsumo_user}
          onUpgrade={handleSeatLimitUpgrade}
          onDeactivate={handleSeatLimitDeactivate}
        />
      )}
    </>
  );
};

export default InviteTeamMembers;
