import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Select,
  Flex,
  InputRef,
  DeleteOutlined,
} from '@/shared/antd-imports';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CustomAvatar from '@/components/CustomAvatar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { JobRoleType, RatecardType } from '@/types/project/ratecard.types';
import {
  assignMemberToRateCardRole,
  deleteProjectRateCardRoleById,
  fetchProjectRateCardRoles,
  insertProjectRateCardRole,
  updateProjectRateCardRoleById,
  updateProjectRateCardRolesByProjectId,
} from '@/features/finance/project-finance-slice';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectMemberViewModel } from '@/types/projectMember.types';
import { useAuthService } from '@/hooks/useAuth';
import { canEditRateCard, canAddMembersToRateCard } from '@/utils/finance-permissions';
import RateCardAssigneeSelector from '../../project-ratecard/RateCardAssigneeSelector';

const RateCardTable: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view-finance');
  const { projectId } = useParams();

  // Redux state
  const rolesRedux =
    useAppSelector(state => state.projectFinanceRateCardReducer.rateCardRoles) || [];
  const isLoading = useAppSelector(state => state.projectFinanceRateCardReducer.isLoading);
  const currency = useAppSelector(
    state => state.projectFinancesReducer.project?.currency || 'USD'
  ).toUpperCase();
  const financeProject = useAppSelector(state => state.projectFinancesReducer.project);

  // Get calculation method from project finance data
  const calculationMethod = financeProject?.calculation_method || 'hourly';
  const rateInputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  // Auth and permissions
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const { project } = useAppSelector(state => state.projectReducer);
  const hasEditPermission = canEditRateCard(currentSession, project);
  const canAddMembers = canAddMembersToRateCard(currentSession, project);

  // Local state for editing
  const [roles, setRoles] = useState<JobRoleType[]>(rolesRedux);
  const [addingRow, setAddingRow] = useState<boolean>(false);
  const [jobTitles, setJobTitles] = useState<RatecardType[]>([]);
  const [members, setMembers] = useState<IProjectMemberViewModel[]>([]);
  const [isLoadingMembers, setIsLoading] = useState(false);
  const [focusRateIndex, setFocusRateIndex] = useState<number | null>(null);

  const pagination = {
    current: 1,
    pageSize: 1000,
    field: 'name',
    order: 'asc',
  };

  const getProjectMembers = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await projectsApiService.getMembers(
        projectId,
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        null
      );
      if (res.done) {
        setMembers(res.body?.data || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getProjectMembers();
  }, [projectId]);

  // Fetch job titles for selection
  useEffect(() => {
    (async () => {
      const res = await jobTitlesApiService.getJobTitles(1, 1000, 'name', 'asc', '');
      setJobTitles(res.body?.data || []);
    })();
  }, []);

  // Sync local roles with redux roles
  useEffect(() => {
    setRoles(rolesRedux);
  }, [rolesRedux]);

  // Fetch roles on mount
  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjectRateCardRoles(projectId));
    }
  }, [dispatch, projectId]);

  useEffect(() => {
    if (focusRateIndex !== null && rateInputRefs.current[focusRateIndex]) {
      rateInputRefs.current[focusRateIndex]?.focus();
      setFocusRateIndex(null);
    }
  }, [roles, focusRateIndex]);

  // Add new role row
  const handleAddRole = () => {
    setAddingRow(true);
  };

  // Save all roles (bulk update)
  const handleSaveAll = () => {
    if (projectId) {
      const filteredRoles = roles
        .filter(
          r => typeof r.job_title_id === 'string' && r.job_title_id && typeof r.rate !== 'undefined'
        )
        .map(r => ({
          job_title_id: r.job_title_id as string,
          jobtitle: r.jobtitle || r.name || '',
          rate: Number(r.rate ?? 0),
          man_day_rate: Number(r.man_day_rate ?? 0),
        }));
      dispatch(
        updateProjectRateCardRolesByProjectId({ project_id: projectId, roles: filteredRoles })
      );
    }
  };

  // In handleSelectJobTitle, after successful insert, update the rate if needed
  const handleSelectJobTitle = async (jobTitleId: string) => {
    const jobTitle = jobTitles.find(jt => jt.id === jobTitleId);
    if (!jobTitle || !projectId) return;
    if (roles.some(r => r.job_title_id === jobTitleId)) return;

    // Set the appropriate rate based on calculation method
    const isManDays = calculationMethod === 'man_days';
    const resultAction = await dispatch(
      insertProjectRateCardRole({
        project_id: projectId,
        job_title_id: jobTitleId,
        rate: 0, // Always initialize rate as 0
        man_day_rate: isManDays ? 0 : undefined, // Only set man_day_rate for man_days mode
      })
    );

    if (insertProjectRateCardRole.fulfilled.match(resultAction)) {
      // Re-fetch roles and focus the last one (newly added)
      dispatch(fetchProjectRateCardRoles(projectId)).then(() => {
        setFocusRateIndex(roles.length); // The new row will be at the end
      });
    }
    setAddingRow(false);
  };

  // Update handleRateChange to update the correct field
  const handleRateChange = (value: string | number, index: number) => {
    setRoles(prev =>
      prev.map((role, idx) =>
        idx === index
          ? {
              ...role,
              ...(calculationMethod === 'man_days'
                ? { man_day_rate: Number(value) }
                : { rate: Number(value) }),
            }
          : role
      )
    );
  };

  // Handle delete
  const handleDelete = (record: JobRoleType, index: number) => {
    if (record.id) {
      dispatch(deleteProjectRateCardRoleById(record.id));
    } else {
      setRoles(roles.filter((_, idx) => idx !== index));
    }
  };

  // Handle member change
  const handleMemberChange = async (memberId: string, rowIndex: number, record: JobRoleType) => {
    if (!projectId || !record.id) return; // Ensure required IDs are present
    try {
      const resultAction = await dispatch(
        assignMemberToRateCardRole({
          project_id: projectId,
          member_id: memberId,
          project_rate_card_role_id: record.id,
        })
      );
      if (assignMemberToRateCardRole.fulfilled.match(resultAction)) {
        const updatedMembers = resultAction.payload; // Array of member IDs
        setRoles(prev =>
          prev.map((role, idx) => {
            if (idx !== rowIndex) return role;
            return { ...role, members: updatedMembers?.members || [] };
          })
        );
      }
    } catch (error) {
      console.error('Error assigning member:', error);
    }
  };
  // Separate function for updating rate if changed
  const handleRateBlur = (value: string, index: number) => {
    const isManDays = calculationMethod === 'man_days';
    // Compare with Redux value, not local state
    const reduxRole = rolesRedux[index];
    const reduxValue = isManDays
      ? String(reduxRole?.man_day_rate ?? 0)
      : String(reduxRole?.rate ?? 0);
    if (value !== reduxValue) {
      const payload = {
        id: roles[index].id!,
        body: {
          job_title_id: String(roles[index].job_title_id),
          // Only update the field that corresponds to the current calculation method
          ...(isManDays
            ? {
                rate: String(reduxRole?.rate ?? 0), // Keep existing rate value
                man_day_rate: String(value), // Update man_day_rate with new value
              }
            : {
                rate: String(value), // Update rate with new value
                man_day_rate: String(reduxRole?.man_day_rate ?? 0), // Keep existing man_day_rate value
              }),
        },
      };
      dispatch(updateProjectRateCardRoleById(payload));
    }
  };

  const assignedMembers = roles
    .flatMap(role => role.members || [])
    .filter((memberId, index, self) => self.indexOf(memberId) === index);

  // Columns
  const columns: TableProps<JobRoleType>['columns'] = [
    {
      title: t('jobTitleColumn'),
      dataIndex: 'jobtitle',
      render: (text: string, record: JobRoleType, index: number) => {
        if (addingRow && index === roles.length) {
          return (
            <Select
              showSearch
              autoFocus
              placeholder={t('selectJobTitle')}
              style={{ minWidth: 150 }}
              value={record.job_title_id || undefined}
              onChange={handleSelectJobTitle}
              onBlur={() => setAddingRow(false)}
              filterOption={(input, option) =>
                ((option?.children as unknown as string) || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {jobTitles
                .filter(jt => !roles.some(role => role.job_title_id === jt.id))
                .map(jt => (
                  <Select.Option key={jt.id} value={jt.id!}>
                    {jt.name}
                  </Select.Option>
                ))}
            </Select>
          );
        }
        return <span>{text || record.name}</span>;
      },
    },
    {
      title: `${calculationMethod === 'man_days' ? t('ratePerManDayColumn') : t('ratePerHourColumn')} (${currency})`,
      dataIndex: 'rate',
      align: 'right',
      render: (value: number, record: JobRoleType, index: number) => (
        <Input
          ref={(el: InputRef | null) => {
            if (el) rateInputRefs.current[index] = el as unknown as HTMLInputElement;
          }}
          type="number"
          value={
            calculationMethod === 'man_days'
              ? (roles[index]?.man_day_rate ?? 0)
              : (roles[index]?.rate ?? 0)
          }
          min={0}
          disabled={!hasEditPermission}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: 0,
            width: 80,
            textAlign: 'right',
            opacity: hasEditPermission ? 1 : 0.7,
            cursor: hasEditPermission ? 'text' : 'not-allowed',
          }}
          onChange={
            hasEditPermission
              ? e => handleRateChange((e.target as HTMLInputElement).value, index)
              : undefined
          }
          onBlur={
            hasEditPermission
              ? e => handleRateBlur((e.target as HTMLInputElement).value, index)
              : undefined
          }
          onPressEnter={
            hasEditPermission
              ? e => handleRateBlur((e.target as HTMLInputElement).value, index)
              : undefined
          }
        />
      ),
    },
    {
      title: t('membersColumn'),
      dataIndex: 'members',
      render: (memberscol: string[] | null | undefined, record: JobRoleType, index: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
          <Avatar.Group>
            {memberscol?.map((memberId, i) => {
              const member = members.find(m => m.id === memberId);
              return member ? (
                <CustomAvatar key={i} avatarName={member.name || ''} size={26} />
              ) : null;
            })}
          </Avatar.Group>
          {canAddMembers && (
            <div>
              <RateCardAssigneeSelector
                projectId={projectId as string}
                selectedMemberIds={memberscol || []}
                onChange={(memberId: string) => handleMemberChange(memberId, index, record)}
                memberlist={members}
                assignedMembers={assignedMembers} // Pass assigned members here
              />
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('actions'),
      key: 'actions',
      align: 'center',
      render: (_: any, record: JobRoleType, index: number) =>
        hasEditPermission ? (
          <Popconfirm
            title={t('deleteConfirm')}
            onConfirm={() => handleDelete(record, index)}
            okText={t('yes')}
            cancelText={t('no')}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <Table
      dataSource={
        addingRow
          ? [
              ...roles,
              {
                job_title_id: '',
                jobtitle: '',
                rate: 0,
                members: [],
              },
            ]
          : roles
      }
      columns={columns}
      rowKey={(record, idx) => record.id || record.job_title_id || String(idx)}
      pagination={false}
      loading={isLoading || isLoadingMembers}
      footer={() => (
        <Flex gap={0}>
          {hasEditPermission && (
            <Button type="dashed" onClick={handleAddRole} style={{ width: 'fit-content' }}>
              {t('addRoleButton')}
            </Button>
          )}
          {/* <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveAll}
            disabled={roles.length === 0}
          >
            {t('saveButton') || 'Save'}
          </Button> */}
        </Flex>
      )}
    />
  );
};

export default RateCardTable;
