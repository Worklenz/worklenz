import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Table,
  Flex,
  Typography,
  Tag,
  Progress,
  Select,
  Input,
  Avatar,
  Tooltip,
  Spin,
  Card,
  Statistic,
  Divider,
} from '@/shared/antd-imports';
import type { TablePaginationConfig, SorterResult, SortOrder } from 'antd/es/table/interface';
import {
  SearchOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  ProjectOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { IRPTProject } from '@/types/reporting/reporting.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { reportingProjectsApiService } from '@/api/reporting/reporting-projects.api.service';
import logger from '@/utils/errorLogger';
import './project-tasks-modal.css';

interface ProjectTasksModalProps {
  open: boolean;
  project: IRPTProject | null;
  onClose: () => void;
}

type StatusFilter = 'all' | 'todo' | 'doing' | 'done';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high';

interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
}

interface ProjectMember {
  team_member_id: string;
  name: string;
  avatar_url: string;
}

const ProjectTasksModal = ({ open, project, onClose }: ProjectTasksModalProps) => {
  const { t } = useTranslation('reporting-projects');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<IProjectTask[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
  });
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTasks = useCallback(
    async (
      page: number = currentPage,
      size: number = pageSize,
      search: string = searchQuery,
      status: string = statusFilter,
      priority: string = priorityFilter,
      assignee: string = assigneeFilter,
      sort: string = sortField,
      order: string = sortOrder
    ) => {
      if (!project?.id) return;

      try {
        setLoading(true);
        const res = await reportingProjectsApiService.getTasksPaginated(project.id, {
          page,
          pageSize: size,
          search,
          status,
          priority,
          assignee,
          sortField: sort,
          sortOrder: order,
        });
        if (res.done) {
          setTasks(res.body.data);
          setTotal(res.body.total);
          setTaskStats(res.body.stats);
          if (res.body.members) {
            setProjectMembers(res.body.members);
          }
        }
      } catch (error) {
        logger.error('Error fetching tasks', error);
      } finally {
        setLoading(false);
      }
    },
    [
      project?.id,
      currentPage,
      pageSize,
      searchQuery,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      sortField,
      sortOrder,
    ]
  );

  useEffect(() => {
    if (open && project?.id) {
      setCurrentPage(1);
      setSearchQuery('');
      setStatusFilter('all');
      setPriorityFilter('all');
      setAssigneeFilter('all');
      setSortField('created_at');
      setSortOrder('desc');
      fetchTasks(1, pageSize, '', 'all', 'all', 'all', 'created_at', 'desc');
    }
  }, [open, project?.id]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        setCurrentPage(1);
        fetchTasks(
          1,
          pageSize,
          value,
          statusFilter,
          priorityFilter,
          assigneeFilter,
          sortField,
          sortOrder
        );
      }, 500);
    },
    [fetchTasks, pageSize, statusFilter, priorityFilter, assigneeFilter, sortField, sortOrder]
  );

  const handleStatusChange = useCallback(
    (value: StatusFilter) => {
      setStatusFilter(value);
      setCurrentPage(1);
      fetchTasks(
        1,
        pageSize,
        searchQuery,
        value,
        priorityFilter,
        assigneeFilter,
        sortField,
        sortOrder
      );
    },
    [fetchTasks, pageSize, searchQuery, priorityFilter, assigneeFilter, sortField, sortOrder]
  );

  const handlePriorityChange = useCallback(
    (value: PriorityFilter) => {
      setPriorityFilter(value);
      setCurrentPage(1);
      fetchTasks(
        1,
        pageSize,
        searchQuery,
        statusFilter,
        value,
        assigneeFilter,
        sortField,
        sortOrder
      );
    },
    [fetchTasks, pageSize, searchQuery, statusFilter, assigneeFilter, sortField, sortOrder]
  );

  const handleAssigneeChange = useCallback(
    (value: string) => {
      setAssigneeFilter(value);
      setCurrentPage(1);
      fetchTasks(
        1,
        pageSize,
        searchQuery,
        statusFilter,
        priorityFilter,
        value,
        sortField,
        sortOrder
      );
    },
    [fetchTasks, pageSize, searchQuery, statusFilter, priorityFilter, sortField, sortOrder]
  );

  const handleTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      _filters: any,
      sorter: SorterResult<IProjectTask> | SorterResult<IProjectTask>[]
    ) => {
      const newPage = pagination.current || 1;
      const newPageSize = pagination.pageSize || 15;
      setCurrentPage(newPage);
      setPageSize(newPageSize);

      // Handle sorting
      const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      let newSortField = 'created_at';
      let newSortOrder = 'desc';

      if (singleSorter?.field && singleSorter?.order) {
        newSortField = singleSorter.field as string;
        newSortOrder = singleSorter.order === 'ascend' ? 'asc' : 'desc';
      }

      setSortField(newSortField);
      setSortOrder(newSortOrder);

      fetchTasks(
        newPage,
        newPageSize,
        searchQuery,
        statusFilter,
        priorityFilter,
        assigneeFilter,
        newSortField,
        newSortOrder
      );
    },
    [fetchTasks, searchQuery, statusFilter, priorityFilter, assigneeFilter]
  );

  const columns = useMemo(
    () => [
      {
        title: t('taskNameColumn'),
        dataIndex: 'name',
        key: 'name',
        width: 280,
        ellipsis: true,
        sorter: true,
        sortOrder: (sortField === 'name'
          ? sortOrder === 'asc'
            ? 'ascend'
            : 'descend'
          : undefined) as SortOrder,
        render: (name: string, record: IProjectTask) => (
          <Flex align="center" gap={8}>
            {record.is_overdue && (
              <Tooltip title={t('overdueText')}>
                <ClockCircleOutlined style={{ color: '#ff4d4f' }} />
              </Tooltip>
            )}
            <Typography.Text ellipsis={{ tooltip: name }}>{name}</Typography.Text>
            {(record.sub_tasks_count ?? 0) > 0 && (
              <Tag color="default" style={{ marginLeft: 4 }}>
                {record.sub_tasks_count} {t('subtasksText')}
              </Tag>
            )}
          </Flex>
        ),
      },
      {
        title: t('taskStatusColumn'),
        dataIndex: 'status_name',
        key: 'status',
        width: 120,
        render: (status: string, record: IProjectTask) => (
          <Tag color={record.status_color} style={{ borderRadius: 12 }}>
            {status}
          </Tag>
        ),
      },
      {
        title: t('taskPriorityColumn'),
        dataIndex: 'priority_name',
        key: 'priority',
        width: 100,
        render: (priority: string, record: IProjectTask) =>
          priority ? (
            <Tag color={record.priority_color} style={{ borderRadius: 12 }}>
              {priority}
            </Tag>
          ) : (
            '-'
          ),
      },
      {
        title: t('assigneesColumn'),
        key: 'assignees',
        width: 150,
        render: (_: any, record: IProjectTask) => {
          const members = record.names || record.assignees || [];
          return members.length > 0 ? (
            <Avatar.Group maxCount={3} size="small">
              {members.map((member: any, idx: number) => (
                <Tooltip key={member.id || idx} title={member.name}>
                  <Avatar
                    size="small"
                    style={{ backgroundColor: member.color_code || '#1890ff' }}
                    src={member.avatar_url}
                  >
                    {member.name?.charAt(0)?.toUpperCase()}
                  </Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          );
        },
      },
      {
        title: t('dueDateColumn'),
        dataIndex: 'end_date',
        key: 'end_date',
        width: 110,
        sorter: true,
        sortOrder: (sortField === 'end_date'
          ? sortOrder === 'asc'
            ? 'ascend'
            : 'descend'
          : undefined) as SortOrder,
        render: (date: string, record: IProjectTask) =>
          date ? (
            <Typography.Text type={record.is_overdue ? 'danger' : undefined}>
              {new Date(date).toLocaleDateString()}
            </Typography.Text>
          ) : (
            '-'
          ),
      },
      {
        title: t('timeColumn'),
        key: 'time',
        width: 140,
        render: (_: any, record: IProjectTask) => (
          <Flex vertical gap={2}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('estimatedText')}: {record.total_time_string || '0h'}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('loggedText')}: {record.time_spent_string || '0h'}
            </Typography.Text>
          </Flex>
        ),
      },
      {
        title: t('taskProgressColumn'),
        key: 'progress',
        width: 100,
        render: (_: any, record: IProjectTask) => {
          const progress = record.complete_ratio ?? record.progress ?? 0;
          return (
            <Progress
              percent={Math.round(progress)}
              size="small"
              strokeColor={progress === 100 ? '#52c41a' : '#1890ff'}
            />
          );
        },
      },
    ],
    [t, sortField, sortOrder]
  );

  const modalTitle = useMemo(
    () => (
      <Flex align="center" gap={12}>
        <ProjectOutlined style={{ fontSize: 20, color: project?.color_code }} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          {project?.name}
        </Typography.Title>
      </Flex>
    ),
    [project]
  );

  const statsCards = useMemo(
    () => (
      <Flex gap={16} style={{ marginBottom: 20 }}>
        <Card size="small" className="stat-card" style={{ flex: 1 }}>
          <Statistic
            title={t('tasksText')}
            value={taskStats.total}
            prefix={<ProjectOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
        <Card size="small" className="stat-card" style={{ flex: 1 }}>
          <Statistic
            title={t('taskCompletedText')}
            value={taskStats.completed}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
        <Card size="small" className="stat-card" style={{ flex: 1 }}>
          <Statistic
            title={t('inProgressText')}
            value={taskStats.inProgress}
            prefix={<SyncOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
        <Card size="small" className="stat-card" style={{ flex: 1 }}>
          <Statistic
            title={t('overdueText')}
            value={taskStats.overdue}
            prefix={<ExclamationCircleOutlined />}
            valueStyle={{ color: taskStats.overdue > 0 ? '#ff4d4f' : '#8c8c8c' }}
          />
        </Card>
      </Flex>
    ),
    [taskStats, t]
  );

  const filterBar = useMemo(
    () => (
      <Flex gap={12} style={{ marginBottom: 16 }} wrap="wrap" align="center">
        <Input
          placeholder={t('searchTasksPlaceholder')}
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          style={{ width: 280 }}
          allowClear
          size="middle"
        />
        <Select
          value={statusFilter}
          onChange={handleStatusChange}
          style={{ width: 150 }}
          size="middle"
          options={[
            { value: 'all', label: t('allStatusesText') },
            { value: 'todo', label: t('todoText') },
            { value: 'doing', label: t('doingText') },
            { value: 'done', label: t('doneText') },
          ]}
        />
        <Select
          value={priorityFilter}
          onChange={handlePriorityChange}
          style={{ width: 150 }}
          size="middle"
          options={[
            { value: 'all', label: t('allPrioritiesText') },
            { value: 'low', label: t('lowText') },
            { value: 'medium', label: t('mediumText') },
            { value: 'high', label: t('highText') },
          ]}
        />
        <Select
          value={assigneeFilter}
          onChange={handleAssigneeChange}
          style={{ width: 180 }}
          size="middle"
          placeholder={t('allAssigneesText')}
          showSearch
          optionFilterProp="label"
          options={[
            { value: 'all', label: t('allAssigneesText') },
            ...projectMembers.map(member => ({
              value: member.team_member_id,
              label: member.name,
            })),
          ]}
        />
        <Divider type="vertical" style={{ height: 24 }} />
        <Typography.Text type="secondary">
          {t('showingText')} <strong>{tasks.length}</strong> {t('ofText')} <strong>{total}</strong>
        </Typography.Text>
      </Flex>
    ),
    [
      searchQuery,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      projectMembers,
      tasks.length,
      total,
      t,
      handleSearchChange,
      handleStatusChange,
      handlePriorityChange,
      handleAssigneeChange,
    ]
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={modalTitle}
      footer={null}
      width="90%"
      style={{ maxWidth: 1400, top: 40 }}
      className="project-tasks-modal"
      destroyOnHidden
      centered
    >
      <Spin spinning={loading}>
        {statsCards}
        {filterBar}
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '25', '50'],
            showTotal: (totalCount, range) =>
              `${range[0]}-${range[1]} ${t('ofText')} ${totalCount}`,
          }}
          onChange={handleTableChange}
          scroll={{ y: 'calc(100vh - 420px)' }}
          size="middle"
        />
      </Spin>
    </Modal>
  );
};

export default memo(ProjectTasksModal);
