import ProjectStatsCard from '@/components/projects/project-stats-card';
import { Flex } from '@/shared/antd-imports';
import groupIcon from '@/assets/icons/insightsIcons/group.png';
import warningIcon from '@/assets/icons/insightsIcons/warning.png';
import unassignedIcon from '@/assets/icons/insightsIcons/block-user.png';
import { useEffect, useState } from 'react';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { IProjectMemberStats } from '@/types/project/project-insights.types';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';

const MemberStats = () => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);

  const [memberStats, setMemberStats] = useState<IProjectMemberStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const fetchMemberStats = async () => {
    setLoadingStats(true);
    try {
      const res = await projectInsightsApiService.getMemberInsightAStats(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setMemberStats(res.body);
      }
    } catch (error) {
      logger.error('Error fetching member stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchMemberStats();
  }, [projectId, includeArchivedTasks, refreshTimestamp]);

  return (
    <Flex gap={24} className="grid sm:grid-cols-2 sm:grid-rows-2 lg:grid-cols-3 lg:grid-rows-1">
      <ProjectStatsCard
        icon={groupIcon}
        title="Project Members"
        children={memberStats?.total_members_count}
        loading={loadingStats}
      />
      <ProjectStatsCard
        icon={warningIcon}
        title="Assignees with overdue tasks"
        children={memberStats?.overdue_members}
        loading={loadingStats}
      />
      <ProjectStatsCard
        icon={unassignedIcon}
        title="Unassigned Members"
        children={memberStats?.unassigned_members}
        loading={loadingStats}
      />
    </Flex>
  );
};

export default MemberStats;
