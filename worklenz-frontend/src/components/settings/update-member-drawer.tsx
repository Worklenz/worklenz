import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Button,
  Drawer,
  Flex,
  Form,
  Input,
  message,
  Select,
  Spin,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { colors } from '@/styles/colors';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { teamManagementApiService } from '@/api/team-management/team-management.api.service';
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
import { ROLE_NAMES } from '@/types/roles/role.types';
import {
  canManageUserRole,
  getAvailableRoleOptions,
  getSessionRoleName,
} from '@/utils/role-permissions.utils';
import { RolePermissionsPopover } from './role-permissions-popover';

type UpdateMemberDrawerProps = {
  selectedMemberId: string | null;
  // Pass the current name from the table row so the drawer title shows
  // the correct (already-updated) name instantly, without waiting for getById
  selectedMemberName?: string | null;
  onNameUpdate?: (memberId: string, newName: string) => void;
  onRoleUpdate?: (memberId: string, newRoleName: string) => void;
  onJobTitleUpdate?: (memberId: string, newJobTitle: string) => void;
  initialRoleName?: string;
};

const UpdateMemberDrawer = ({
  selectedMemberId,
  selectedMemberName,
  onNameUpdate,
  onRoleUpdate,
  onJobTitleUpdate,
  initialRoleName,
}: UpdateMemberDrawerProps) => {
  const { t } = useTranslation('settings/team-members');
  const dispatch = useAppDispatch();
  const auth = useAuthService();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resentSuccess, setResentSuccess] = useState(false);
  const [jobTitles, setJobTitles] = useState<IJobTitle[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [teamMember, setTeamMember] = useState<ITeamMemberViewModel | null>(null);
  const [teamLeads, setTeamLeads] = useState<ITeamMemberViewModel[]>([]);
  const [loadingTeamLeads, setLoadingTeamLeads] = useState(false);

  // Job titles pagination state
  const [jobTitlesLoading, setJobTitlesLoading] = useState(false);
  const [jobTitlesTotal, setJobTitlesTotal] = useState(0);
  const [jobTitlesPage, setJobTitlesPage] = useState(1);
  const jobTitlesPageSize = 10;
  const scrollPositionRef = useRef(0);

  const isDrawerOpen = useAppSelector(state => state.memberReducer.isUpdateMemberDrawerOpen);

  // Use the name from the parent table row while the drawer is loading its own fetch.
  // Once getById completes, teamMember.name takes over (which will be the same value).
  // This prevents the flash: updated name → old name → updated name.
  const displayName = teamMember?.name ?? selectedMemberName ?? '';

  const isOwnAccount = useMemo(() => {
    return auth.getCurrentSession()?.email === teamMember?.email;
  }, [auth, teamMember?.email]);

  const currentUser = auth.getCurrentSession();
  const currentUserRole = getSessionRoleName(currentUser);
  const canManageTarget = useMemo(() => {
    if (currentUserRole === ROLE_NAMES.ADMIN) {
      return teamMember?.role_name?.toLowerCase() !== 'owner';
    }
    return canManageUserRole(currentUser?.role_name, teamMember?.role_name, currentUser?.owner);
  }, [currentUser?.role_name, currentUser?.owner, currentUserRole, teamMember?.role_name]);

  const canEditOwnAccount = useMemo(() => {
    return isOwnAccount && currentUser?.owner;
  }, [isOwnAccount, currentUser?.owner]);

  const availableRoles = useMemo(() => {
    return getAvailableRoleOptions(currentUser?.role_name, currentUser?.owner);
  }, [currentUser?.role_name, currentUser?.owner]);

  const translatedRoleOptions = useMemo(
    () =>
      availableRoles.map(role => ({
        value:
          role.value === ROLE_NAMES.MEMBER
            ? 'member'
            : role.value === ROLE_NAMES.TEAM_LEAD
              ? 'team-lead'
              : role.value === ROLE_NAMES.ADMIN
                ? 'admin'
                : role.value.toLowerCase(),
        label: t(role.labelKey || 'memberText', {
          defaultValue: role.labelDefaultValue || role.label,
        }),
        description: role.descriptionKey
          ? t(role.descriptionKey, {
              defaultValue: role.descriptionDefaultValue || role.description,
            })
          : undefined,
      })),
    [availableRoles, t]
  );

  const isResendAvailable = useMemo(() => {
    return teamMember?.pending_invitation && selectedMemberId && !resentSuccess;
  }, [teamMember?.pending_invitation, selectedMemberId, resentSuccess]);

  const getJobTitles = async (page: number = 1, append: boolean = false) => {
    try {
      setJobTitlesLoading(true);
      const res = await jobTitlesApiService.getJobTitles(page, jobTitlesPageSize, null, null, null);
      if (res.done) {
        const newJobTitles = res.body.data || [];
        const total = res.body.total || 0;

        setJobTitles(prev => (append ? [...prev, ...newJobTitles] : newJobTitles));
        setJobTitlesTotal(total);
      }
    } catch (error) {
      logger.error('Error fetching job titles:', error);
      message.error(t('jobTitlesFetchError'));
    } finally {
      setJobTitlesLoading(false);
    }
  };

  const getTeamLeads = async () => {
    try {
      setLoadingTeamLeads(true);
      const res = await teamMembersApiService.get(1, 1000, 'name', 'asc', '', true);
      if (res.done) {
        const leads =
          res.body.data?.filter(m => m.id !== selectedMemberId && m.role_name === 'Team Lead') ||
          [];
        setTeamLeads(leads);
      }
    } catch (error) {
      logger.error('Error fetching team leads:', error);
    } finally {
      setLoadingTeamLeads(false);
    }
  };

  // Handle scroll to load more job titles
  const handleJobTitleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Check if scrolled to the very end of the list
    if (scrollTop + clientHeight >= scrollHeight) {
      const hasMore = jobTitles.length < jobTitlesTotal;
      if (hasMore && !jobTitlesLoading) {
        const nextPage = jobTitlesPage + 1;
        setJobTitlesPage(nextPage);
        getJobTitles(nextPage, true);
      }
    }

    scrollPositionRef.current = scrollTop;
  };

  const getTeamMember = async () => {
    if (!selectedMemberId) return;

    try {
      setLoading(true);
      const res = await teamMembersApiService.getById(selectedMemberId);
      if (res.done) {
        setTeamMember(res.body);

        let accessLevel = 'member';
        const roleNameToUse = res.body.role_name || initialRoleName;
        const roleName = (roleNameToUse || '').toLowerCase().trim();

        if (roleName === 'owner') {
          accessLevel = 'owner';
        } else if (roleName === 'admin') {
          accessLevel = 'admin';
        } else if (roleName === 'team lead' || roleName === 'teamlead') {
          accessLevel = 'team-lead';
        } else {
          accessLevel = 'member';
        }

        setTimeout(() => {
          form.setFieldsValue({
            name: res.body?.name,
            jobTitle: res.body?.job_title,
            access: accessLevel,
            manager: res.body?.reports_to_member_id || null,
          });
        }, 0);
      }
    } catch (error) {
      logger.error('Error fetching team member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (values: any) => {
    if (!selectedMemberId || !teamMember?.email) return;
    const accessValue = form.getFieldValue('access') ?? values.access;
    const trimmedName = (values.name || '').trim();

    try {
      if (trimmedName && trimmedName !== teamMember.name) {
        const nameResponse = await teamMembersApiService.updateMemberName(
          selectedMemberId,
          trimmedName
        );

        if (!nameResponse.done) {
          throw new Error(nameResponse.message || t('updateMemberNameErrorMessage'));
        }
      }

      const body: ITeamMemberCreateRequest = {
        job_title: form.getFieldValue('jobTitle'),
        emails: [teamMember.email],
        is_admin: accessValue === 'admin' || accessValue === 'owner',
        role_name:
          accessValue === 'owner'
            ? ROLE_NAMES.OWNER
            : accessValue === 'team-lead'
              ? ROLE_NAMES.TEAM_LEAD
              : accessValue === 'admin'
                ? ROLE_NAMES.ADMIN
                : ROLE_NAMES.MEMBER,
      };

      const res = await teamMembersApiService.update(selectedMemberId, body);
      if (res.done) {
        const currentManagerId = teamMember?.reports_to_member_id;
        const newManagerId = values.manager;

        if (currentManagerId !== newManagerId) {
          if (newManagerId) {
            await teamManagementApiService.assignManager(selectedMemberId, newManagerId);
          } else if (currentManagerId) {
            await teamManagementApiService.removeManagerAssignment(selectedMemberId);
          }
        }
        const selectedJobTitleId = form.getFieldValue('jobTitle');
        const resolvedJobTitle =
          jobTitles.find(j => j.id === selectedJobTitleId)?.name ?? selectedJobTitleId ?? '';

        form.resetFields();
        setSelectedJobTitle(null);
        dispatch(toggleUpdateMemberDrawer());
        const resolvedName = trimmedName || teamMember.name || '';

        const newRoleName =
          accessValue === 'owner'
            ? 'Owner'
            : accessValue === 'team-lead'
              ? 'Team Lead'
              : accessValue === 'admin'
                ? 'Admin'
                : 'Member';
        onNameUpdate?.(selectedMemberId, resolvedName);
        onRoleUpdate?.(selectedMemberId, newRoleName);
        onJobTitleUpdate?.(selectedMemberId, resolvedJobTitle);
        setTeamMember(prev => (prev ? { ...prev, name: resolvedName } : prev));

        const authorizeResponse = await authApiService.verify();
        if (authorizeResponse.authenticated) {
          setSession(authorizeResponse.user);
          dispatch(setUser(authorizeResponse.user));
        }
      }
    } catch (error) {
      logger.error('Error updating member:', error);
      message.error(t('updateError'));
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

  const afterOpenChange = async (visible: boolean) => {
    if (visible) {
      form.resetFields();
      // Reset job titles pagination state
      setJobTitles([]);
      setJobTitlesPage(1);
      setJobTitlesTotal(0);
      scrollPositionRef.current = 0;

      await Promise.all([getJobTitles(1, false), getTeamMember(), getTeamLeads()]);
    } else {
      setTeamMember(null);
      setResentSuccess(false);
    }
  };

  useEffect(() => {
    if (teamMember && isDrawerOpen) {
      const roleNameToUse = teamMember.role_name || initialRoleName;
      const roleName = (roleNameToUse || '').toLowerCase().trim();
      let accessLevel = 'member';

      if (roleName === 'owner') {
        accessLevel = 'owner';
      } else if (roleName === 'admin') {
        accessLevel = 'admin';
      } else if (roleName === 'team lead' || roleName === 'teamlead') {
        accessLevel = 'team-lead';
      }

      form.setFieldsValue({
        name: teamMember.name,
        jobTitle: teamMember.job_title,
        access: accessLevel,
        manager: teamMember.reports_to_member_id || null,
      });
    }
  }, [teamMember, isDrawerOpen, initialRoleName, form]);

  const canBeAssignedToManager = useMemo(() => {
    const roleName = teamMember?.role_name || '';
    return !['Owner', 'Admin', 'Team Lead'].includes(roleName);
  }, [teamMember?.role_name]);

  return (
    <Drawer
      title={
        <Flex gap={8} align="center">
          <Avatar src={teamMember?.avatar_url}>{displayName?.charAt(0).toUpperCase()}</Avatar>
          <Flex vertical gap={4}>
            <Typography.Text
              style={{
                fontSize: 16,
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {/* Use displayName so the correct (updated) name shows immediately
                  while getById is still in flight, preventing the old-name flash */}
              {displayName}
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
        setResentSuccess(false);
      }}
      afterOpenChange={afterOpenChange}
      width={400}
      loading={loading}
      destroyOnClose
    >
      <Form form={form} onFinish={handleFormSubmit} layout="vertical">
        <Form.Item
          label={t('nameColumn', { defaultValue: 'Name' })}
          name="name"
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('memberNameRequiredError', {
                defaultValue: 'Please enter a member name.',
              }),
            },
          ]}
        >
          <Input
            placeholder={t('memberNamePlaceholder', {
              defaultValue: 'Enter member name',
            })}
            disabled={isOwnAccount ? !canEditOwnAccount : !canManageTarget}
          />
        </Form.Item>

        <Form.Item label={t('jobTitleLabel')} name="jobTitle">
          <Select
            optionLabelProp="label"
            size="middle"
            placeholder={t('jobTitlePlaceholder')}
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
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
            onPopupScroll={handleJobTitleScroll}
            loading={jobTitlesLoading && jobTitles.length === 0}
            notFoundContent={
              jobTitlesLoading && jobTitles.length === 0 ? <Spin size="small" /> : null
            }
            dropdownRender={menu => (
              <div>
                {menu}
                {jobTitlesLoading && jobTitles.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '8px' }}>
                    <Spin size="small" />
                  </div>
                )}
              </div>
            )}
          />
        </Form.Item>

        <Form.Item
          label={
            <Flex align="center" gap={6}>
              <span>{t('memberAccessLabel', { defaultValue: 'Access Level' })}</span>
              <RolePermissionsPopover />
            </Flex>
          }
          name="access"
          rules={[{ required: true }]}
        >
          <Select
            disabled={isOwnAccount ? !canEditOwnAccount : !canManageTarget}
            options={translatedRoleOptions}
            optionRender={option => (
              <Flex vertical gap={2} style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>
                <Typography.Text>{String(option.data.label)}</Typography.Text>
                {option.data.description && (
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, whiteSpace: 'normal', lineHeight: 1.4 }}
                  >
                    {option.data.description}
                  </Typography.Text>
                )}
              </Flex>
            )}
          />
        </Form.Item>

        {canBeAssignedToManager && (
          <Form.Item
            label={
              <Flex align="center" gap={4}>
                <span>{t('managerLabel')}</span>
                <Tooltip title={t('managerTooltip')}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('optionalFieldLabel', { defaultValue: '(Optional)' })}
                  </Typography.Text>
                </Tooltip>
              </Flex>
            }
            name="manager"
          >
            <Select
              allowClear
              placeholder={t('selectManagerPlaceholder')}
              loading={loadingTeamLeads}
              disabled={!canManageTarget}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={teamLeads.map(lead => ({
                value: lead.id,
                label: lead.name,
              }))}
              notFoundContent={
                loadingTeamLeads ? (
                  <Spin size="small" />
                ) : (
                  <Typography.Text type="secondary" style={{ padding: 8, display: 'block' }}>
                    {t('noTeamLeadsAvailable')}
                  </Typography.Text>
                )
              }
            />
          </Form.Item>
        )}

        <Form.Item>
          <Flex vertical gap={8}>
            <Button
              type="primary"
              style={{ width: '100%' }}
              htmlType="submit"
              disabled={isOwnAccount ? !canEditOwnAccount : !canManageTarget}
            >
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
              <Typography.Text style={{ fontSize: 12, color: colors.lightGray }}>
                {t('addedText')}
                {''}
                <Tooltip title={formatDateTimeWithLocale(teamMember?.created_at || '')}>
                  {calculateTimeDifference(teamMember?.created_at || '')}
                </Tooltip>
              </Typography.Text>
              <Typography.Text style={{ fontSize: 12, color: colors.lightGray }}>
                {t('updatedText')}
                {''}
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
