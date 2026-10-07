import { Col, Flex, Row, Typography, theme } from '@/shared/antd-imports';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import OverviewStatCard from './overview-stat-card';
import { BankOutlined, FileOutlined, UsergroupAddOutlined } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewStatistics } from '@/types/reporting/reporting.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

const OverviewStats = () => {
  const [stats, setStats] = useState<IRPTOverviewStatistics>({});
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation('reporting-overview');
  const { token } = theme.useToken();
  const { socket } = useSocket();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const includeArchivedProjects = useAppSelector(
    state => state.reportingReducer.includeArchivedProjects
  );

  const getOverviewStats = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { done, body } =
          await reportingApiService.getOverviewStatistics(includeArchivedProjects);
        if (done) {
          setStats(body);
        }
      } catch (error) {
        console.error('Failed to fetch overview statistics:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [includeArchivedProjects]
  );

  useEffect(() => {
    getOverviewStats();
  }, [getOverviewStats]);

  const handleSocketUpdate = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      getOverviewStats(true);
    }, 150);
  }, [getOverviewStats]);

  useEffect(() => {
    if (!socket) return;

    socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.PROJECT_STATUS_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.PROJECT_DATA_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleSocketUpdate);

    return () => {
      socket.off(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.PROJECT_STATUS_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.PROJECT_DATA_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.TASK_STATUS_CHANGE.toString(), handleSocketUpdate);
    };
  }, [socket, handleSocketUpdate]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const renderStatText = useCallback(
    (count: number = 0, singularKey: string, pluralKey: string) => {
      return `${count} ${count === 1 ? t(singularKey) : t(pluralKey)}`;
    },
    [t]
  );

  const renderStatCard = useCallback(
    (
      icon: React.ReactNode,
      mainCount: number = 0,
      mainKey: string,
      stats: { text: string; type?: 'secondary' | 'danger' }[]
    ) => (
      <OverviewStatCard
        icon={icon}
        title={renderStatText(mainCount, mainKey, `${mainKey}Plural`)}
        loading={loading}
      >
        <Flex vertical>
          {stats.map((stat, index) => (
            <Typography.Text
              key={index}
              type={stat.type}
              style={{
                fontSize: '14px',
                lineHeight: '1.5',
                color:
                  stat.type === 'danger'
                    ? '#ff4d4f'
                    : stat.type === 'secondary'
                      ? token.colorTextSecondary
                      : token.colorText,
              }}
            >
              {stat.text}
            </Typography.Text>
          ))}
        </Flex>
      </OverviewStatCard>
    ),
    [renderStatText, loading, token]
  );

  // Memoize team stats to prevent unnecessary recalculations
  const teamStats = useMemo(
    () => [
      {
        text: renderStatText(stats?.teams?.projects, 'projectCount', 'projectCountPlural'),
        type: 'secondary' as const,
      },
      {
        text: renderStatText(stats?.teams?.members, 'memberCount', 'memberCountPlural'),
        type: 'secondary' as const,
      },
    ],
    [stats?.teams?.projects, stats?.teams?.members, renderStatText]
  );

  // Memoize project stats to prevent unnecessary recalculations
  const projectStats = useMemo(
    () => [
      {
        text: renderStatText(
          stats?.projects?.active,
          'activeProjectCount',
          'activeProjectCountPlural'
        ),
        type: 'secondary' as const,
      },
      {
        text: renderStatText(
          stats?.projects?.overdue,
          'overdueProjectCount',
          'overdueProjectCountPlural'
        ),
        type: 'danger' as const,
      },
    ],
    [stats?.projects?.active, stats?.projects?.overdue, renderStatText]
  );

  // Memoize member stats to prevent unnecessary recalculations
  const memberStats = useMemo(
    () => [
      {
        text: renderStatText(
          stats?.members?.unassigned,
          'unassignedMemberCount',
          'unassignedMemberCountPlural'
        ),
        type: 'secondary' as const,
      },
      {
        text: renderStatText(
          stats?.members?.overdue,
          'memberWithOverdueTaskCount',
          'memberWithOverdueTaskCountPlural'
        ),
        type: 'danger' as const,
      },
    ],
    [stats?.members?.unassigned, stats?.members?.overdue, renderStatText]
  );

  // Memoize icons with enhanced styling for better visibility
  const teamIcon = useMemo(
    () => (
      <BankOutlined
        style={{
          color: colors.skyBlue,
          fontSize: 42,
          filter: 'drop-shadow(0 2px 4px rgba(24, 144, 255, 0.3))',
        }}
      />
    ),
    []
  );

  const projectIcon = useMemo(
    () => (
      <FileOutlined
        style={{
          color: colors.limeGreen,
          fontSize: 42,
          filter: 'drop-shadow(0 2px 4px rgba(82, 196, 26, 0.3))',
        }}
      />
    ),
    []
  );

  const memberIcon = useMemo(
    () => (
      <UsergroupAddOutlined
        style={{
          color: colors.lightGray,
          fontSize: 42,
          filter: 'drop-shadow(0 2px 4px rgba(112, 112, 112, 0.3))',
        }}
      />
    ),
    []
  );

  return (
    <Row gutter={[24, 24]}>
      <Col xs={24} sm={12} lg={8}>
        {renderStatCard(teamIcon, stats?.teams?.count, 'teamCount', teamStats)}
      </Col>

      <Col xs={24} sm={12} lg={8}>
        {renderStatCard(projectIcon, stats?.projects?.count, 'projectCount', projectStats)}
      </Col>

      <Col xs={24} sm={12} lg={8}>
        {renderStatCard(memberIcon, stats?.members?.count, 'memberCount', memberStats)}
      </Col>
    </Row>
  );
};

export default React.memo(OverviewStats);
