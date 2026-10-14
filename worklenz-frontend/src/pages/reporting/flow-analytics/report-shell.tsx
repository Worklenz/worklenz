import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Card, DatePicker, Flex, Typography, theme } from '@/shared/antd-imports';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import { useGetProgressChartOptionsQuery } from '@/api/reporting/progress-chart.api.service';

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

interface ReportShellProps {
  title: string;
  subtitle: string;
  filters: React.ReactNode;
  children: React.ReactNode;
}

/** Common page frame for the Reporting & Analytics reports: header, one filter card, then content. */
export const ReportShell: React.FC<ReportShellProps> = ({ title, subtitle, filters, children }) => (
  <Flex vertical gap={16} style={{ paddingBottom: 24 }}>
    <Flex vertical gap={4}>
      <CustomPageHeader title={title} style={{ padding: 0 }} />
      <Typography.Text type="secondary" style={{ maxWidth: 900 }}>
        {subtitle}
      </Typography.Text>
    </Flex>
    <Card size="small">
      <Flex gap={12} wrap="wrap" align="center">
        {filters}
      </Flex>
    </Card>
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

/** Date range state shared by the CFD and Time in Status pages; defaults to the last 30 days. */
export const useReportDateRange = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [
    dayjs().subtract(DEFAULT_RANGE_DAYS - 1, 'day'),
    dayjs(),
  ]);
  const dateRange = useMemo(
    () => ({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') }),
    [range]
  );
  return { range, setRange, dateRange };
};

export const ReportRangePicker: React.FC<{
  value: [dayjs.Dayjs, dayjs.Dayjs];
  onChange: (value: [dayjs.Dayjs, dayjs.Dayjs]) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation('reporting-flow');
  return (
    <DatePicker.RangePicker
      allowClear={false}
      value={value}
      format="MMM DD, YYYY"
      aria-label={t('dateRange', { defaultValue: 'Date range' })}
      presets={[
        { label: t('last7Days', { defaultValue: 'Last 7 days' }), value: [dayjs().subtract(6, 'day'), dayjs()] },
        { label: t('last30Days', { defaultValue: 'Last 30 days' }), value: [dayjs().subtract(29, 'day'), dayjs()] },
        { label: t('last90Days', { defaultValue: 'Last 90 days' }), value: [dayjs().subtract(89, 'day'), dayjs()] },
      ]}
      disabledDate={(current, info) => {
        if (current.isAfter(dayjs(), 'day')) return true;
        const from = (info as { from?: dayjs.Dayjs }).from;
        return Boolean(from && Math.abs(current.diff(from, 'day')) >= MAX_RANGE_DAYS);
      }}
      onChange={dates => {
        if (dates?.[0] && dates[1]) onChange([dates[0], dates[1]]);
      }}
    />
  );
};

/** Projects (and team members) for the report pickers. */
export const useReportOptions = () => {
  const { data, isFetching } = useGetProgressChartOptionsQuery({});
  return {
    projects: data?.body?.projects ?? [],
    members: data?.body?.members ?? [],
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
