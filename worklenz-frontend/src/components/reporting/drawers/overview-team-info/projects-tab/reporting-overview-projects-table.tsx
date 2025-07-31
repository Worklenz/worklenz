import { useEffect, useState, useMemo } from 'react';
import { Button, ConfigProvider, Flex, PaginationProps, Table, TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { ExpandAltOutlined } from '@ant-design/icons';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import ProjectCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-cell/project-cell';
import EstimatedVsActualCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/estimated-vs-actual-cell/estimated-vs-actual-cell';
import TasksProgressCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/tasks-progress-cell/tasks-progress-cell';
import LastActivityCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/last-activity-cell/last-activity-cell';
import ProjectStatusCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-status-cell/project-status-cell';
import ProjectClientCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-client-cell/project-client-cell';
import ProjectTeamCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-team-cell/project-team-cell';
import ProjectManagerCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-manager-cell/project-manager-cell';
import ProjectDatesCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-dates-cell/project-dates-cell';
import ProjectHealthCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-health-cell/project-health-cell';
import ProjectCategoryCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-category-cell/project-category-cell';
import ProjectDaysLeftAndOverdueCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-days-left-and-overdue-cell/project-days-left-and-overdue-cell';
import ProjectUpdateCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-update-cell/project-update-cell';
import {
  resetProjectReports,
  setField,
  setIndex,
  setOrder,
  setPageSize,
  toggleProjectReportsDrawer,
} from '@/features/reporting/projectReports/project-reports-slice';
import { colors } from '@/styles/colors';
import CustomTableTitle from '@/components/CustomTableTitle';
import { IRPTProject } from '@/types/reporting/reporting.types';
import ProjectReportsDrawer from '@/features/reporting/projectReports/projectReportsDrawer/ProjectReportsDrawer';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import './projects-reports-table.css';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import logger from '@/utils/errorLogger';
import { reportingApiService } from '@/api/reporting/reporting.api.service';

interface ReportingOverviewProjectsTableProps {
  searchQuery: string;
  teamsId: string | null;
}

const ReportingOverviewProjectsTable = ({
  searchQuery,
  teamsId,
}: ReportingOverviewProjectsTableProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects');

  const { includeArchivedProjects } = useAppSelector(state => state.reportingReducer);
  const [projectList, setProjectList] = useState<IRPTProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationProps>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  });

  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [field, setField] = useState<string>('name');

  const [selectedProject, setSelectedProject] = useState<IRPTProject | null>(null);
  const { projectStatuses, loading: projectStatusesLoading } = useAppSelector(
    state => state.projectStatusesReducer
  );

  const handleDrawerOpen = (record: IRPTProject) => {
    setSelectedProject(record);
    dispatch(toggleProjectReportsDrawer());
  };

  const columns: TableColumnsType<IRPTProject> = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: <CustomTableTitle title={t('projectColumn')} />,
        width: 300,
        sorter: true,
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        fixed: 'left' as const,
        onCell: record => ({
          onClick: () => handleDrawerOpen(record as IRPTProject),
        }),
        render: (_, record: { id: string; name: string; color_code: string }) => (
          <Flex gap={16} align="center" justify="space-between">
            <ProjectCell
              projectId={record.id}
              project={record.name}
              projectColor={record.color_code}
            />

            <Button
              className="hidden group-hover:flex"
              type="text"
              style={{
                backgroundColor: colors.transparent,
                padding: 0,
                height: 22,
                alignItems: 'center',
                gap: 8,
              }}
            >
              {t('openButton')} <ExpandAltOutlined />
            </Button>
          </Flex>
        ),
      },
      {
        key: 'estimatedVsActual',
        title: <CustomTableTitle title={t('estimatedVsActualColumn')} />,
        render: record => (
          <EstimatedVsActualCell
            actualTime={record.actual_time || 0}
            actualTimeString={record.actual_time_string}
            estimatedTime={record.estimated_time * 60 || 0}
            estimatedTimeString={record.estimated_time_string}
          />
        ),
        width: 230,
      },
      {
        key: 'tasksProgress',
        title: <CustomTableTitle title={t('tasksProgressColumn')} />,
        render: record => <TasksProgressCell tasksStat={record.tasks_stat} />,
        width: 200,
      },
      {
        key: 'lastActivity',
        title: <CustomTableTitle title={t('lastActivityColumn')} />,
        render: record => (
          <LastActivityCell activity={record.last_activity?.last_activity_string} />
        ),
        width: 200,
      },
      {
        key: 'status',
        dataIndex: 'status_id',
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        title: <CustomTableTitle title={t('statusColumn')} />,
        render: (_, record: IRPTProject) => (
          <ProjectStatusCell currentStatus={record.status_id} projectId={record.id} />
        ),
        width: 200,
        sorter: true,
      },
      {
        key: 'dates',
        title: <CustomTableTitle title={t('datesColumn')} />,
        render: record => (
          <ProjectDatesCell
            projectId={record.id}
            startDate={record.start_date}
            endDate={record.end_date}
          />
        ),
        width: 275,
      },
      {
        key: 'daysLeft',
        title: <CustomTableTitle title={t('daysLeftColumn')} />,
        render: record => (
          <ProjectDaysLeftAndOverdueCell
            daysLeft={record.days_left}
            isOverdue={record.is_overdue}
            isToday={record.is_today}
          />
        ),
        width: 200,
      },
      {
        key: 'projectHealth',
        dataIndex: 'project_health',
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        title: <CustomTableTitle title={t('projectHealthColumn')} />,
        sorter: true,
        render: (_, record: IRPTProject) => (
          <ProjectHealthCell
            value={record.project_health}
            label={record.health_name}
            color={record.health_color}
            projectId={record.id}
          />
        ),
        width: 200,
      },
      {
        key: 'category',
        title: <CustomTableTitle title={t('categoryColumn')} />,
        render: (_, record: IRPTProject) => (
          <ProjectCategoryCell
            projectId={record.id}
            id={record.category_id || ''}
            name={record.category_name || ''}
            color_code={record.category_color || ''}
          />
        ),
        width: 200,
      },
      {
        key: 'projectUpdate',
        title: <CustomTableTitle title={t('projectUpdateColumn')} />,
        render: (_, record: IRPTProject) =>
          record.comment ? <ProjectUpdateCell updates={record.comment} /> : '-',
        width: 200,
      },
      {
        key: 'client',
        dataIndex: 'client',
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        title: <CustomTableTitle title={t('clientColumn')} />,
        render: (_, record: IRPTProject) =>
          record?.client ? <ProjectClientCell client={record.client} /> : '-',
        sorter: true,
        width: 200,
      },
      {
        key: 'team',
        dataIndex: 'team_name',
        defaultSortOrder: order === 'asc' ? 'ascend' : 'descend',
        title: <CustomTableTitle title={t('teamColumn')} />,
        render: (_, record: IRPTProject) =>
          record.team_name ? <ProjectTeamCell team={record.team_name} /> : '-',
        sorter: true,
        width: 200,
      },
      {
        key: 'projectManager',
        title: <CustomTableTitle title={t('projectManagerColumn')} />,
        render: (_, record: IRPTProject) =>
          record.project_manager ? <ProjectManagerCell manager={record.project_manager} /> : '-',
        width: 200,
      },
    ],
    [t, order]
  );

  const handleTableChange = (pagination: PaginationProps, filters: any, sorter: any) => {
    if (sorter.order) setOrder(sorter.order);
    if (sorter.field) setField(sorter.field);
    setPagination({ ...pagination, current: pagination.current });
    setPagination({ ...pagination, pageSize: pagination.pageSize });
  };

  useEffect(() => {
    if (projectStatuses.length === 0 && !projectStatusesLoading) dispatch(fetchProjectStatuses());
  }, []);

  useEffect(() => {
    return () => {
      dispatch(resetProjectReports());
    };
  }, []);

  const tableRowProps = useMemo(
    () => ({
      style: { height: 56, cursor: 'pointer' },
      className: 'group even:bg-[#4e4e4e10]',
    }),
    []
  );

  const tableConfig = useMemo(
    () => ({
      theme: {
        components: {
          Table: {
            cellPaddingBlock: 12,
            cellPaddingInline: 10,
          },
        },
      },
    }),
    []
  );

  const fetchOverviewProjects = async () => {
    setIsLoading(true);
    try {
      const params = {
        team: teamsId,
        index: pagination.current,
        size: pagination.pageSize,
        search: searchQuery,
        filter: 0,
        order: order,
        field: field,
        archived: includeArchivedProjects,
      };
      const response = await reportingApiService.getOverviewProjects(params);
      if (response.done) {
        setProjectList(response.body.projects || []);
        setPagination({ ...pagination, total: response.body.total });
      }
    } catch (error) {
      logger.error('fetchOverviewProjects', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewProjects();
  }, [searchQuery, order, field]);

  return (
    <ConfigProvider {...tableConfig}>
      <Table
        columns={columns}
        dataSource={projectList}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: 10,
          total: pagination.total,
          current: pagination.current,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
        }}
        scroll={{ x: 'max-content' }}
        loading={isLoading}
        onChange={handleTableChange}
        rowKey={record => record.id}
        onRow={() => tableRowProps}
      />
      {createPortal(<ProjectReportsDrawer selectedProject={selectedProject} />, document.body)}
    </ConfigProvider>
  );
};

export default ReportingOverviewProjectsTable;
