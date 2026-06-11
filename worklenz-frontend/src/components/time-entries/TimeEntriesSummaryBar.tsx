import React from 'react';
import { Flex, Typography, Skeleton } from '@/shared/antd-imports';
import { ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import { IMySummary } from '@/api/tasks/task-time-logs.api.service';

const { Text } = Typography;

const formatSeconds = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  accentBg: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, accent, accentBg }) => {
  const { token } = theme.useToken();
  return (
    <Flex
      align="center"
      gap={14}
      style={{
        flex: 1,
        padding: '16px 20px',
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Flex
        align="center"
        justify="center"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: accentBg,
          color: accent,
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </Flex>
      <Flex vertical gap={2}>
        <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.2 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, color: token.colorText }}>
          {value}
        </Text>
      </Flex>
    </Flex>
  );
};

interface TimeEntriesSummaryBarProps {
  summary: IMySummary | null;
  loading: boolean;
}

export const TimeEntriesSummaryBar: React.FC<TimeEntriesSummaryBarProps> = ({ summary, loading }) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();

  if (loading) {
    return (
      <Flex gap={16} style={{ marginBottom: 16 }}>
        {[1, 2].map(i => (
          <Flex
            key={i}
            align="center"
            gap={14}
            style={{
              flex: 1,
              padding: '16px 20px',
              borderRadius: token.borderRadiusLG,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Skeleton.Avatar active size={44} shape="circle" />
            <Skeleton.Input active size="small" style={{ width: 90 }} />
          </Flex>
        ))}
      </Flex>
    );
  }

  return (
    <Flex gap={16} style={{ marginBottom: 16 }}>
      <StatCard
        icon={<ClockCircleOutlined />}
        label={t('todayTotal', { defaultValue: 'Today' })}
        value={formatSeconds(summary?.today_total ?? 0)}
        accent={token.colorPrimary}
        accentBg={token.colorPrimaryBg}
      />
      <StatCard
        icon={<CalendarOutlined />}
        label={t('weekTotal', { defaultValue: 'This Week' })}
        value={formatSeconds(summary?.week_total ?? 0)}
        accent={token.colorSuccess}
        accentBg={token.colorSuccessBg}
      />
    </Flex>
  );
};
