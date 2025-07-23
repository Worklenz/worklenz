import { Flex, Skeleton } from '@/shared/antd-imports';
import React, { useEffect, useMemo, useState } from 'react';
import EmptyListPlaceholder from '@/components/EmptyListPlaceholder';
import ActivityLogCard from './activity-log-card';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { ISingleMemberActivityLogs } from '@/types/reporting/reporting.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { useAuthService } from '@/hooks/useAuth';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

type MembersReportsActivityLogsTabProps = {
  memberId: string | null;
};

const MembersReportsActivityLogsTab = ({ memberId = null }: MembersReportsActivityLogsTabProps) => {
  const { t } = useTranslation('reporting-members-drawer');
  const currentSession = useAuthService().getCurrentSession();

  const [activityLogsData, setActivityLogsData] = useState<ISingleMemberActivityLogs[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);
  const { archived } = useAppSelector(state => state.membersReportsReducer);

  const fetchActivityLogsData = async () => {
    if (!memberId || !currentSession?.team_id) return;
    try {
      setLoading(true);
      const body = {
        team_member_id: memberId,
        team_id: currentSession?.team_id as string,
        duration: duration,
        date_range: dateRange,
        archived: archived,
      };
      const response = await reportingApiService.getSingleMemberActivities(body);
      if (response.done) {
        setActivityLogsData(response.body);
      }
    } catch (error) {
      logger.error('fetchActivityLogsData', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityLogsData();
  }, [memberId, duration, dateRange, archived]);

  return (
    <Skeleton active loading={loading} paragraph={{ rows: 10 }}>
      {activityLogsData.length > 0 ? (
        <Flex vertical gap={24}>
          {activityLogsData.map(logs => (
            <ActivityLogCard key={logs.log_day} data={logs} />
          ))}
        </Flex>
      ) : (
        <EmptyListPlaceholder text={t('activityLogsEmptyPlaceholder')} />
      )}

      {/* update task drawer  */}
      {createPortal(<TaskDrawer />, document.body)}
    </Skeleton>
  );
};

export default MembersReportsActivityLogsTab;
