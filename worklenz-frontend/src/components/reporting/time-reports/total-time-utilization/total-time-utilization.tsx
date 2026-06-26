import {
  Card,
  Flex,
  Progress,
  Tooltip,
  Button,
  ClockCircleOutlined,
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
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
}

const TotalTimeUtilization: React.FC<TotalTimeUtilizationProps> = ({ totals, dateRange }) => {
  const { t } = useTranslation('time-report');
  const isDark = useAppSelector(state => state.themeReducer.mode) === 'dark';
  const [holidayInfo, setHolidayInfo] = useState<{ count: number; adjustedHours: number } | null>(
    null
  );
  const [isVisible, setIsVisible] = useState(() => {
    const stored = localStorage.getItem('totalTimeUtilizationVisible');
    return stored !== null ? stored === 'true' : true;
  });

  const currentDateRange = useMemo(
    () =>
      dateRange?.length >= 2
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
    localStorage.setItem('totalTimeUtilizationVisible', String(isVisible));
  }, [isVisible]);

  const toggleVisibility = () => {
    setIsVisible(prev => !prev);
  };

  const utilizationData = useMemo(() => {
    const timeLogged = parseFloat(totals.total_time_logs || '0');
    const estimatedHours =
      holidayInfo?.adjustedHours > 0
        ? holidayInfo.adjustedHours
        : parseFloat(totals.total_estimated_hours || '0');
    const utilizationPercent = estimatedHours > 0 ? (timeLogged / estimatedHours) * 100 : 0;

    const status =
      utilizationPercent < 90 ? 'under' : utilizationPercent > 110 ? 'over' : 'optimal';
    const statusConfigs = {
      under: { color: '#faad14', icon: <ArrowDownOutlined />, text: t('underUtilized') },
      optimal: { color: '#52c41a', icon: <CheckCircleOutlined />, text: t('optimal') },
      over: { color: '#ff4d4f', icon: <ArrowUpOutlined />, text: t('overUtilized') },
    };

    const config = statusConfigs[status];
    return {
      timeLogged,
      estimatedHours,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      status,
      statusColor: config.color,
      statusIcon: config.icon,
      statusText: config.text,
    };
  }, [totals, t, holidayInfo]);

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
      icon: {
        bgBlue: isDark ? '#0f1419' : '#e6f7ff',
        bgGreen: isDark ? '#0f1b0f' : '#f6ffed',
        blue: isDark ? '#40a9ff' : '#1890ff',
        green: isDark ? '#73d13d' : '#52c41a',
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
    flex: 1,
    boxShadow: colors.card.shadow,
    border: `1px solid ${colors.card.border}`,
    backgroundColor: colors.card.bg,
    transition: 'all 0.3s',
  };

  const IconBox = ({ bg, color, icon }) => (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '12px',
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        color,
      }}
    >
      {icon}
    </div>
  );

  const MetricCard = ({ icon, iconBg, iconColor, title, value, subtitle }) => (
    <Card style={cardStyle} styles={{ body: { padding: '20px' } }}>
      <Flex align="center" gap={12}>
        <IconBox bg={iconBg} color={iconColor} icon={icon} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              color: colors.text.secondary,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: colors.text.primary, lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ fontSize: 11, color: colors.text.tertiary, marginTop: '2px' }}>
            {subtitle}
          </div>
        </div>
      </Flex>
    </Card>
  );

  const isOver = utilizationData.timeLogged > utilizationData.estimatedHours;
  const variance = (utilizationData.timeLogged - utilizationData.estimatedHours).toFixed(1);

  return (
    <div style={{ marginBottom: '16px' }}>
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

      {isVisible && (
        <Flex gap={16}>
          <MetricCard
            icon={<ClockCircleOutlined />}
            iconBg={colors.icon.bgBlue}
            iconColor={colors.icon.blue}
            title={t('totalTimeLogged')}
            value={`${totals.total_time_logs}h`}
            subtitle={t('acrossAllTeamMembers')}
          />

          <MetricCard
            icon={<CalendarOutlined />}
            iconBg={colors.icon.bgGreen}
            iconColor={colors.icon.green}
            title={t('expectedCapacity')}
            value={`${utilizationData.estimatedHours.toFixed(1)}h`}
            subtitle={
              holidayInfo?.count
                ? `${t('basedOnWorkingSchedule')} (${holidayInfo.count} ${t('holidaysExcluded')})`
                : t('basedOnWorkingSchedule')
            }
          />

          <Card
            style={{ ...cardStyle, borderColor: utilizationData.statusColor, borderWidth: '2px' }}
            styles={{ body: { padding: '20px' } }}
          >
            <Flex align="center" gap={12}>
              <IconBox
                bg={`${utilizationData.statusColor}${isDark ? '20' : '15'}`}
                color={utilizationData.statusColor}
                icon={utilizationData.statusIcon}
              />
              <div style={{ flex: 1 }}>
                <Flex justify="space-between" align="center" style={{ marginBottom: '4px' }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.text.secondary,
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
                  <span style={{ color: '#52c41a' }}>90% - 110%</span>
                  <span>150%+</span>
                </Flex>
              </div>
            </Flex>
          </Card>

          <Card style={cardStyle} styles={{ body: { padding: '20px' } }}>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 12,
                  color: colors.text.secondary,
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
                  color: isOver ? colors.variance.colNeg : colors.variance.colPos,
                  lineHeight: 1,
                  marginBottom: '4px',
                }}
              >
                {isOver ? '+' : ''}
                {variance}h
              </div>
              <div style={{ fontSize: 11, color: colors.text.tertiary }}>
                {t(isOver ? 'overCapacity' : 'underCapacity')}
              </div>
              <div
                style={{
                  marginTop: '8px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: isOver ? colors.variance.bgNeg : colors.variance.bgPos,
                  fontSize: 10,
                  color: isOver ? colors.variance.colNeg : colors.variance.colPos,
                  fontWeight: 500,
                }}
              >
                {t(isOver ? 'considerWorkloadRedistribution' : 'capacityAvailableForNewProjects')}
              </div>
            </div>
          </Card>
        </Flex>
      )}
    </div>
  );
};

export default TotalTimeUtilization;
