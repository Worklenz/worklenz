import React, { useLayoutEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Card, Flex, Typography, theme } from '@/shared/antd-imports';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setDateRange, setDuration } from '@/features/reporting/reporting.slice';
import { durations, LAST_WEEK } from '@/shared/constants';
import { type GetFlowArgs, useGetProgressChartOptionsQuery } from '@/api/reporting/progress-chart.api.service';

const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 366;

interface ReportShellProps {
  title: string;
  subtitle: string;
  /** Toolbar shown on the subtitle's row, aligned to its bottom edge. */
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
}

/** Common page frame for the Reporting & Analytics reports: header, one filter card, then content. */
export const ReportShell: React.FC<ReportShellProps> = ({ title, subtitle, actions, filters, children }) => (
  <Flex vertical gap={16} style={{ paddingBottom: 24 }}>
    <Flex vertical gap={4}>
      <CustomPageHeader title={title} style={{ padding: 0 }} />
      <Flex gap={12} wrap="wrap" align="end" justify="space-between">
        <Typography.Text type="secondary" style={{ maxWidth: 900 }}>
          {subtitle}
        </Typography.Text>
        {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
      </Flex>
    </Flex>
    {filters && (
      <Card size="small">
        <Flex gap={12} wrap="wrap" align="center">
          {filters}
        </Flex>
      </Card>
    )}
    {children}
  </Flex>
);

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  /** Antd token name for the value colour, e.g. 'colorSuccess'. */
  tone?: 'colorPrimary' | 'colorSuccess' | 'colorError' | 'colorWarning';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, caption, tone }) => {
  const { token } = theme.useToken();
  return (
    <Card size="small" style={{ flex: '1 1 180px', minWidth: 160 }}>
      <Flex vertical gap={2}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {label}
        </Typography.Text>
        <Typography.Text strong style={{ fontSize: 24, color: tone ? token[tone] : undefined }}>
          {value}
        </Typography.Text>
        {caption && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {caption}
          </Typography.Text>
        )}
      </Flex>
    </Card>
  );
};

export interface ReportDateRange {
  from: string;
  to: string;
}

/**
 * The date filter shared with the Members report (TimeWiseFilter writes it to `reportingReducer`),
 * as YYYY-MM-DD. Falls back to the last 7 days and is clamped to the API's maximum span.
 */
export const useReportDateRange = (): ReportDateRange => {
  const stored = useAppSelector(state => state.reportingReducer.dateRange);
  return useMemo(() => {
    const parsedFrom = stored[0] ? dayjs(stored[0]) : null;
    const parsedTo = stored[1] ? dayjs(stored[1]) : null;
    const to = parsedTo?.isValid() ? parsedTo : dayjs();
    let from = parsedFrom?.isValid() ? parsedFrom : to.subtract(DEFAULT_RANGE_DAYS - 1, 'day');
    if (to.diff(from, 'day') + 1 > MAX_RANGE_DAYS) from = to.subtract(MAX_RANGE_DAYS - 1, 'day');
    return { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') };
  }, [stored]);
};

/**
 * Opens a report on "Last 7 days": the shared store may still hold the range picked in another report.
 * TimeWiseFilter reads the stored duration when it mounts, so render the report only once this is true.
 */
export const useDefaultLastWeekFilter = (): boolean => {
  const dispatch = useAppDispatch();
  const [isReady, setIsReady] = useState(false);
  useLayoutEffect(() => {
    dispatch(setDuration(LAST_WEEK));
    // Set the range too, so the first request is not made with the previous report's dates.
    const [from, to] = durations.find(duration => duration.key === LAST_WEEK)?.dates?.split(' - ') ?? [];
    if (from && to) dispatch(setDateRange([from, to]));
    setIsReady(true);
  }, [dispatch]);
  return isReady;
};

interface FlowSelection {
  selectedProjects: string[];
  selectedAssignees: string[];
  includeSubtasks: boolean;
  includeArchived: boolean;
}

/**
 * Query args shared by the flow reports. One selected project is read in "project" scope (a band per
 * status); none or several use team scope, optionally limited to those projects.
 */
export const buildFlowArgs = (selection: FlowSelection, dateRange: ReportDateRange): GetFlowArgs => {
  const { selectedProjects, selectedAssignees, includeSubtasks, includeArchived } = selection;
  const isSingleProject = selectedProjects.length === 1;
  return {
    config: {
      progressScope: isSingleProject ? 'project' : 'team',
      projectId: isSingleProject ? selectedProjects[0] : undefined,
      includeSubtasks,
    },
    includeArchived,
    dateRange,
    assigneeIds: selectedAssignees,
    projectIds: isSingleProject ? undefined : selectedProjects,
  };
};

/** Projects (and team members) for the report pickers. */
export const useReportOptions = (includeArchived = false) => {
  const { data, isFetching } = useGetProgressChartOptionsQuery({ includeArchived });
  return {
    projects: data?.body?.projects ?? [],
    members: data?.body?.members ?? [],
    statuses: data?.body?.statuses ?? [],
    isFetching,
  };
};

/** "11d 4h" for table cells and "4.5d" for charts; minutes are never useful at this scale. */
export const formatDwell = (hours: number): string => {
  const wholeHours = Math.max(Math.round(hours), 0);
  const days = Math.floor(wholeHours / 24);
  const rest = wholeHours % 24;
  return days > 0 ? `${days}d ${rest}h` : `${rest}h`;
};

export const formatDays = (hours: number): string => {
  const days = hours / 24;
  return `${Math.round(days * 10) / 10}d`;
};
