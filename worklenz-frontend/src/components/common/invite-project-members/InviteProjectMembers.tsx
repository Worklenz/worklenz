import { Button, Flex, Form, message, Modal, Select, Typography } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  toggleProjectMemberDrawer,
  markProjectMembersUpdated,
} from '@/features/projects/singleProject/members/projectMembersSlice';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { SeatLimitModal } from '@/components/common/seat-limit-modal';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useNavigate } from 'react-router-dom';

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

  // Team member options for the dropdown
  const [teamMemberOptions, setTeamMemberOptions] = useState<{ value: string; label: string }[]>(
    []
  );

  // Link invitation states
  const [linkLoading, setLinkLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [linkExpiry, setLinkExpiry] = useState<string>('');
  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Seat limit modal states
  const [seatLimitModalOpen, setSeatLimitModalOpen] = useState(false);
  const [seatLimitData, setSeatLimitData] = useState<any>(null);
  const [pendingInvite, setPendingInvite] = useState<any>(null);

  const [form] = Form.useForm<FormValues>();
  const navigate = useNavigate();

  const { t } = useTranslation('settings/team-members');
  const isDrawerOpen = useAppSelector(state => state.projectMemberReducer.isDrawerOpen);
  const dispatch = useAppDispatch();
  const { promptUpgrade } = useUpgradePrompt();

  // Fetch team members when modal opens
  useEffect(() => {
    if (isDrawerOpen && projectId) {
      fetchTeamMembers();
      checkExistingInvitationLink();
    }
  }, [isDrawerOpen, projectId]);

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
      const res = await projectMembersApiService.getInvitationLinkStatus(projectId);
      if (res.done && res.body.has_active_link && res.body.expires_at) {
        // Check if the link is actually expired
        if (isLinkExpired(res.body.expires_at)) {
          setHasActiveLink(false);
          setInvitationLink('');
          setLinkExpiry('');
        } else {
          setHasActiveLink(true);
          setInvitationLink(res.body.invitation_url || '');
          setLinkExpiry(res.body.expires_at);
        }
      } else {
        setHasActiveLink(false);
        setInvitationLink('');
        setLinkExpiry('');
      }
    } catch (error) {
      console.error('Error checking project invitation link status:', error);
    }
  };

  // Fetch all team members and build options for the Select dropdown
  const fetchTeamMembers = async () => {
    try {
      const res = await teamMembersApiService.getAll(projectId);
      if (res.done && res.body) {
        const options = res.body
          .filter(member => member.email)
          .map(member => ({
            value: member.email!,
            label: `${member.name} (${member.email})`,
          }));
        setTeamMemberOptions(options);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
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
          
          // Check for seat limit exceeded error
          if (!result.done && result.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
            return { email, success: false, error: result.message, seatLimitError: result.body };
          }
          
          return { email, success: result.done, error: result.message };
        } catch (error: any) {
          return { email, success: false, error: error.message || 'Unknown error' };
        }
      });

      const results = await Promise.all(invitePromises);
      
      // Check if any result has a seat limit error
      const seatLimitError = results.find(r => (r as any).seatLimitError);
      if (seatLimitError) {
        setSeatLimitData((seatLimitError as any).seatLimitError);
        setPendingInvite({ emails: emailList, access: values.access, projectId, projectName });
        setSeatLimitModalOpen(true);
        setLoading(false);
        return;
      }
      
      const successResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);

      const successCount = successResults.length;
      const failCount = failedResults.length;

      if (successCount > 0 && failCount > 0) {
        const failedEmails = failedResults.map(r => r.email).join(', ');
        message.warning(`${successCount} invited successfully. Failed: ${failedEmails}`);
        form.resetFields();
        dispatch(markProjectMembersUpdated());
        dispatch(toggleProjectMemberDrawer());
      } else if (successCount > 0) {
        message.success(`${successCount} project member(s) invited successfully`);
        form.resetFields();
        dispatch(markProjectMembersUpdated());
        dispatch(toggleProjectMemberDrawer());
      } else {
        const failedEmails = failedResults.map(r => r.email).join(', ');
        // message.error(`Failed to invite: ${failedEmails}`);
      }
    } catch (error) {
      console.error('Error inviting project members:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate invitation link (separate from copying)
  const handleGenerateLink = async () => {
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
      
      // Check for seat limit exceeded error
      if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
        setSeatLimitData(res.body);
        setPendingInvite({ 
          emails: [], 
          access: 'member', 
          projectId, 
          projectName,
          isLinkGeneration: true 
        });
        setSeatLimitModalOpen(true);
        return;
      }
      
      if (res.done && res.body.invitation_url) {
        setInvitationLink(res.body.invitation_url);
        setLinkExpiry(res.body.expires_at);
        setHasActiveLink(true);
        
      }
    } catch (error) {
      console.error('Error generating invitation link:', error);
      
    } finally {
      setLinkLoading(false);
    }
  };

  // Copy existing link to clipboard (synchronous user action)
  const handleCopyLink = async () => {
    if (!invitationLink) return;
    
    try {
      // This works in all browsers because it's called directly from user click
      await navigator.clipboard.writeText(invitationLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  // Clear team member options on close
  const handleClose = () => {
    form.resetFields();
    setLinkCopied(false);
    setTeamMemberOptions([]);
    dispatch(toggleProjectMemberDrawer());
  };

  const handleSeatLimitUpgrade = () => {
    setSeatLimitModalOpen(false);
    promptUpgrade();
  };

  const handleSeatLimitDeactivate = () => {
    setSeatLimitModalOpen(false);
    // Store pending invite in localStorage for auto-send after deactivation
    if (pendingInvite) {
      localStorage.setItem('pendingProjectInvite', JSON.stringify(pendingInvite));
    }
    // Navigate to Settings > Members
    navigate('/worklenz/settings/team-members');
  };

  const handleSeatLimitModalClose = () => {
    setSeatLimitModalOpen(false);
    setPendingInvite(null);
    setSeatLimitData(null);
  };

  return (
    <>
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
          <Flex justify="space-between" align="center" gap={8}>
            {hasActiveLink && !isLinkExpired(linkExpiry) ? (
              <>
                <Button onClick={handleGenerateLink} loading={linkLoading}>
                  {t('projectInvite_regenerateLink', { defaultValue: 'Regenerate Link' })}
                </Button>
                <Button
                  type="primary"
                  onClick={handleCopyLink}
                  icon={linkCopied ? <CheckOutlined /> : <CopyOutlined />}
                >
                  {linkCopied
                    ? t('projectInvite_copiedShort')
                    : t('projectInvite_copyLinkButton')}
                </Button>
              </>
            ) : (
              <Button
                type="primary"
                loading={linkLoading}
                onClick={handleGenerateLink}
                icon={<CopyOutlined />}
              >
                {t('projectInvite_generateLink', { defaultValue: 'Generate Link' })}
              </Button>
            )}
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
                {/* Shows all team members immediately on open */}
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder={t('projectInvite_emailPlaceholder')}
                  options={teamMemberOptions}
                  filterOption={(input, option) => {
                    if (!option) return false;
                    return (
                      option.value.toLowerCase().includes(input.toLowerCase()) ||
                      option.label.toLowerCase().includes(input.toLowerCase())
                    );
                  }}
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
        </Flex>
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

export default InviteProjectMembers;
