import { Avatar, Button, Input, Popconfirm, Table, TableProps, Select, Flex } from 'antd';
import React, { useEffect, useState } from 'react';
import CustomAvatar from '../../../../../../components/CustomAvatar';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { JobRoleType, IJobType, RatecardType } from '@/types/project/ratecard.types';
import {
  assignMemberToRateCardRole,
  deleteProjectRateCardRoleById,
  fetchProjectRateCardRoles,
  insertProjectRateCardRole,
  updateProjectRateCardRoleById,
  updateProjectRateCardRolesByProjectId,
} from '@/features/finance/project-finance-slice';
import { useParams } from 'react-router-dom';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import RateCardAssigneeSelector from '@/components/project-ratecard/ratecard-assignee-selector';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectMemberViewModel } from '@/types/projectMember.types';
import { parse } from 'path';

const RatecardTable: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view-finance');
  const { projectId } = useParams();

  // Redux state
  const rolesRedux = useAppSelector((state) => state.projectFinanceRateCard.rateCardRoles) || [];
  const isLoading = useAppSelector((state) => state.projectFinanceRateCard.isLoading);
  const currency = useAppSelector((state) => state.financeReducer.currency).toUpperCase();

  // Local state for editing
  const [roles, setRoles] = useState<JobRoleType[]>(rolesRedux);
  const [addingRow, setAddingRow] = useState<boolean>(false);
  const [jobTitles, setJobTitles] = useState<RatecardType[]>([]);
  const [members, setMembers] = useState<IProjectMemberViewModel[]>([]);
  const [isLoadingMembers, setIsLoading] = useState(false);

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

  // Add new role row
  const handleAddRole = () => {
    setAddingRow(true);
  };

  // Save all roles (bulk update)
  const handleSaveAll = () => {
    if (projectId) {
      const filteredRoles = roles
        .filter((r) => r.job_title_id && typeof r.rate !== 'undefined')
        .map((r) => ({
          job_title_id: r.job_title_id,
          jobtitle: r.jobtitle || r.name || '',
          rate: Number(r.rate),
        }));
      dispatch(updateProjectRateCardRolesByProjectId({ project_id: projectId, roles: filteredRoles }));
    }
  };

  // Handle job title select for new row
  const handleSelectJobTitle = async (jobTitleId: string) => {
    const jobTitle = jobTitles.find((jt) => jt.id === jobTitleId);
    if (!jobTitle || !projectId) return;
    if (roles.some((r) => r.job_title_id === jobTitleId)) return;
    const resultAction = await dispatch(
      insertProjectRateCardRole({ project_id: projectId, job_title_id: jobTitleId, rate: 0 })
    );

    if (insertProjectRateCardRole.fulfilled.match(resultAction)) {
      const newRole = resultAction.payload;
      setRoles([
        ...roles,
        {
          id: newRole.id,
          job_title_id: newRole.job_title_id,
          jobtitle: newRole.jobtitle,
          rate: newRole.rate,
          members: [], // Initialize members array
        },
      ]);
    }
    setAddingRow(false);
  };

  // Handle rate change
  const handleRateChange = (value: string | number, index: number) => {
    const updatedRoles = roles.map((role, idx) =>
      idx === index ? { ...role, rate: Number(value) } : role
    );
    setRoles(updatedRoles);
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
        setRoles((prev) =>
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
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {jobTitles
                .filter((jt) => !roles.some((role) => role.job_title_id === jt.id))
                .map((jt) => (
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
      title: `${t('ratePerHourColumn')} (${currency})`,
      dataIndex: 'rate',
      align: 'right',
      render: (value: number, record: JobRoleType, index: number) => (
        <Input
          type="number"
          value={roles[index]?.rate ?? 0}
          min={0}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: 0,
            width: 80,
            textAlign: 'right',
          }}
          onChange={(e) => handleRateChange(e.target.value, index)}
          onBlur={(e) => {
            if (e.target.value !== roles[index].rate) {
              dispatch(updateProjectRateCardRoleById({
                id: roles[index].id!,
                body: {
                  job_title_id: roles[index].job_title_id,
                  rate: e.target.value,
                }
              }));
            }
          }}
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
              const member = members.find((m) => m.id === memberId);
              return member ? (
                <CustomAvatar key={i} avatarName={member.name} size={26} />
              ) : null;
            })}
          </Avatar.Group>
          <div>
            <RateCardAssigneeSelector
              projectId={projectId as string}
              selectedMemberIds={memberscol || []}
              onChange={(memberId) => handleMemberChange(memberId, index, record)}
              memberlist={members}
            />
          </div>
        </div>
      ),
    },
    {
      title: t('actions'),
      key: 'actions',
      align: 'center',
      render: (_: any, record: JobRoleType, index: number) => (
        <Popconfirm
          title={t('deleteConfirm')}
          onConfirm={() => handleDelete(record, index)}
          okText={t('yes')}
          cancelText={t('no')}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
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
          <Button type="dashed" onClick={handleAddRole} style={{ width: 'fit-content' }}>
            {t('addRoleButton')}
          </Button>
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

export default RatecardTable;