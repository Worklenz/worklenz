import { PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Progress,
  Skeleton,
  Table,
  Tag,
  Typography,
} from '@/shared/antd-imports';
import type { TableProps } from '@/shared/antd-imports';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClientProjectRow,
  useGetClientProjectsListQuery,
} from '@/api/client-portal/company-users-api';
import { formatDate } from '@/utils/dateUtils';
import { getProjectProgress } from './workspace-helpers';

const { Text } = Typography;

const PROJECT_FETCH_LIMIT = 100;

interface ProjectsTabProps {
  clientId: string;
  clientName: string;
  /** Opens the drawer that assigns one of the team's projects to this client. */
  onAssignProject: () => void;
}

/** This client's projects, with where each stands. Task lists open in the project itself. */
export const ProjectsTab = ({ clientId, clientName, onAssignProject }: ProjectsTabProps) => {
  const { t } = useTranslation('client-portal-client-workspace');

  const { data, isLoading, isError, refetch } = useGetClientProjectsListQuery(
    { clientId, limit: PROJECT_FETCH_LIMIT },
    { refetchOnMountOrArgChange: true }
  );
  const projects = data?.body?.projects ?? [];
  const total = data?.body?.total ?? 0;

  const columns: TableProps<ClientProjectRow>['columns'] = [
    {
      key: 'project',
      title: t('projects.project', { defaultValue: 'Project' }),
      dataIndex: 'name',
      onCell: () => ({ style: { minWidth: 200 } }),
      render: (_name: string, record) => (
        <Link
          to={`/worklenz/projects/${record.id}?tab=tasks-list&pinned_tab=tasks-list`}
          aria-label={t('projects.openProject', {
            name: record.name,
            defaultValue: 'Open {{name}}',
          })}
        >
          <Text strong>{record.name}</Text>
        </Link>
      ),
    },
    {
      key: 'health',
      title: t('projects.health', { defaultValue: 'Health' }),
      dataIndex: 'health_name',
      render: (_health: string | null, record) =>
        record.health_name ? (
          // The colour comes from the project's health setting, so it is data, not a theme token.
          <Tag
            style={{
              margin: 0,
              color: record.health_color ?? undefined,
              borderColor: record.health_color ?? undefined,
              background: 'transparent',
            }}
          >
            {record.health_name}
          </Tag>
        ) : (
          <Text type="secondary">{'—'}</Text>
        ),
    },
    {
      key: 'progress',
      title: t('projects.progress', { defaultValue: 'Progress' }),
      onCell: () => ({ style: { minWidth: 160 } }),
      render: (_value: unknown, record) => (
        <Progress
          percent={getProjectProgress(record)}
          size="small"
          aria-label={t('projects.progressLabel', {
            name: record.name,
            defaultValue: 'Progress of {{name}}',
          })}
        />
      ),
    },
    {
      key: 'due',
      title: t('projects.due', { defaultValue: 'Due' }),
      dataIndex: 'end_date',
      render: (endDate: string | null) => (
        <Text type={endDate ? undefined : 'secondary'}>
          {endDate ? formatDate(endDate, 'MMM D, YYYY') : '—'}
        </Text>
      ),
    },
  ];

  const assignButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={onAssignProject}>
      {t('projects.assign', { defaultValue: 'Assign project' })}
    </Button>
  );

  return (
    <Card
      style={{ borderRadius: 8 }}
      title={t('projects.title', { defaultValue: 'Projects' })}
      extra={assignButton}
    >
      {isError ? (
        <Alert
          type="error"
          showIcon
          message={t('projects.loadError', {
            defaultValue: 'Could not load this client’s projects.',
          })}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      ) : isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : projects.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('projects.empty', {
            name: clientName,
            defaultValue: 'No projects for {{name}} yet.',
          })}
        >
          {assignButton}
        </Empty>
      ) : (
        <Flex vertical gap={12}>
          <Table<ClientProjectRow>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={projects}
            pagination={projects.length > 10 ? { pageSize: 10, size: 'small' } : false}
            scroll={{ x: 'max-content' }}
          />
          {total > projects.length && (
            <Text type="secondary">
              {t('projects.truncated', {
                shown: projects.length,
                total,
                defaultValue: 'Showing the first {{shown}} of {{total}} projects.',
              })}
            </Text>
          )}
        </Flex>
      )}
    </Card>
  );
};
