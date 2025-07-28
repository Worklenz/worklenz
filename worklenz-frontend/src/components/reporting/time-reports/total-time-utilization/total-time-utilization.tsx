import {
  Card,
  Flex,
  Progress,
  Tooltip,
  ClockCircleOutlined,
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
} from '@/shared/antd-imports';
import React, { useMemo, useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { IRPTTimeTotals } from '@/types/reporting/reporting.types';
import { useReportingUtilization } from '@/hooks/useUtilizationCalculation';
import dayjs from 'dayjs';

interface TotalTimeUtilizationProps {
  totals: IRPTTimeTotals;
  dateRange?: string[];
}

const TotalTimeUtilization: React.FC<TotalTimeUtilizationProps> = ({ totals, dateRange }) => {
  const { t } = useTranslation('time-report');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const [holidayInfo, setHolidayInfo] = useState<{ count: number; adjustedHours: number } | null>(
    null
  );

  // Get current date range or default to this month
  const currentDateRange = useMemo(() => {
    if (dateRange && dateRange.length >= 2) {
      return {
        from: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        to: dayjs(dateRange[1]).format('YYYY-MM-DD'),
      };
    }
    return {
      from: dayjs().startOf('month').format('YYYY-MM-DD'),
      to: dayjs().endOf('month').format('YYYY-MM-DD'),
    };
  }, [dateRange]);

  // Temporarily disable holiday integration to prevent API spam
  // TODO: Re-enable once backend endpoints are properly implemented
  const holidayIntegrationEnabled = false;

  useEffect(() => {
    if (!holidayIntegrationEnabled) {
      // For now, just show a placeholder holiday count
      setHolidayInfo({
        count: 0,
        adjustedHours: parseFloat(totals.total_estimated_hours || '0'),
      });
      return;
    }

    // Holiday integration code will be re-enabled once backend is ready
    // ... (previous holiday calculation code)
  }, [
    currentDateRange.from,
    currentDateRange.to,
    totals.total_estimated_hours,
    holidayIntegrationEnabled,
  ]);

  const utilizationData = useMemo(() => {
    const timeLogged = parseFloat(totals.total_time_logs || '0');
    let estimatedHours = parseFloat(totals.total_estimated_hours || '0');

    // Use holiday-adjusted hours if available
    if (holidayInfo?.adjustedHours && holidayInfo.adjustedHours > 0) {
      estimatedHours = holidayInfo.adjustedHours;
    }

    // Recalculate utilization with holiday adjustment
    const utilizationPercent = estimatedHours > 0 ? (timeLogged / estimatedHours) * 100 : 0;

    // Determine utilization status and color
    let status: 'under' | 'optimal' | 'over' = 'optimal';
    let statusColor = '#52c41a'; // Green
    let statusIcon = <CheckCircleOutlined />;
    let statusText = t('optimal');

    if (utilizationPercent < 90) {
      status = 'under';
      statusColor = '#faad14'; // Orange
      statusIcon = <ArrowDownOutlined />;
      statusText = t('underUtilized');
    } else if (utilizationPercent > 110) {
      status = 'over';
      statusColor = '#ff4d4f'; // Red
      statusIcon = <ArrowUpOutlined />;
      statusText = t('overUtilized');
    }

    return {
      timeLogged,
      estimatedHours,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      status,
      statusColor,
      statusIcon,
      statusText,
    };
  }, [totals, t, holidayInfo]);

  const getThemeColors = useMemo(
    () => ({
      cardBackground: isDark ? '#1f1f1f' : '#ffffff',
      cardBorder: isDark ? '#303030' : '#f0f0f0',
      cardShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
      cardHoverShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.5)' : '0 4px 16px rgba(0, 0, 0, 0.12)',
      primaryText: isDark ? '#ffffff' : '#262626',
      secondaryText: isDark ? '#bfbfbf' : '#8c8c8c',
      tertiaryText: isDark ? '#8c8c8c' : '#595959',
      iconBackgrounds: {
        blue: isDark ? '#0f1419' : '#e6f7ff',
        green: isDark ? '#0f1b0f' : '#f6ffed',
      },
      iconColors: {
        blue: isDark ? '#40a9ff' : '#1890ff',
        green: isDark ? '#73d13d' : '#52c41a',
      },
      progressTrail: isDark ? '#262626' : '#f5f5f5',
      varianceBackgrounds: {
        positive: isDark ? '#0f1b0f' : '#f6ffed',
        negative: isDark ? '#1f0f0f' : '#fff2f0',
      },
      varianceColors: {
        positive: isDark ? '#73d13d' : '#389e0d',
        negative: isDark ? '#ff7875' : '#a8071a',
      },
    }),
    [isDark]
  );

  const cardStyle = {
    borderRadius: '8px',
    flex: 1,
    boxShadow: getThemeColors.cardShadow,
    border: `1px solid ${getThemeColors.cardBorder}`,
    backgroundColor: getThemeColors.cardBackground,
    transition: 'all 0.3s ease',
  };

  return (
    <Flex gap={16} style={{ marginBottom: '16px' }}>
      {/* Total Time Logs Card */}
      <Card
        style={cardStyle}
        styles={{
          body: { padding: '20px' },
        }}
      >
        <Flex align="center" gap={12}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              backgroundColor: getThemeColors.iconBackgrounds.blue,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: getThemeColors.iconColors.blue,
            }}
          >
            <ClockCircleOutlined />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                color: getThemeColors.secondaryText,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
              }}
            >
              {t('totalTimeLogged')}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: getThemeColors.primaryText,
                lineHeight: 1,
              }}
            >
              {totals.total_time_logs}h
            </div>
            <div
              style={{
                fontSize: 11,
                color: getThemeColors.tertiaryText,
                marginTop: '2px',
              }}
            >
              {t('acrossAllTeamMembers')}
            </div>
          </div>
        </Flex>
      </Card>

      {/* Estimated Hours Card */}
      <Card
        style={cardStyle}
        styles={{
          body: { padding: '20px' },
        }}
      >
        <Flex align="center" gap={12}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              backgroundColor: getThemeColors.iconBackgrounds.green,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: getThemeColors.iconColors.green,
            }}
          >
            <CalendarOutlined />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                color: getThemeColors.secondaryText,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
              }}
            >
              {t('expectedCapacity')}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: getThemeColors.primaryText,
                lineHeight: 1,
              }}
            >
              {utilizationData.estimatedHours.toFixed(1)}h
            </div>
            <div
              style={{
                fontSize: 11,
                color: getThemeColors.tertiaryText,
                marginTop: '2px',
              }}
            >
              {holidayInfo?.count
                ? `${t('basedOnWorkingSchedule')} (${holidayInfo.count} ${t('holidaysExcluded')})`
                : t('basedOnWorkingSchedule')}
            </div>
          </div>
        </Flex>
      </Card>

      {/* Utilization Card with Progress */}
      <Card
        style={{
          ...cardStyle,
          borderColor: utilizationData.statusColor,
          borderWidth: '2px',
        }}
        styles={{
          body: { padding: '20px' },
        }}
      >
        <Flex align="center" gap={12}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              backgroundColor: `${utilizationData.statusColor}${isDark ? '20' : '15'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: utilizationData.statusColor,
            }}
          >
            {utilizationData.statusIcon}
          </div>
          <div style={{ flex: 1 }}>
            <Flex justify="space-between" align="center" style={{ marginBottom: '4px' }}>
              <div
                style={{
                  fontSize: 12,
                  color: getThemeColors.secondaryText,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
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
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: utilizationData.statusColor,
                lineHeight: 1,
                marginBottom: '8px',
              }}
            >
              {utilizationData.utilizationPercent}%
            </div>
            <Progress
              percent={Math.min(utilizationData.utilizationPercent, 150)} // Cap at 150% for display
              strokeColor={{
                '0%': utilizationData.statusColor,
                '100%': utilizationData.statusColor,
              }}
              trailColor={getThemeColors.progressTrail}
              strokeWidth={6}
              showInfo={false}
              style={{ marginBottom: '4px' }}
            />
            <Flex
              justify="space-between"
              style={{ fontSize: 10, color: getThemeColors.secondaryText }}
            >
              <span>0%</span>
              <span style={{ color: '#52c41a' }}>90% - 110%</span>
              <span>150%+</span>
            </Flex>
          </div>
        </Flex>
      </Card>

      {/* Additional Insights Card */}
      <Card
        style={cardStyle}
        styles={{
          body: { padding: '20px' },
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 12,
              color: getThemeColors.secondaryText,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            {t('variance')}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color:
                utilizationData.timeLogged > utilizationData.estimatedHours
                  ? getThemeColors.varianceColors.negative
                  : getThemeColors.varianceColors.positive,
              lineHeight: 1,
              marginBottom: '4px',
            }}
          >
            {utilizationData.timeLogged > utilizationData.estimatedHours ? '+' : ''}
            {(utilizationData.timeLogged - utilizationData.estimatedHours).toFixed(1)}h
          </div>
          <div
            style={{
              fontSize: 11,
              color: getThemeColors.tertiaryText,
            }}
          >
            {utilizationData.timeLogged > utilizationData.estimatedHours
              ? t('overCapacity')
              : t('underCapacity')}
          </div>
          <div
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor:
                utilizationData.timeLogged > utilizationData.estimatedHours
                  ? getThemeColors.varianceBackgrounds.negative
                  : getThemeColors.varianceBackgrounds.positive,
              fontSize: 10,
              color:
                utilizationData.timeLogged > utilizationData.estimatedHours
                  ? getThemeColors.varianceColors.negative
                  : getThemeColors.varianceColors.positive,
              fontWeight: 500,
            }}
          >
            {utilizationData.timeLogged > utilizationData.estimatedHours
              ? t('considerWorkloadRedistribution')
              : t('capacityAvailableForNewProjects')}
          </div>
        </div>
      </Card>
    </Flex>
  );
};

export default TotalTimeUtilization;
