import {
  AutoComplete,
  Button,
  Drawer,
  Flex,
  Form,
  message,
  Modal,
  Select,
  Spin,
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
import { LinkOutlined } from '@ant-design/icons';
import { ROLE_NAMES } from '@/types/roles/role.types';

interface FormValues {
  email: string[];
  jobTitle: string;
  access: 'member' | 'team-lead' | 'admin';
}

const InviteTeamMembers = () => {
  const [searching, setSearching] = useState(false);
  const [jobTitles, setJobTitles] = useState<IJobTitle[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form] = Form.useForm<FormValues>();

  const { t } = useTranslation('settings/team-members');
  const isDrawerOpen = useAppSelector(state => state.memberReducer.isInviteMemberDrawerOpen);
  const dispatch = useAppDispatch();

  const handleSearch = useCallback(
    async (value: string) => {
      try {
        setSearching(true);
        const res = await jobTitlesApiService.getJobTitles(1, 10, null, null, value || null);
        if (res.done) {
          setJobTitles(res.body.data || []);
        }
      } catch (error) {
        message.error(t('Failed to fetch job titles'));
      } finally {
        setSearching(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (isDrawerOpen) {
      handleSearch('');
    }
  }, [isDrawerOpen, handleSearch]);

  const handleFormSubmit = async (values: FormValues) => {
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
    dispatch(toggleInviteMemberDrawer());
  };

  const handleEmailChange = (value: string[]) => {
    setEmails(value);
  };

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
      afterOpenChange={visible => visible && handleSearch('')}
      width={400}
      loading={loading}
      footer={
        <Flex justify="space-between">
          {/* <Button
            style={{ width: 140, fontSize: 12 }}
            block
            icon={<LinkOutlined />}
            disabled
          >
            {t('copyTeamLink')}
          </Button> */}
          <Flex justify="end">
            <Button onClick={form.submit} style={{ fontSize: 12 }}>
              {t('addToTeamButton')}
            </Button>
          </Flex>
        </Flex>
      }
    >
      <Form
        form={form}
        onFinish={handleFormSubmit}
        layout="vertical"
        initialValues={{ access: 'member' }}
      >
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

        <Form.Item label={t('jobTitleLabel')} name="jobTitle">
          <AutoComplete
            options={jobTitles.map(job => ({
              id: job.id,
              label: job.name,
              value: job.name,
            }))}
            allowClear
            onSearch={handleSearch}
            placeholder={t('jobTitlePlaceholder')}
            onChange={(value, option) => {
              form.setFieldsValue({ jobTitle: option?.label || value });
            }}
            onSelect={value => setSelectedJobTitle(value)}
            dropdownRender={menu => (
              <div>
                {searching && <Spin size="small" />}
                {menu}
              </div>
            )}
          />
        </Form.Item>

        <Form.Item label={t('memberAccessLabel')} name="access">
          <Select
            options={[
              { value: 'member', label: t('memberText') },
              { value: 'team-lead', label: 'Team Lead' },
              { value: 'admin', label: t('adminText') },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default InviteTeamMembers;
