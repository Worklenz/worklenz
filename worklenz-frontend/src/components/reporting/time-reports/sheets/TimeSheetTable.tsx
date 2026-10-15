import React, { CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Empty, Flex, Progress, Skeleton, Table, theme } from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import { MemberLoggedTimeType } from '@/types/timeSheet/project.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingTimesheetApiService } from '@/api/reporting/reporting.timesheet.api.service';
import { IAllocationProject } from '@/types/reporting/reporting-allocation.types';
import logger from '@/utils/errorLogger';

const PROJECT_COLUMN_WIDTH = 240;
const MEMBER_COLUMN_WIDTH = 130;
const TOTAL_COLUMN_WIDTH = 140;

/** The API formats every duration as "1h 30m 5s", or "-" when nothing was logged. */
const parseDurationSeconds = (value?: string): number => {
  const match = value?.match(/(\d+)h (\d+)m (\d+)s/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};

const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds === 0) return '-';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

const SKELETON_ROWS = 7;
const SKELETON_MEMBER_CELLS = 5;

/** Stand-in for the table while the options and report data load. */
const TimeSheetSkeleton: React.FC = () => (
  <Flex vertical gap={16} style={{ padding: 16 }} aria-busy="true">
    <Flex gap={16}>
      <Skeleton.Input
        active
        block
        style={{ width: PROJECT_COLUMN_WIDTH, minWidth: PROJECT_COLUMN_WIDTH }}
      />
      {Array.from({ length: SKELETON_MEMBER_CELLS }, (_, index) => (
        <Skeleton.Input key={index} active block />
      ))}
    </Flex>
    {Array.from({ length: SKELETON_ROWS }, (_, row) => (
      <Flex key={row} gap={16}>
        <Skeleton.Input
          active
          block
          style={{ width: PROJECT_COLUMN_WIDTH, minWidth: PROJECT_COLUMN_WIDTH }}
        />
        {Array.from({ length: SKELETON_MEMBER_CELLS }, (_, index) => (
          <Skeleton.Input key={index} active block />
        ))}
      </Flex>
    ))}
  </Flex>
);

