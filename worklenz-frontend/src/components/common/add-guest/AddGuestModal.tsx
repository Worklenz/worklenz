import { useState, useEffect } from 'react';
import { Button, Flex, Form, Input, Modal, Select, Typography, Tabs } from '@/shared/antd-imports';
import { App } from 'antd';
import { SearchOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { ROLE_NAMES } from '@/types/roles/role.types';

interface AddGuestModalProps {
  open: boolean;
  onClose: () => void;
}

interface ProjectOption {
  value: string;
  label: string;
}

interface FormValues {
  projectId: string;
  emails: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AddGuestModal = ({ open, onClose }: AddGuestModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const { t } = useTranslation('settings/team-members');
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<string>('email');

  // Link invitation states
  const [linkLoading, setLinkLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [linkExpiry, setLinkExpiry] = useState<string>('');
  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch projects when modal opens
  useEffect(() => {
    if (open) {
      fetchProjects();
      if (activeTab === 'link') {
        checkExistingInvitationLink();
      }
    } else {
      // Reset form when modal closes
      form.resetFields();
      setProjectOptions([]);
      setActiveTab('email');
      setLinkCopied(false);
      setInvitationLink('');
      setHasActiveLink(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  const fetchProjects = async (searchQuery?: string) => {
    try {
      setSearchLoading(true);
      
      // Fetch projects using the actual API
      const response = await projectsApiService.getProjects(
        1, // index - starts from 1, not 0
        50, // size - fetch first 50 projects
        null, // field
        null, // order
        searchQuery || null, // search query
        null, // filter
        null, // statuses
        null, // categories
        null, // priorities
        null  // clients
      );

      if (response.done && response.body?.data) {
        const options = response.body.data.map(project => ({
          value: project.id,
          label: project.name,
        }));
        setProjectOptions(options);
      } else {
        setProjectOptions([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      message.error(
        t('errorFetchingProjects', {
          defaultValue: 'Failed to fetch projects',
        })
      );
      setProjectOptions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleProjectSearch = (value: string) => {
    if (value) {
      fetchProjects(value);
    } else {
      fetchProjects();
    }
  };

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

  // Check existing invitation link status for the selected project
  const checkExistingInvitationLink = async () => {
    const projectId = form.getFieldValue('projectId');
    if (!projectId) {
      setHasActiveLink(false);
      setInvitationLink('');
      setLinkExpiry('');
      return;
    }

    try {
      const res = await projectMembersApiService.getInvitationLinkStatus(projectId);
      
      if (res.done && res.body.has_active_link && res.body.expires_at) {
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
      console.error('Error checking invitation link status:', error);
      setHasActiveLink(false);
      setInvitationLink('');
      setLinkExpiry('');
    }
  };

  const handleGenerateLink = async () => {
    const projectId = form.getFieldValue('projectId');
    
    if (!projectId) {
      message.error(
        t('projectRequired', {
          defaultValue: 'Please select a project first',
        })
      );
      return;
    }

    try {
      setLinkLoading(true);
      
      const linkData = {
        project_id: projectId,
        access_level: 'GUEST',
        role_name: ROLE_NAMES.MEMBER,
        is_admin: false,
        max_usage: null, // Unlimited usage
      };

      const res = await projectMembersApiService.generateInvitationLink(linkData);
      
      if (!res.done) {
        if (res.body?.error_code === 'GUEST_LIMIT_EXCEEDED') {
          message.error(
            t('guestLimitExceeded', {
              defaultValue: 'Guest limit exceeded for this plan',
            })
          );
        } else if (res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
          message.error(
            t('seatLimitExceeded', {
              defaultValue: 'Seat limit exceeded for this plan',
            })
          );
        } else {
          message.error(res.message || t('Failed to generate link', {
            defaultValue: 'Failed to generate invitation link',
          }));
        }
        return;
      }
      
      if (res.done && res.body.invitation_url) {
        setInvitationLink(res.body.invitation_url);
        setLinkExpiry(res.body.expires_at);
        setHasActiveLink(true);
        
        // Copy to clipboard
        await navigator.clipboard.writeText(res.body.invitation_url);
        setLinkCopied(true);
        message.success(
          t('Invitation link copied to clipboard', {
            defaultValue: 'Invitation link copied to clipboard',
          })
        );
        
        setTimeout(() => setLinkCopied(false), 2000);
      } else {
        message.error(
          t('Failed to generate invitation link', {
            defaultValue: 'Failed to generate invitation link',
          })
        );
      }
    } catch (error: any) {
      console.error('Error generating invitation link:', error);
      message.error(
        error?.response?.data?.message || 
        error?.message || 
        t('Failed to generate invitation link', {
          defaultValue: 'Failed to generate invitation link',
        })
      );
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitationLink) return;
    
    try {
      await navigator.clipboard.writeText(invitationLink);
      setLinkCopied(true);
      message.success(
        t('linkCopied', {
          defaultValue: 'Link copied to clipboard',
        })
      );
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      message.error(
        t('copyFailed', {
          defaultValue: 'Failed to copy link',
        })
      );
    }
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

  const handleFormSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      const emailList = values.emails || [];

      if (emailList.length === 0) {
        message.error(
          t('emailRequired', {
            defaultValue: 'Please enter at least one email address',
          })
        );
        setLoading(false);
        return;
      }

      if (!values.projectId) {
        message.error(
          t('projectRequired', {
            defaultValue: 'Please select a project',
          })
        );
        setLoading(false);
        return;
      }

      // Invite each email as a guest to the selected project
      const invitePromises = emailList.map(async email => {
        try {
          const body = {
            email: email.trim(),
            project_id: values.projectId,
            role_name: ROLE_NAMES.MEMBER,
            is_admin: false,
            access_level: 'GUEST',
          };
          const result = await projectMembersApiService.inviteByEmail(body);

          if (!result.done && result.body?.error_code === 'GUEST_LIMIT_EXCEEDED') {
            return {
              email,
              success: false,
              error: t('guestLimitExceeded', {
                defaultValue: 'Guest limit exceeded for this plan',
              }),
            };
          }

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
        message.warning(
          t('partialSuccess', {
            defaultValue: `${successCount} guest(s) invited successfully. Failed: ${failedEmails}`,
          })
        );
        form.resetFields();
        onClose();
      } else if (successCount > 0) {
        message.success(
          t('guestInviteSuccess', {
            defaultValue: `${successCount} guest(s) invited successfully`,
          })
        );
        form.resetFields();
        onClose();
      } else {
        const failedEmails = failedResults.map(r => `${r.email}: ${r.error}`).join('; ');
        message.error(
          t('guestInviteFailed', {
            defaultValue: `Failed to invite guests: ${failedEmails}`,
          })
        );
      }
    } catch (error) {
      console.error('Error inviting guests:', error);
      message.error(
        t('guestInviteError', {
          defaultValue: 'An error occurred while inviting guests',
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (value: string[]) => {
    const normalizedEmails = (value || []).map(email => String(email).trim()).filter(Boolean);
    form.setFieldValue('emails', normalizedEmails);
    void form.validateFields(['emails']).catch(() => undefined);
  };

  const handleProjectChange = (value: string) => {
    form.setFieldValue('projectId', value);
    // Reset link when project changes
    setInvitationLink('');
    setHasActiveLink(false);
    setLinkExpiry('');
    // Check if there's an existing link for the new project
    if (activeTab === 'link' && value) {
      checkExistingInvitationLink();
    }
  };

  // Email invitation tab content
  const emailTabContent = (
    <Form form={form} onFinish={handleFormSubmit} layout="vertical">
      <Form.Item
        name="projectId"
        label={
          <Typography.Text strong>
            {t('selectProjectLabel', { defaultValue: 'Select Project' })}
          </Typography.Text>
        }
        rules={[
          {
            required: true,
            message: t('projectRequired', { defaultValue: 'Please select a project' }),
          },
        ]}
      >
        <Select
          showSearch
          placeholder={t('searchProjectPlaceholder', { defaultValue: 'Search for a project...' })}
          suffixIcon={<SearchOutlined />}
          options={projectOptions}
          loading={searchLoading}
          onSearch={handleProjectSearch}
          onChange={handleProjectChange}
          filterOption={false}
          notFoundContent={
            <Typography.Text type="secondary">
              {t('noProjectsFound', { defaultValue: 'No projects found' })}
            </Typography.Text>
          }
        />
      </Form.Item>

      <Form.Item
        name="emails"
        label={
          <Typography.Text strong>
            {t('guestEmailLabel', { defaultValue: 'Guest Email Addresses' })}
          </Typography.Text>
        }
        rules={[
          {
            validator: (_, value) => {
              const normalizedEmails = Array.isArray(value)
                ? value
                : typeof value === 'string' && value
                  ? [value]
                  : [];
              if (!normalizedEmails.length) {
                return Promise.reject(
                  t('emailRequired', { defaultValue: 'Please enter at least one email address' })
                );
              }
              const hasInvalidEmail = normalizedEmails.some(
                (email: string) => !EMAIL_REGEX.test(String(email).trim())
              );
              if (hasInvalidEmail) {
                return Promise.reject(
                  t('emailInvalid', { defaultValue: 'Please enter valid email addresses' })
                );
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <Flex vertical gap={4}>
          <Select
            mode="tags"
            style={{ width: '100%' }}
            placeholder={t('guestEmailPlaceholder', {
              defaultValue: 'Enter guest email addresses',
            })}
            onChange={handleEmailChange}
            notFoundContent={
              <Typography.Text type="secondary">
                {t('noResultFound', { defaultValue: 'No results found' })}
              </Typography.Text>
            }
            tokenSeparators={[',', ' ', ';']}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('guestEmailHint', {
              defaultValue: 'Separate multiple emails with commas, spaces, or semicolons',
            })}
          </Typography.Text>
        </Flex>
      </Form.Item>

      <Flex
        vertical
        gap={8}
        style={{
          padding: 12,
          borderRadius: 8,
          background: 'rgba(24, 144, 255, 0.05)',
          border: '1px solid rgba(24, 144, 255, 0.2)',
        }}
      >
        <Typography.Text strong style={{ fontSize: 13 }}>
          {t('guestInfoTitle', { defaultValue: 'About Guest Access' })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
          {t('guestInfoDescription', {
            defaultValue:
              'Guests have limited access to the selected project only. They can view tasks and collaborate but cannot access other projects or organization settings.',
          })}
        </Typography.Text>
      </Flex>
    </Form>
  );

  // Link invitation tab content
  const linkTabContent = (
    <Flex vertical gap={16}>
      <Form.Item
        label={
          <Typography.Text strong>
            {t('selectProjectLabel', { defaultValue: 'Select Project' })}
          </Typography.Text>
        }
        style={{ marginBottom: 0 }}
      >
        <Select
          showSearch
          placeholder={t('searchProjectPlaceholder', { defaultValue: 'Search for a project...' })}
          suffixIcon={<SearchOutlined />}
          options={projectOptions}
          loading={searchLoading}
          onSearch={handleProjectSearch}
          onChange={handleProjectChange}
          value={form.getFieldValue('projectId')}
          filterOption={false}
          notFoundContent={
            <Typography.Text type="secondary">
              {t('noProjectsFound', { defaultValue: 'No projects found' })}
            </Typography.Text>
          }
        />
      </Form.Item>

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
            !form.getFieldValue('projectId')
              ? t('selectProjectFirst', {
                  defaultValue: 'Select a project first',
                })
              : hasActiveLink && isLinkExpired(linkExpiry)
                ? t('Link expired - click Generate Link', {
                    defaultValue: 'Link expired - click Generate Link',
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
                onClick={handleCopyLink}
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

      <Flex
        vertical
        gap={8}
        style={{
          padding: 12,
          borderRadius: 8,
          background: 'rgba(24, 144, 255, 0.05)',
          border: '1px solid rgba(24, 144, 255, 0.2)',
        }}
      >
        <Typography.Text strong style={{ fontSize: 13 }}>
          {t('guestInfoTitle', { defaultValue: 'About Guest Access' })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
          {t('guestLinkInfo', {
            defaultValue:
              'Share this link with guests to give them access to the selected project. Guests will have limited permissions and can only access this specific project.',
          })}
        </Typography.Text>
      </Flex>
    </Flex>
  );

  const tabItems = [
    {
      key: 'email',
      label: t('Invite with Email', {
        defaultValue: 'Invite with Email',
      }),
      children: emailTabContent,
    },
    {
      key: 'link',
      label: t('Invite with Link', {
        defaultValue: 'Invite with Link',
      }),
      children: linkTabContent,
    },
  ];

  return (
    <Modal
      title={
        <Typography.Text strong style={{ fontSize: 16 }}>
          {t('addGuestTitle', { defaultValue: 'Add Guest to Project' })}
        </Typography.Text>
      }
      open={open}
      onCancel={onClose}
      destroyOnClose
      width={500}
      footer={
        activeTab === 'email' ? (
          <Flex justify="end" gap={8}>
            <Button onClick={onClose}>
              {t('cancelButton', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="primary" onClick={() => form.submit()} loading={loading}>
              {t('inviteGuestButton', { defaultValue: 'Invite Guest' })}
            </Button>
          </Flex>
        ) : (
          <Flex justify="end" gap={8}>
            <Button onClick={onClose}>
              {t('cancelButton', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="primary"
              loading={linkLoading}
              onClick={handleGenerateLink}
              icon={linkCopied ? <CheckOutlined /> : <CopyOutlined />}
              disabled={!form.getFieldValue('projectId')}
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
                      defaultValue: 'Generate & Copy Link',
                    })}
            </Button>
          </Flex>
        )
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
    </Modal>
  );
};

export default AddGuestModal;
