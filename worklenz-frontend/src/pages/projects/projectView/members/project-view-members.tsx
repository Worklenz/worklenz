// Ant Design Components
import {
  Avatar,
  Button,
  Card,
  Flex,
  Popconfirm,
  Progress,
  Skeleton,
  Table,
  TableProps,
  Tooltip,
  Typography,
  Input,
} from '@/shared/antd-imports';

// Icons
import { DeleteOutlined, ExclamationCircleFilled, SyncOutlined } from '@/shared/antd-imports';

// React & Router
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Services & API
import { projectsApiService } from '@/api/projects/projects.api.service';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { useAuthService } from '@/hooks/useAuth';

// Types
import { IProjectMembersViewModel, IProjectMemberViewModel } from '@/types/projectMember.types';

// Constants & Utils
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { colors } from '../../../../styles/colors';
import logger from '@/utils/errorLogger';

// Components
import EmptyListPlaceholder from '../../../../components/EmptyListPlaceholder';
import { useAppSelector } from '@/hooks/useAppSelector';
import { evt_project_members_visit } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

interface PaginationType {
  current: number;
  pageSize: number;
  field: string;
  order: string;
  total: number;
  pageSizeOptions: string[];
  size: 'small' | 'default';
}

const ProjectViewMembers = () => {
  // Hooks
  const { projectId } = useParams();
  const { t } = useTranslation('project-view-members');
  const auth = useAuthService();
  const user = auth.getCurrentSession();
  const isOwnerOrAdmin = auth.isOwnerOrAdmin();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<IProjectMembersViewModel>();
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'ascend',
    total: 0,
    pageSizeOptions: ['10', '20', '50', '100'],
    size: 'small',
  });
  const [searchQuery, setSearchQuery] = useState(''); // <-- Add search state

  // API Functions
  const getProjectMembers = async (search: string = searchQuery) => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const offset = (pagination.current - 1) * pagination.pageSize;
      const res = await projectsApiService.getMembers(
        projectId,
        pagination.current, // index
        pagination.pageSize, // size             // offset
        pagination.field,
        pagination.order,
        search
      );
      if (res.done) {
        setMembers(res.body);
        setPagination(p => ({ ...p, total: res.body.total ?? 0 })); // update total from backend, default to 0
      }
    } catch (error) {
      logger.error('Error fetching members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMember = async (memberId: string | undefined) => {
    if (!memberId || !projectId) return;

    try {
      const res = await projectMembersApiService.deleteProjectMember(memberId, projectId);
      if (res.done) {
        void getProjectMembers();
      }
    } catch (error) {
      logger.error('Error deleting member:', error);
    }
  };

  // Helper Functions
  const checkDisabled = (record: IProjectMemberViewModel): boolean => {
    if (!isOwnerOrAdmin) return true;
    if (user?.team_member_id === record.team_member_id) return true;
    return false;
  };

  const calculateProgressPercent = (completed: number = 0, total: number = 0): number => {
    if (total === 0) return 0;
    return Math.floor((completed / total) * 100);
  };

  const handleTableChange = (tablePagination: any, filters: any, sorter: any) => {
    setPagination(prev => ({
      ...prev,
      current: tablePagination.current,
      pageSize: tablePagination.pageSize,
      field: sorter.field || prev.field,
      order: sorter.order || prev.order,
    }));
  };

  // Effects
  useEffect(() => {
    void getProjectMembers();
  }, [
    refreshTimestamp,
    projectId,
    pagination.current,
    pagination.pageSize,
    pagination.field,
    pagination.order,
    // searchQuery, // <-- Do NOT include here, search is triggered manually
  ]);

  useEffect(() => {
    trackMixpanelEvent(evt_project_members_visit);
  }, []);

  // Table Configuration
  const columns: TableProps['columns'] = [
    {
      key: 'memberName',
      title: t('nameColumn'),
      dataIndex: 'name',
      sorter: true,
      sortOrder:
        pagination.order === 'ascend' && pagination.field === 'name'
          ? 'ascend'
          : pagination.order === 'descend' && pagination.field === 'name'
            ? 'descend'
            : null,
      render: (_, record: IProjectMemberViewModel) => (
        <Flex gap={8} align="center">
          <Avatar size={28} src={record.avatar_url}>
            {record.name?.charAt(0)}
          </Avatar>
          <Typography.Text>{record.name}</Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'jobTitle',
      title: t('jobTitleColumn'),
      dataIndex: 'job_title',
      sorter: true,
      sortOrder:
        pagination.order === 'ascend' && pagination.field === 'job_title'
          ? 'ascend'
          : pagination.order === 'descend' && pagination.field === 'job_title'
            ? 'descend'
            : null,
      render: (_, record: IProjectMemberViewModel) => (
        <Typography.Text style={{ marginInlineStart: 12 }}>
          {record?.job_title || '-'}
        </Typography.Text>
      ),
    },
    {
      key: 'email',
      title: t('emailColumn'),
      dataIndex: 'email',
      sorter: true,
      sortOrder:
        pagination.order === 'ascend' && pagination.field === 'email'
          ? 'ascend'
          : pagination.order === 'descend' && pagination.field === 'email'
            ? 'descend'
            : null,
      render: (_, record: IProjectMemberViewModel) => (
        <Typography.Text>{record.email}</Typography.Text>
      ),
    },
    {
      key: 'tasks',
      title: t('tasksColumn'),
      width: 90,
      render: (_, record: IProjectMemberViewModel) => (
        <Typography.Text style={{ marginInlineStart: 12 }}>
          {`${record.completed_tasks_count}/${record.all_tasks_count}`}
        </Typography.Text>
      ),
    },
    {
      key: 'taskProgress',
      title: t('taskProgressColumn'),
      render: (_, record: IProjectMemberViewModel) => (
        <Progress
          percent={calculateProgressPercent(record.completed_tasks_count, record.all_tasks_count)}
        />
      ),
    },
    {
      key: 'access',
      title: t('accessColumn'),
      dataIndex: 'access',
      sorter: true,
      sortOrder:
        pagination.order === 'ascend' && pagination.field === 'access'
          ? 'ascend'
          : pagination.order === 'descend' && pagination.field === 'access'
            ? 'descend'
            : null,
      render: (_, record: IProjectMemberViewModel) => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>{record.access}</Typography.Text>
      ),
    },
    {
      key: 'actionBtns',
      width: 80,
      render: (record: IProjectMemberViewModel) => (
        <Flex gap={8} style={{ padding: 0 }} className="action-buttons">
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={() => deleteMember(record.id)}
          >
            <Tooltip title={t('deleteButtonTooltip')}>
              <Button
                disabled={checkDisabled(record)}
                shape="default"
                icon={<DeleteOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="space-between" align="center">
          <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
            {members?.total} {members?.total !== 1 ? t('membersCountPlural') : t('memberCount')}
          </Typography.Text>

          <Flex gap={8} align="center">
            <Input.Search
              allowClear
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onSearch={value => {
                setPagination(p => ({ ...p, current: 1 })); // Reset to first page
                void getProjectMembers(value);
              }}
              style={{ width: 220 }}
              enterButton
              size="middle"
            />
            <Tooltip title={t('refreshButtonTooltip')}>
              <Button
                shape="circle"
                icon={<SyncOutlined />}
                onClick={() => void getProjectMembers()}
              />
            </Tooltip>
          </Flex>
        </Flex>
      }
    >
      {members?.total === 0 ? (
        <EmptyListPlaceholder
          imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
          imageHeight={120}
          text={t('emptyText')}
        />
      ) : isLoading ? (
        <Skeleton />
      ) : (
        <Table
          className="custom-two-colors-row-table"
          dataSource={members?.data}
          columns={columns}
          rowKey={record => record.id}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: pagination.pageSizeOptions,
            size: pagination.size,
          }}
          onChange={handleTableChange}
          onRow={record => ({
            style: {
              cursor: 'pointer',
              height: 42,
            },
          })}
        />
      )}
    </Card>
  );
};

export default ProjectViewMembers;