const TimeSheetTable: React.FC = () => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();

  const [projects, setProjects] = useState<IAllocationProject[]>([]);
  const [members, setMembers] = useState<MemberLoggedTimeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const {
    teams,
    loadingTeams,
    categories,
    loadingCategories,
    projects: filterProjects,
    loadingProjects,
    billable,
    archived,
    noCategory,
    filtersInitialized,
  } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  const fetchTimeSheetData = async () => {
    try {
      setLoading(true);
      const selectedTeams = teams.filter(team => team.selected);
      const selectedProjects = filterProjects.filter(project => project.selected);
      const selectedCategories = categories.filter(category => category.selected);

      // Validate primary filters - show empty state if any required filter is not met
      // This matches backend logic which returns no data when primary filters are empty
      const hasInvalidFilters =
        selectedProjects.length === 0 || // Projects are required
        selectedTeams.length === 0 || // Teams are required
        (selectedCategories.length === 0 && !noCategory); // Categories required unless "No Category" is checked

      if (hasInvalidFilters) {
        setProjects([]);
        setMembers([]);
        return;
      }

      const body = {
        teams: selectedTeams.map(team => team.id) as string[],
        projects: selectedProjects.map(project => project.id) || [],
        categories: selectedCategories.map(category => category.id) || [],
        duration,
        date_range: dateRange,
        archived,
        billable,
        noCategory,
      };
      const response = await reportingTimesheetApiService.getTimeSheetData(body, archived);
      if (response.done) {
        setProjects(response.body.projects);
        setMembers(response.body.users);
      }
    } catch (error) {
      logger.error('Error fetching time sheet data', error);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  useEffect(() => {
    if (filtersInitialized && !loadingTeams && !loadingCategories && !loadingProjects) {
      fetchTimeSheetData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teams,
    duration,
    dateRange,
    filterProjects,
    categories,
    billable,
    archived,
    filtersInitialized,
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  // Size the table body to the space left in the page so the header and Total row stay visible.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
      const footer = element.querySelector<HTMLElement>('.ant-table-summary')?.offsetHeight ?? 40;
      setScrollY(Math.max(120, element.clientHeight - header - footer - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [members, projects, loading, hasFetched]);

  const columns = useMemo<TableColumnsType<IAllocationProject>>(
    () => [
      {
        key: 'project',
        title: t('Project', { defaultValue: 'Project' }),
        fixed: 'left',
        width: PROJECT_COLUMN_WIDTH,
        render: (_, project) => (
          <div>
            <span className="anticon" style={{ color: project.status_color_code }}>
              <i className={project.status_icon}></i>
            </span>
            <span style={{ marginLeft: 4 }}>{project.name}</span>
            <Progress percent={project.progress} strokeColor={project.color_code} size="small" />
          </div>
        ),
      },
      ...members.map<TableColumnsType<IAllocationProject>[number]>((member, index) => ({
        key: member.id,
        title: member.name,
        width: MEMBER_COLUMN_WIDTH,
        align: 'center',
        ellipsis: true,
        render: (_, project) => project.time_logs?.[index]?.time_logged ?? '-',
      })),
      {
        key: 'total',
        title: t('total', { defaultValue: 'Total' }),
        fixed: 'right',
        width: TOTAL_COLUMN_WIDTH,
        align: 'center',
        render: (_, project) => <strong>{project.total}</strong>,
      },
    ],
    [members, t]
  );

  const grandTotal = useMemo(
    () =>
      formatDuration(
        members.reduce((sum, member) => sum + parseDurationSeconds(member.total_time), 0)
      ),
    [members]
  );

  // Summary cells only take a className, so the theme tokens are passed down as CSS variables.
  const totalRowClass =
    '!bg-[var(--timesheet-total-bg)] !border-t-2 !border-t-[var(--timesheet-total-border)] font-semibold';

  // Every column has a fixed width, so the header and body tables must share one explicit width;
  // with `max-content` each table sizes itself from its own cells and the columns drift apart.
  const minTableWidth = PROJECT_COLUMN_WIDTH + members.length * MEMBER_COLUMN_WIDTH + TOTAL_COLUMN_WIDTH;

  const hasData = members.length > 0 && projects.length > 0;
  const showSkeleton = loading || !hasFetched;

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-hidden"
      style={
        {
          '--timesheet-total-bg': token.colorPrimaryBg,
          '--timesheet-total-border': token.colorPrimary,
        } as CSSProperties
      }
    >
      {showSkeleton ? (
        <TimeSheetSkeleton />
      ) : (
        <Table<IAllocationProject>
          size="small"
          bordered
          showSorterTooltip={false}
          pagination={false}
          rowKey={(_, index) => String(index)}
          columns={columns}
          dataSource={projects}
          tableLayout="fixed"
          scroll={{ x: minTableWidth, y: scrollY }}
          locale={{
            emptyText: <Empty description={t('noData', { defaultValue: 'No data found' })} />,
          }}
          summary={() =>
            hasData ? (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} className={totalRowClass}>
                    <strong>{t('total', { defaultValue: 'Total' })}</strong>
                  </Table.Summary.Cell>
                  {members.map((member, index) => (
                    <Table.Summary.Cell
                      key={member.id}
                      index={index + 1}
                      align="center"
                      className={totalRowClass}
                    >
                      <strong>{member.total_time}</strong>
                    </Table.Summary.Cell>
                  ))}
                  <Table.Summary.Cell
                    index={members.length + 1}
                    align="center"
                    className={totalRowClass}
                  >
                    <strong>{grandTotal}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />
      )}
    </div>
  );
};

export default TimeSheetTable;
