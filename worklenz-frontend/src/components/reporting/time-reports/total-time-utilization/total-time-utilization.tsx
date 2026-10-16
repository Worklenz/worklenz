import {
  Card,
  Flex,
  Progress,
  Tooltip,
  Button,
  Skeleton,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@/shared/antd-imports';
import React, { useMemo, useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { IRPTTimeTotals } from '@/types/reporting/reporting.types';
import dayjs from 'dayjs';

interface TotalTimeUtilizationProps {
  totals: IRPTTimeTotals;
  dateRange?: string[];
  // When false, visibility is controlled entirely by the parent (e.g. a
  // report settings modal) — the inline "Hide/Show Utilization" button is
  // hidden and the cards are always rendered. Defaults to true so existing
  // callers keep their own toggle unchanged.
  showToggleButton?: boolean;
  // While true, shows skeleton placeholders instead of `totals` — without
  // this, the cards render "0h" / "0%" for a moment before the real numbers
  // arrive, which reads as a bug rather than a loading state.
  loading?: boolean;
}

const TotalTimeUtilization: React.FC<TotalTimeUtilizationProps> = ({
  totals,
  dateRange,
  showToggleButton = true,
  loading = false,
}) => {
  const { t } = useTranslation('time-report');
  const isDark = useAppSelector(state => state.themeReducer.mode) === 'dark';
  const workPolicySettings = useAppSelector(
    state => (state.adminCenterReducer as any)?.workPolicySettings
  );
  const utilizationMinThreshold =
    workPolicySettings?.utilization_optimal_min_threshold_percent ?? 90;
  const utilizationMaxThreshold =
    workPolicySettings?.utilization_optimal_max_threshold_percent ?? 110;
  const [holidayInfo, setHolidayInfo] = useState<{ count: number; adjustedHours: number } | null>(
    null
  );
  const [isVisible, setIsVisible] = useState(() => {
    if (!showToggleButton) return true;
    const stored = localStorage.getItem('totalTimeUtilizationVisible');
    return stored !== null ? stored === 'true' : true;
  });

  const currentDateRange = useMemo(
    () =>
      dateRange && dateRange.length >= 2 && dateRange[0] && dateRange[1]
        ? {
          from: dayjs(dateRange[0]).format('YYYY-MM-DD'),
          to: dayjs(dateRange[1]).format('YYYY-MM-DD'),
        }
        : {
          from: dayjs().startOf('month').format('YYYY-MM-DD'),
          to: dayjs().endOf('month').format('YYYY-MM-DD'),
        },
    [dateRange]
  );

  useEffect(() => {
    setHolidayInfo({ count: 0, adjustedHours: parseFloat(totals.total_estimated_hours || '0') });
  }, [currentDateRange.from, currentDateRange.to, totals.total_estimated_hours]);

  useEffect(() => {
    if (showToggleButton) {
      localStorage.setItem('totalTimeUtilizationVisible', String(isVisible));
    }
  }, [isVisible, showToggleButton]);

  const toggleVisibility = () => {
    setIsVisible(prev => !prev);
  };

  const utilizationData = useMemo(() => {
    const timeLogged = parseFloat(totals.total_time_logs || '0');
    const estimatedHours =
      holidayInfo && holidayInfo.adjustedHours > 0
        ? holidayInfo.adjustedHours
        : parseFloat(totals.total_estimated_hours || '0');
    const utilizationPercent = estimatedHours > 0 ? (timeLogged / estimatedHours) * 100 : 0;

    const status =
      utilizationPercent < utilizationMinThreshold
        ? 'under'
        : utilizationPercent > utilizationMaxThreshold
          ? 'over'
          : 'optimal';
    const statusConfigs = {
      under: { color: '#faad14', text: t('underUtilized') },
      optimal: { color: '#52c41a', text: t('optimal') },
      over: { color: '#ff4d4f', text: t('overUtilized') },
    };

    const config = statusConfigs[status];
    return {
      timeLogged,
      estimatedHours,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      status,
      statusColor: config.color,
      statusText: config.text,
    };
  }, [totals, t, holidayInfo, utilizationMinThreshold, utilizationMaxThreshold]);

  const colors = useMemo(
    () => ({
      card: {
        bg: isDark ? '#1f1f1f' : '#fff',
        border: isDark ? '#303030' : '#f0f0f0',
        shadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
      },
      text: {
        primary: isDark ? '#fff' : '#262626',
        secondary: isDark ? '#bfbfbf' : '#8c8c8c',
        tertiary: isDark ? '#8c8c8c' : '#595959',
      },
      progress: isDark ? '#262626' : '#f5f5f5',
      variance: {
        bgPos: isDark ? '#0f1b0f' : '#f6ffed',
        bgNeg: isDark ? '#1f0f0f' : '#fff2f0',
        colPos: isDark ? '#73d13d' : '#389e0d',
        colNeg: isDark ? '#ff7875' : '#a8071a',
      },
    }),
    [isDark]
  );

  const cardStyle = {
    borderRadius: '8px',
    flex: '1 1 220px',
    minWidth: 220,
    boxShadow: colors.card.shadow,
    border: `1px solid ${colors.card.border}`,
    backgroundColor: colors.card.bg,
    transition: 'all 0.3s',
  };

  const MetricCard = ({
    title,
    value,
    valueColor,
    subtitle,
    extra,
  }: {
    title: React.ReactNode;
    value: React.ReactNode;
    valueColor?: string;
    subtitle: React.ReactNode;
    extra?: React.ReactNode;
  }) => (
    <Card style={cardStyle} styles={{ body: { padding: '20px' } }}>
      <Flex
        justify="space-between"
        align="center"
        wrap="wrap"
        gap={8}
        style={{ marginBottom: '4px' }}
      >
        <div style={{ fontSize: 12, color: colors.text.secondary, fontWeight: 500 }}>{title}</div>
        {extra}
      </Flex>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: valueColor || colors.text.primary,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: colors.text.tertiary, marginTop: '2px' }}>
        {subtitle}
      </div>
    </Card>
  );

  const SkeletonCard = ({ wide }: { wide?: boolean }) => (
    <Card
      style={wide ? { ...cardStyle, flex: '2 1 220px', minWidth: 220 } : cardStyle}
      styles={{ body: { padding: '20px' } }}
    >
      <Skeleton active title={false} paragraph={{ rows: 3, width: ['40%', '60%', '80%'] }} />
    </Card>
  );

  const isOver = utilizationData.timeLogged > utilizationData.estimatedHours;
  const variance = (utilizationData.timeLogged - utilizationData.estimatedHours).toFixed(1);

  return (
    <div style={{ marginBottom: '16px' }}>
      {showToggleButton && (
        <Flex justify="flex-end" style={{ marginBottom: '8px' }}>
          <Button
            type="text"
            size="small"
            icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={toggleVisibility}
            style={{ fontSize: '12px', color: colors.text.secondary }}
          >
            {isVisible
              ? t('hideUtilization', { defaultValue: 'Hide Utilization' })
              : t('showUtilization', { defaultValue: 'Show Utilization' })}
          </Button>
        </Flex>
      )}

      {isVisible && loading && (
        <Flex gap={16} wrap="wrap">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard wide />
          <SkeletonCard />
        </Flex>
      )}

      {isVisible && !loading && (
        <Flex gap={16} wrap="wrap">
          <MetricCard
            title={t('totalTimeLogged')}
            value={`${totals.total_time_logs}h`}
            subtitle={t('acrossAllTeamMembers')}
          />

          <MetricCard
            title={t('expectedCapacity')}
            value={`${utilizationData.estimatedHours.toFixed(1)}h`}
            subtitle={
              holidayInfo?.count
                ? `${t('basedOnWorkingSchedule')} (${holidayInfo.count} ${t('holidaysExcluded')})`
                : t('basedOnWorkingSchedule')
            }
          />

          <Card
            style={{
              ...cardStyle,
              flex: '2 1 220px',
              minWidth: 220,
              borderColor: utilizationData.statusColor,
              borderWidth: '2px',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <Flex justify="space-between" align="center" style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: 12, color: colors.text.secondary, fontWeight: 500 }}>
                {t('teamUtilization')}
              </div>
              <Tooltip title={`${utilizationData.statusText} (${t('targetRange')})`}>
                <div
                  style={{
                    fontSize: 10,
                    color: utilizationData.statusColor,
                    fontWeight: 600,
                    backgroundColor: `${utilizationData.statusColor}${isDark ? '20' : '15'}`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  {utilizationData.statusText}
                </div>
              </Tooltip>
            </Flex>
            <Flex align="center" gap={16} wrap="wrap">
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: utilizationData.statusColor,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {utilizationData.utilizationPercent}%
              </div>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <Progress
                  percent={Math.min(utilizationData.utilizationPercent, 150)}
                  strokeColor={{
                    '0%': utilizationData.statusColor,
                    '100%': utilizationData.statusColor,
                  }}
                  trailColor={colors.progress}
                  strokeWidth={6}
                  showInfo={false}
                  style={{ marginBottom: '4px' }}
                />
                <Flex
                  justify="space-between"
                  style={{ fontSize: 10, color: colors.text.secondary }}
                >
                  <span>0%</span>
                  <span style={{ color: '#52c41a' }}>
                    {utilizationMinThreshold}% - {utilizationMaxThreshold}%
                  </span>
                  <span>150%+</span>
                </Flex>
              </div>
            </Flex>
          </Card>

          <MetricCard
            title={t('variance')}
            value={`${isOver ? '+' : ''}${variance}h`}
            valueColor={isOver ? colors.variance.colNeg : colors.variance.colPos}
            subtitle={t(isOver ? 'overCapacity' : 'underCapacity')}
            extra={
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: isOver ? colors.variance.bgNeg : colors.variance.bgPos,
                  fontSize: 10,
                  color: isOver ? colors.variance.colNeg : colors.variance.colPos,
                  fontWeight: 500,
                  whiteSpace: 'normal',
                }}
              >
                {t(isOver ? 'considerWorkloadRedistribution' : 'capacityAvailableForNewProjects')}
              </span>
            }
          />
        </Flex>
      )}
    </div>
  );
};

export default TotalTimeUtilization;
