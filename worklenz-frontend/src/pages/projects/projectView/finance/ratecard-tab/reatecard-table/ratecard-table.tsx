import { Avatar, Button, Input, Popconfirm, Table, TableProps, Select, Flex } from 'antd';
import React, { useEffect, useState } from 'react';
import CustomAvatar from '../../../../../../components/CustomAvatar';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { JobRoleType, IJobType } from '@/types/project/ratecard.types';
import {
  deleteProjectRateCardRoleById,
  fetchProjectRateCardRoles,
  updateProjectRateCardRolesByProjectId,
} from '@/features/finance/project-finance-slice';
import { useParams } from 'react-router-dom';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [jobTitles, setJobTitles] = useState<RatecardType[]>([]);

  // Fetch job titles for selection
  useEffect(() => {
    (async () => {
      const res = await jobTitlesApiService.getJobTitles(1, 1000, 'name', 'asc', '');
      setJobTitles(res.body?.data || []);
    })();
  }, []);

  // Sync local roles with redux roles
  useEffect(() => {
    console.log('Roles Redux:', rolesRedux);
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
      // Only send roles with job_title_id and rate
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
  const handleSelectJobTitle = (jobTitleId: string) => {
    const jobTitle = jobTitles.find((jt) => jt.id === jobTitleId);
    if (!jobTitle) return;
    // Prevent duplicates
    if (roles.some((r) => r.job_title_id === jobTitleId)) return;
    setRoles([
      ...roles,
      {
        job_title_id: jobTitleId,
        jobtitle: jobTitle.name || '',
        rate: 0,
        members: [],
      },
    ]);
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
      // Remove unsaved row
      setRoles(roles.filter((_, idx) => idx !== index));
    }
  };

  // Columns
  const columns: TableProps<JobRoleType>['columns'] = [
    {
      title: t('jobTitleColumn'),
      dataIndex: 'jobtitle',
      render: (text: string, record: JobRoleType, index: number) => {
        // Only show Select if addingRow and this is the last row (new row)
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
                (option?.children as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {jobTitles
                .filter(jt => !roles.some((role) => role.job_title_id === jt.id))
                .map(jt => (
                  <Select.Option key={jt.id} value={jt.id!}>
                    {jt.name}
                  </Select.Option>
                ))}
            </Select>
          );
        }
        return (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => setEditingIndex(index)}
          >
            {text || record.name}
          </span>
        );
      },
    },
    {
      title: `${t('ratePerHourColumn')} (${currency})`,
      dataIndex: 'rate',
      render: (value: number, record: JobRoleType, index: number) => (
        <Input
          type="number"
          value={roles[index]?.rate ?? 0}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: 0,
            width: 80,
          }}
          onChange={(e) => handleRateChange(e.target.value, index)}
        />
      ),
    },
    {
      title: t('membersColumn'),
      dataIndex: 'members',
      render: (members: string[] | null | undefined) =>
        members && members.length > 0 ? (
          <Avatar.Group>
            {members.map((member, i) => (
              <CustomAvatar key={i} avatarName={member} size={26} />
            ))}
          </Avatar.Group>
        ) : (
          <Button
            shape="circle"
            icon={
              <PlusOutlined
                style={{
                  fontSize: 12,
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            }
          />
        ),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: JobRoleType, index: number) => (
        <Popconfirm
          title={t('deleteConfirm')}
          onConfirm={() => handleDelete(record, index)}
          okText={t('yes')}
          cancelText={t('no')}
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
          />
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
      rowKey={(record, idx) => record.id || record.job_title_id || idx}
      pagination={false}
      loading={isLoading}
      footer={() => (
        <Flex gap={8}>
          <Button
            type="dashed"
            onClick={handleAddRole}
            style={{ width: 'fit-content' }}
          >
            {t('addRoleButton')}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveAll}
            disabled={roles.length === 0}
          >
            {t('saveButton') || 'Save'}
          </Button>
        </Flex>
      )}
    />
  );
};

export default RatecardTable;