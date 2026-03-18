import { Button, Flex, Form, message, Modal, Select, Typography } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { CopyOutlined, CheckOutlined, ShareAltOutlined } from '@ant-design/icons';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service'; // ✅ NEW IMPORT
import { themeWiseColor } from '@/utils/themeWiseColor';

interface FormValues {
  emails: string[];
  access: 'member' | 'team-lead' | 'admin';
}

interface InviteProjectMembersProps {
  projectId: string;
  projectName: string;
}

const InviteProjectMembers = ({ projectId, projectName }: InviteProjectMembersProps) => {
  // Email invitation states
  const [loading, setLoading] = useState(false);

  // ✅ NEW: Team member options for the dropdown
  const [teamMemberOptions, setTeamMemberOptions] = useState<{ value: string; label: string }[]>(
    []
  );

  // Link invitation states
  const [linkLoading, setLinkLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [linkExpiry, setLinkExpiry] = useState<string>('');
  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [form] = Form.useForm<FormValues>();

  const { t } = useTranslation('settings/team-members');
  const isDrawerOpen = useAppSelector(state => state.projectMemberReducer.isDrawerOpen);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  // ✅ UPDATED: Also fetch team members when modal opens
  useEffect(() => {
    if (isDrawerOpen && projectId) {
      checkExistingInvitationLink();
      fetchTeamMembers(); // ✅ NEW
    }
  }, [isDrawerOpen, projectId]);

  // ✅ NEW: Fetch all team members and build options for the Select dropdown
  const fetchTeamMembers = async () => {
    try {
      const res = await teamMembersApiService.getAll(projectId);
      if (res.done && res.body) {
        const options = res.body
          .filter(member => member.email)
          .map(member => ({
            value: member.email,
            label: `${member.name} (${member.email})`,
          }));
        setTeamMemberOptions(options);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const checkExistingInvitationLink = async () => {
    try {
      const res = await projectMembersApiService.getInvitationLinkStatus(projectId);
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
      console.error('Error checking project invitation link status:', error);
    }
  };

  const handleFormSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      const emailList = values.emails || [];

      if (emailList.length === 0) {
        message.error(t('projectInvite_emailRequired'));
        setLoading(false);
        return;
      }

      const invitePromises = emailList.map(async email => {
        try {
          const body = {
            email: email.trim(),
            project_id: projectId,
            role_name:
              values.access === 'team-lead'
                ? ROLE_NAMES.TEAM_LEAD
                : values.access === 'admin'
                  ? ROLE_NAMES.ADMIN
                  : ROLE_NAMES.MEMBER,
            is_admin: values.access === 'admin',
          };
          const result = await projectMembersApiService.inviteByEmail(body);
          return { email, success: result.done, error: result.message };
        } catch (error: any) {
          return { email, success: false, error: error.message || 'Unknown error' };
        }
      });

      const results = await Promise.all(invitePromises);
      const successResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);

      const successCount = successResults.length;
      const failCount = failedResults.length;

      if (successCount > 0 && failCount > 0) {
        const failedEmails = failedResults.map(r => r.email).join(', ');
        message.warning(`${successCount} invited successfully. Failed: ${failedEmails}`);
        form.resetFields();
        dispatch(toggleProjectMemberDrawer());
      } else if (successCount > 0) {
        message.success(`${successCount} project member(s) invited successfully`);
        form.resetFields();
        dispatch(toggleProjectMemberDrawer());
      } else {
        const failedEmails = failedResults.map(r => r.email).join(', ');
        message.error(`Failed to invite: ${failedEmails}`);
      }
    } catch (error) {
      console.error('Error inviting project members:', error);
      message.error(t('projectInvite_inviteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvitationLink = async () => {
    try {
      setLinkLoading(true);
      const linkData = {
        project_id: projectId,
        access_level: 'MEMBER',
        role_name: ROLE_NAMES.MEMBER,
        is_admin: false,
        max_usage: null,
      };

      const res = await projectMembersApiService.generateInvitationLink(linkData);
      if (res.done) {
        setInvitationLink(res.body.invitation_url);
        setLinkExpiry(res.body.expires_at);
        setHasActiveLink(true);
        message.success(t('projectInvite_linkCreatedSuccess'));
      }
    } catch (error) {
      message.error(t('projectInvite_linkCreateFailed'));
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setLinkCopied(true);
      message.success(t('projectInvite_linkCopied'));
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      message.error(t('projectInvite_linkCopyFailed'));
    }
  };

  // ✅ UPDATED: Also clear team member options on close
  const handleClose = () => {
    form.resetFields();
    setLinkCopied(false);
    setTeamMemberOptions([]); // ✅ NEW
    dispatch(toggleProjectMemberDrawer());
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

  return (
    <Modal
      title={
        <Typography.Text strong style={{ fontSize: 16 }}>
          Share "{projectName}"
        </Typography.Text>
      }
      open={isDrawerOpen}
      onCancel={handleClose}
      destroyOnHidden={false}
      width={500}
      loading={loading}
      footer={
        <Flex justify="flex-end" align="center">
          <Button
            loading={linkLoading}
            onClick={hasActiveLink ? handleCopyLink : handleCreateInvitationLink}
            icon={
              hasActiveLink ? (
                linkCopied ? (
                  <CheckOutlined />
                ) : (
                  <CopyOutlined />
                )
              ) : (
                <ShareAltOutlined />
              )
            }
          >
            {hasActiveLink
              ? linkCopied
                ? t('projectInvite_copiedShort')
                : t('projectInvite_copyLinkButton')
              : t('projectInvite_copyLinkButton')}
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={2}>
        {/* Email Invitation Section */}
        <Form
          form={form}
          onFinish={handleFormSubmit}
          layout="vertical"
          initialValues={{ access: 'member' }}
        >
          <Flex gap={16} align="flex-start">
            <Form.Item
              name="emails"
              label={t('projectInvite_emailLabel')}
              style={{ flex: 1, marginBottom: 16 }}
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || !Array.isArray(value) || value.length === 0) {
                      return Promise.reject(new Error(t('projectInvite_emailRequired')));
                    }

                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    const invalidEmails = value.filter(
                      (email: string) => !emailRegex.test(email.trim())
                    );

                    if (invalidEmails.length > 0) {
                      return Promise.reject(new Error(t('projectInvite_emailInvalid')));
                    }

                    return Promise.resolve();
                  },
                },
              ]}
            >
              {/* ✅ UPDATED: Now shows all team members immediately on open */}
              <Select
                mode="tags"
                style={{ width: '100%' }}
                placeholder={t('projectInvite_emailPlaceholder')}
                options={teamMemberOptions}
                filterOption={(input, option) =>
                  option?.value?.toLowerCase().includes(input.toLowerCase()) ||
                  option?.label?.toLowerCase().includes(input.toLowerCase())
                }
                notFoundContent={
                  <Typography.Text type="secondary">{t('projectInvite_emailHelp')}</Typography.Text>
                }
                tokenSeparators={[',', ' ', ';']}
              />
            </Form.Item>
            <Button htmlType="submit" type="primary" loading={loading} style={{ marginTop: 30 }}>
              {t('projectInvite_inviteButton')}
            </Button>
          </Flex>

          <Form.Item
            label={t('projectInvite_teamRoleLabel')}
            name="access"
            tooltip={t('projectInvite_teamRoleTooltip')}
          >
            <Select
              options={[
                { value: 'member', label: t('memberText') },
                { value: 'team-lead', label: 'Team Lead' },
                { value: 'admin', label: t('adminText') },
              ]}
            />
          </Form.Item>
        </Form>

        {/* Link Status Section */}
        {hasActiveLink && (
          <div
            style={{
              padding: '4px',
              backgroundColor: themeWiseColor('#f6ffed', '#1f2937', themeMode),
              border: `1px solid ${themeWiseColor('#b7eb8f', '#374151', themeMode)}`,
              borderRadius: '6px',
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Active invitation link expires in {formatExpiryDate(linkExpiry)}
            </Typography.Text>
          </div>
        )}
      </Flex>
    </Modal>
  );
};

export default InviteProjectMembers;
