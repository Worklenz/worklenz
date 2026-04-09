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
import { useState, useEffect, useCallback } from 'react';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { IJobTitle } from '@/types/job.types';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import { LinkOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_team_invite_sent } from '@/shared/worklenz-analytics-events';
import { useAuthService } from '@/hooks/useAuth';

interface FormValues {
  email: string[];
  jobTitle: string;
  access: 'member' | 'team-lead' | 'admin';
}

const InviteTeamMembers = () => {
  // Email invitation states
  // const [searching, setSearching] = useState(false);
  // const [jobTitles, setJobTitles] = useState<IJobTitle[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Link invitation states
  const [activeTab, setActiveTab] = useState<string>('email');
  const [linkLoading, setLinkLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [linkExpiry, setLinkExpiry] = useState<string>('');
  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [form] = Form.useForm<FormValues>();

  const { t } = useTranslation('settings/team-members');
  const { t: tCommon } = useTranslation('common');
  const isDrawerOpen = useAppSelector(state => state.memberReducer.isInviteMemberDrawerOpen);
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isInviteRestricted = Boolean(currentSession?.is_expired);
  const inviteRestrictedMessage = tCommon('license-expired-subtitle', {
    defaultValue:
      'Your Worklenz subscription has ended. Please renew to continue enjoying all features.',
  });

  // const handleSearch = useCallback(
  //   async (value: string) => {
  //     try {
  //       setSearching(true);
  //       const res = await jobTitlesApiService.getJobTitles(1, 10, null, null, value || null);
  //       if (res.done) {
  //         setJobTitles(res.body.data || []);
  //       }
  //     } catch (error) {
  //       message.error(t('Failed to fetch job titles'));
  //     } finally {
  //       setSearching(false);
  //     }
  //   },
  //   [t]
  // );

  // useEffect(() => {
  //   if (isDrawerOpen) {
  //     handleSearch('');
  //     checkExistingInvitationLink();
  //   }
  // }, [isDrawerOpen, handleSearch]);

  const checkExistingInvitationLink = async () => {
    try {
      const res = await teamMembersApiService.getInvitationLinkStatus();
      if (res.done && res.body.has_active_link) {
        setHasActiveLink(true);
        setInvitationLink(res.body.invitation_url || '');
        setLinkExpiry(res.body.expires_at || '');
      } else {
        setHasActiveLink(false);
        setInvitationLink('');
        setLinkExpiry('');
      }
    } catch (error) {
      console.error('Error checking invitation link status:', error);
    }
  };

  const handleCreateInvitationLink = async () => {
    if (isInviteRestricted) {
      message.error(inviteRestrictedMessage);
      return;
    }

    try {
      setLinkLoading(true);
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
      if (res.done) {
        setInvitationLink(res.body.invitation_url);
        setLinkExpiry(res.body.expires_at);
        setHasActiveLink(true);
        message.success(
          t('Invitation link created successfully', {
            defaultValue: 'Invitation link created successfully',
          })
        );
      }
    } catch (error) {
      message.error(
        t('Failed to create invitation link', {
          defaultValue: 'Failed to create invitation link',
        })
      );
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (isInviteRestricted) {
      message.error(inviteRestrictedMessage);
      return;
    }

    try {
      await navigator.clipboard.writeText(invitationLink);

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
    } catch (error) {
      message.error(
        t('Failed to copy link', {
          defaultValue: 'Failed to copy link',
        })
      );
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
      const body: ITeamMemberCreateRequest = {
        job_title: selectedJobTitle,
        emails: emails,
        is_admin: values.access === 'admin',
        role_name:
          values.access === 'team-lead'
            ? ROLE_NAMES.TEAM_LEAD
            : values.access === 'admin'
              ? ROLE_NAMES.ADMIN
              : ROLE_NAMES.MEMBER,
      };
      const res = await teamMembersApiService.createTeamMember(body);
      if (res.done) {
        // Track team invitation via email
        trackMixpanelEvent(evt_team_invite_sent, {
          invite_method: 'email',
          invite_count: emails.length,
          role: values.access,
          has_job_title: !!selectedJobTitle,
        });

        form.resetFields();
        setEmails([]);
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
    setEmails([]);
    setSelectedJobTitle(null);
    setActiveTab('email');
    setLinkCopied(false);
    dispatch(toggleInviteMemberDrawer());
  };

  const handleEmailChange = (value: string[]) => {
    setEmails(value);
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
                type: 'array',
                required: true,
                validator: (_, value) => {
                  if (!value?.length) return Promise.reject(t('memberEmailRequiredError'));
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

          {/* <Form.Item label={t('jobTitleLabel')} name="jobTitle">
            <AutoComplete
              options={jobTitles.map(job => ({
                value: job.id,
                label: job.name,
              }))}
              allowClear
              onSearch={handleSearch}
              placeholder={t('jobTitlePlaceholder')}
              onChange={(value, option) => {
                const selectedOption = Array.isArray(option) ? option[0] : option;
                form.setFieldsValue({ jobTitle: selectedOption?.label || value });
              }}
              onSelect={value => setSelectedJobTitle(value)}
            />
            {searching && (
              <div style={{ textAlign: 'center', padding: '8px' }}>
                <Spin size="small" />
              </div>
            )}
          </Form.Item> */}

          <Form.Item label={t('memberAccessLabel')} name="access">
            <Select
              disabled={isInviteRestricted}
              options={[
                { value: 'member', label: t('memberText') },
                { value: 'team-lead', label: 'Team Lead' },
                { value: 'admin', label: t('adminText') },
              ]}
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
              placeholder={t('No active invitation link', {
                defaultValue: 'No active invitation link',
              })}
              style={{ marginTop: 8 }}
              suffix={
                invitationLink && (
                  <Button
                    type="text"
                    size="small"
                    icon={linkCopied ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={handleCopyLink}
                    disabled={isInviteRestricted}
                    style={{ color: linkCopied ? '#52c41a' : undefined }}
                  />
                )
              }
            />
            {linkExpiry &&
              (() => {
                const expiryText = formatExpiryDate(linkExpiry);
                return expiryText === 'Expired' ? (
                  <Typography.Text
                    type="danger"
                    style={{ fontSize: 12, marginTop: 4, display: 'block' }}
                  >
                    {expiryText}
                  </Typography.Text>
                ) : (
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, marginTop: 4, display: 'block' }}
                  >
                    {t('This link will automatically expire in')} {expiryText}.
                  </Typography.Text>
                );
              })()}
          </div>

          <Flex gap={8}>
            {!hasActiveLink ? (
              <Button
                type="primary"
                loading={linkLoading}
                onClick={handleCreateInvitationLink}
                icon={<LinkOutlined />}
                disabled={isInviteRestricted}
              >
                {t('Create Link', {
                  defaultValue: 'Create Link',
                })}
              </Button>
            ) : (
              <>
                <Button
                  loading={linkLoading}
                  onClick={handleDeactivateLink}
                  disabled={isInviteRestricted}
                >
                  {t('Deactivate Link', {
                    defaultValue: 'Deactivate Link',
                  })}
                </Button>
                {formatExpiryDate(linkExpiry) !== 'Expired' && (
                  <Button
                    type="primary"
                    onClick={handleCopyLink}
                    icon={linkCopied ? <CheckOutlined /> : <CopyOutlined />}
                    disabled={isInviteRestricted}
                  >
                    {linkCopied
                      ? t('Copied!', {
                          defaultValue: 'Copied!',
                        })
                      : t('Copy Link', {
                          defaultValue: 'Copy Link',
                        })}
                  </Button>
                )}
              </>
            )}
          </Flex>
        </Flex>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Typography.Text strong style={{ fontSize: 16 }}>
          {t('addMemberDrawerTitle')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onCancel={handleClose}
      destroyOnHidden={false}
      // afterOpenChange={visible => visible && handleSearch('')}
      width={500}
      loading={loading && activeTab === 'email'}
      footer={
        activeTab === 'email' ? (
          <Flex justify="end">
            <Button onClick={form.submit} style={{ fontSize: 12 }}>
              {t('addToTeamButton', { defaultValue: 'Add to Team' })}
            </Button>
          </Flex>
        ) : null
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
    </Modal>
  );
};

export default InviteTeamMembers;
