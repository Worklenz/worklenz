import { Flex, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import OverviewStatCard from './overview-stat-card';
import { BankOutlined, FileOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewStatistics } from '@/types/reporting/reporting.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';

const OverviewStats = () => {
  const [stats, setStats] = useState<IRPTOverviewStatistics>({});
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation('reporting-overview');
  const includeArchivedProjects = useAppSelector(
    state => state.reportingReducer.includeArchivedProjects
  );

  const getOverviewStats = async () => {
    setLoading(true);
    try {
      const { done, body } =
        await reportingApiService.getOverviewStatistics(includeArchivedProjects);
      if (done) {
        setStats(body);
      }
    } catch (error) {
      console.error('Failed to fetch overview statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getOverviewStats();
  }, [includeArchivedProjects]);

  const renderStatText = (count: number = 0, singularKey: string, pluralKey: string) => {
    return `${count} ${count === 1 ? t(singularKey) : t(pluralKey)}`;
  };

  const renderStatCard = (
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
          <Typography.Text key={index} type={stat.type}>
            {stat.text}
          </Typography.Text>
        ))}
      </Flex>
    </OverviewStatCard>
  );

  return (
    <Flex gap={24}>
      {renderStatCard(
        <BankOutlined style={{ color: colors.skyBlue, fontSize: 42 }} />,
        stats?.teams?.count,
        'teamCount',
        [
          {
            text: renderStatText(stats?.teams?.projects, 'projectCount', 'projectCountPlural'),
            type: 'secondary',
          },
          {
            text: renderStatText(stats?.teams?.members, 'memberCount', 'memberCountPlural'),
            type: 'secondary',
          },
        ]
      )}

      {renderStatCard(
        <FileOutlined style={{ color: colors.limeGreen, fontSize: 42 }} />,
        stats?.projects?.count,
        'projectCount',
        [
          {
            text: renderStatText(
              stats?.projects?.active,
              'activeProjectCount',
              'activeProjectCountPlural'
            ),
            type: 'secondary',
          },
          {
            text: renderStatText(
              stats?.projects?.overdue,
              'overdueProjectCount',
              'overdueProjectCountPlural'
            ),
            type: 'danger',
          },
        ]
      )}

      {renderStatCard(
        <UsergroupAddOutlined style={{ color: colors.lightGray, fontSize: 42 }} />,
        stats?.members?.count,
        'memberCount',
        [
          {
            text: renderStatText(
              stats?.members?.unassigned,
              'unassignedMemberCount',
              'unassignedMemberCountPlural'
            ),
            type: 'secondary',
          },
          {
            text: renderStatText(
              stats?.members?.overdue,
              'memberWithOverdueTaskCount',
              'memberWithOverdueTaskCountPlural'
            ),
            type: 'danger',
          },
        ]
      )}
    </Flex>
  );
};

export default OverviewStats;
