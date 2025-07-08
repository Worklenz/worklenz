import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Button,
  Drawer,
  Flex,
  Form,
  message,
  Select,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { colors } from '@/styles/colors';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { toggleUpdateMemberDrawer } from '../../features/settings/member/memberSlice';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { IJobTitle } from '@/types/job.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import logger from '@/utils/errorLogger';
import { authApiService } from '@/api/auth/auth.api.service';
import { setSession } from '@/utils/session-helper';
import { setUser } from '@/features/user/userSlice';

type UpdateMemberDrawerProps = {
  selectedMemberId: string | null;
  onRoleUpdate?: (memberId: string, newRoleName: string) => void; // Add callback prop
};

const UpdateMemberDrawer = ({ selectedMemberId, onRoleUpdate }: UpdateMemberDrawerProps) => {
  const { t } = useTranslation('settings/team-members');
  const dispatch = useAppDispatch();
  const auth = useAuthService();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resentSuccess, setResentSuccess] = useState(false);
  const [jobTitles, setJobTitles] = useState<IJobTitle[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [teamMember, setTeamMember] = useState<ITeamMemberViewModel | null>({});

  const isDrawerOpen = useAppSelector(state => state.memberReducer.isUpdateMemberDrawerOpen);

  const isOwnAccount = useMemo(() => {
    return auth.getCurrentSession()?.email === teamMember?.email;
  }, [auth, teamMember?.email]);

  const isResendAvailable = useMemo(() => {
    return teamMember?.pending_invitation && selectedMemberId && !resentSuccess;
  }, [teamMember?.pending_invitation, selectedMemberId, resentSuccess]);

  const getJobTitles = async () => {
    try {
      setLoading(true);
      const res = await jobTitlesApiService.getJobTitles(1, 10, null, null, null);
      if (res.done) {
        setJobTitles(res.body.data || []);
      }
    } catch (error) {
      console.error('Error fetching job titles:', error);
      message.error(t('jobTitlesFetchError'));
    } finally {
      setLoading(false);
    }
  };

  const getTeamMember = async () => {
    if (!selectedMemberId) return;

    try {
      const res = await teamMembersApiService.getById(selectedMemberId);
      if (res.done) {
        setTeamMember(res.body);
        form.setFieldsValue({
          jobTitle: jobTitles.find(job => job.id === res.body?.job_title)?.id,
          access: res.body.is_admin ? 'admin' : 'member',
        });
      }
    } catch (error) {
      logger.error('Error fetching team member:', error);
    }
  };

  const handleFormSubmit = async (values: any) => {
    if (!selectedMemberId || !teamMember?.email) return;

    try {
      const body: ITeamMemberCreateRequest = {
        job_title: selectedJobTitle,
        emails: [teamMember.email],
        is_admin: values.access === 'admin',
      };

      const res = await teamMembersApiService.update(selectedMemberId, body);
      if (res.done) {
        form.resetFields();
        setSelectedJobTitle(null);
        dispatch(toggleUpdateMemberDrawer());

        // Update role_name in parent component
        const newRoleName = values.access === 'admin' ? 'admin' : 'member';
        onRoleUpdate?.(selectedMemberId, newRoleName);

        const authorizeResponse = await authApiService.verify();
        if (authorizeResponse.authenticated) {
          setSession(authorizeResponse.user);
          dispatch(setUser(authorizeResponse.user));
        }
      }
    } catch (error) {
      logger.error('Error updating member:', error);
    }
  };

  const resendInvitation = async () => {
    if (!selectedMemberId) return;

    try {
      setResending(true);
      const res = await teamMembersApiService.resendInvitation(selectedMemberId);
      if (res.done) {
        setResentSuccess(true);
        message.success(t('invitationResent'));
      }
    } catch (error) {
      logger.error('Error resending invitation:', error);
    } finally {
      setResending(false);
    }
  };

  const afterOpenChange = (visible: boolean) => {
    if (visible) {
      getJobTitles();
      getTeamMember();
    }
  };

  return (
    <Drawer
      title={
        <Flex gap={8} align="center">
          <Avatar src={teamMember?.avatar_url}>{teamMember?.name?.charAt(0).toUpperCase()}</Avatar>
          <Flex vertical gap={4}>
            <Typography.Text
              style={{
                fontSize: 16,
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {teamMember?.name}
            </Typography.Text>
            <Typography.Text
              type="secondary"
              style={{
                fontSize: 12.8,
                fontWeight: 400,
              }}
            >
              {teamMember?.email}
            </Typography.Text>
          </Flex>
        </Flex>
      }
      open={isDrawerOpen}
      onClose={() => {
        dispatch(toggleUpdateMemberDrawer());
        setTeamMember(null);
        form.resetFields();
      }}
      afterOpenChange={afterOpenChange}
      width={400}
      loading={loading}
      destroyOnClose
    >
      <Form
        form={form}
        onFinish={handleFormSubmit}
        layout="vertical"
        initialValues={{ access: 'member' }}
      >
        <Form.Item label={t('jobTitleLabel')} name="jobTitle">
          <Select
            optionLabelProp="label"
            defaultValue={teamMember?.job_title}
            size="middle"
            placeholder={t('jobTitlePlaceholder')}
            options={jobTitles.map(job => ({
              label: job.name,
              value: job.id,
            }))}
            suffixIcon={false}
            onChange={(value, option) => {
              if (option && 'label' in option) {
                form.setFieldsValue({ jobTitle: option.label || value });
              }
            }}
            onSelect={value => setSelectedJobTitle(value)}
            dropdownRender={menu => (
              <div>
                {loading && <Spin size="small" />}
                {menu}
              </div>
            )}
          />
        </Form.Item>

        <Form.Item label={t('memberAccessLabel')} name="access" rules={[{ required: true }]}>
          <Select
            disabled={isOwnAccount}
            options={[
              { value: 'member', label: t('memberText') },
              { value: 'admin', label: t('adminText') },
            ]}
          />
        </Form.Item>

        <Form.Item>
          <Flex vertical gap={8}>
            <Button type="primary" style={{ width: '100%' }} htmlType="submit">
              {t('updateButton')}
            </Button>
            <Button
              type="dashed"
              loading={resending}
              style={{ width: '100%' }}
              onClick={resendInvitation}
              disabled={!isResendAvailable}
            >
              {t('resendInvitationButton')}
            </Button>
            <Flex vertical style={{ marginBlockStart: 8 }}>
              <Typography.Text
                style={{
                  fontSize: 12,
                  color: colors.lightGray,
                }}
              >
                {t('addedText')}
                <Tooltip title={formatDateTimeWithLocale(teamMember?.created_at || '')}>
                   {calculateTimeDifference(teamMember?.created_at || '')}
                </Tooltip>
              </Typography.Text>
              <Typography.Text
                style={{
                  fontSize: 12,
                  color: colors.lightGray,
                }}
              >
                {t('updatedText')}
                <Tooltip title={formatDateTimeWithLocale(teamMember?.updated_at || '')}>
                   {calculateTimeDifference(teamMember?.updated_at || '')}
                </Tooltip>
              </Typography.Text>
            </Flex>
          </Flex>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default UpdateMemberDrawer;
