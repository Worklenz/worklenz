import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';
import { RootState } from '@/app/store';
import { IOrganizationProject } from '@/types/admin-center/admin-center.types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import logger from '@/utils/errorLogger';
import { deleteProject } from '@features/projects/projectsSlice';
import './projects.css';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_projects_visit } from '@/shared/worklenz-analytics-events';
import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { DeleteOutlined, SearchOutlined, SyncOutlined } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { projectsApiService } from '@/api/projects/projects.api.service';

const Projects: React.FC = () => {
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const [isLoading, setIsLoading] = useState(false);
  const isTablet = useMediaQuery({ query: '(min-width: 1000px)' });
  const [projects, setProjects] = useState<IOrganizationProject[]>([]);
  const [requestParams, setRequestParams] = useState({
    total: 0,
    index: 1,
    size: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    search: '',
  });
  const { trackMixpanelEvent } = useMixpanelTracking();

  const dispatch = useAppDispatch();

  const { t } = useTranslation('admin-center/projects');

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await adminCenterApiService.getOrganizationProjects(requestParams);
      if (res.done) {
        setRequestParams(prev => ({ ...prev, total: res.body.total ?? 0 }));
        setProjects(res.body.data ?? []);
      }
    } catch (error) {
      logger.error('Error fetching teams', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!id) return;
    try {
      await projectsApiService.deleteProject(id);
    } catch (error) {
      logger.error('Error deleting project', error);
    } finally {
      fetchProjects();
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_projects_visit);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    fetchProjects();
  }, [
    requestParams.search,
    requestParams.index,
    requestParams.size,
    requestParams.field,
    requestParams.order,
  ]);

  const columns: TableProps['columns'] = [
    {
      title: 'Project name',
      key: 'projectName',
      render: (record: IOrganizationProject) => (
        <Typography.Text
          className="project-names"
          style={{ fontSize: `${isTablet ? '14px' : '10px'}` }}
        >
          {record.name}
        </Typography.Text>
      ),
    },
    {
      title: 'Team',
      key: 'team',
      render: (record: IOrganizationProject) => (
        <Typography.Text
          className="project-team"
          style={{ fontSize: `${isTablet ? '14px' : '10px'}` }}
        >
          {record.team_name}
        </Typography.Text>
      ),
    },
    {
      title: <span style={{ display: 'flex', justifyContent: 'center' }}>{t('membersCount')}</span>,
      key: 'membersCount',
      render: (record: IOrganizationProject) => (
        <Typography.Text
          className="project-member-count"
          style={{
            display: 'flex',
            justifyContent: 'center',
            fontSize: `${isTablet ? '14px' : '10px'}`,
          }}
        >
          {record.member_count ?? 0}
        </Typography.Text>
      ),
    },
    {
      title: <span style={{ display: 'flex', justifyContent: 'center' }}>Created at</span>,
      key: 'createdAt',
      render: (record: IOrganizationProject) => (
        <Typography.Text
          className="project-created-at"
          style={{
            display: 'flex',
            justifyContent: 'right',
            fontSize: `${isTablet ? '14px' : '10px'}`,
          }}
        >
          {formatDateTimeWithLocale(record.created_at ?? '')}
        </Typography.Text>
      ),
    },
    {
      title: '',
      key: 'button',
      render: (record: IOrganizationProject) => (
        <div className="row-buttons">
          <Tooltip title={t('delete')}>
            <Popconfirm
              title={t('confirm')}
              description={t('deleteProject')}
              onConfirm={() => deleteProject(record.id ?? '')}
            >
              <Button size="small">
                <DeleteOutlined />
              </Button>
            </Popconfirm>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title={<span>Projects</span>} style={{ padding: '16px 0' }} />
      <PageHeader
        style={{
          paddingLeft: 0,
          paddingTop: 0,
          paddingRight: '24px',
          paddingBottom: '16px',
        }}
        subTitle={
          <span
            style={{
              color: `${themeMode === 'dark' ? '#ffffffd9' : '#000000d9'}`,
              fontWeight: 500,
              fontSize: '16px',
            }}
          >
            {projects.length} projects
          </span>
        }
        extra={
          <Flex gap={8} align="center">
            <Tooltip title={t('refreshProjects')}>
              <Button
                shape="circle"
                icon={<SyncOutlined spin={isLoading} />}
                onClick={() => fetchProjects()}
              />
            </Tooltip>
            <Input
              placeholder={t('searchPlaceholder')}
              suffix={<SearchOutlined />}
              type="text"
              value={requestParams.search}
              onChange={e => setRequestParams(prev => ({ ...prev, search: e.target.value }))}
            />
          </Flex>
        }
      />

      <Card>
        <Table<IOrganizationProject>
          rowClassName="project-table-row"
          className="project-table"
          columns={columns}
          dataSource={projects}
          rowKey={record => record.id ?? ''}
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
            pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
            size: 'small',
            total: requestParams.total,
            current: requestParams.index,
            pageSize: requestParams.size,
            onChange: (page, pageSize) =>
              setRequestParams(prev => ({ ...prev, index: page, size: pageSize })),
          }}
        />
      </Card>
    </div>
  );
};

export default Projects;
