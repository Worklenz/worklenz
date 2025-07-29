import { Flex, Skeleton } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import BillableFilter from './billable-filter';
import { fetchData } from '@/utils/fetchData';
import TimeLogCard from './time-log-card';
import EmptyListPlaceholder from '../../../../../components/EmptyListPlaceholder';
import { useTranslation } from 'react-i18next';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import logger from '@/utils/errorLogger';
import { ISingleMemberLogs } from '@/types/reporting/reporting.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { createPortal } from 'react-dom';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

type MembersReportsTimeLogsTabProps = {
  memberId: string | null;
};

const MembersReportsTimeLogsTab = ({ memberId = null }: MembersReportsTimeLogsTabProps) => {
  const { t } = useTranslation('reporting-members-drawer');
  const currentSession = useAuthService().getCurrentSession();

  const [timeLogsData, setTimeLogsData] = useState<ISingleMemberLogs[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);
  const { archived } = useAppSelector(state => state.membersReportsReducer);
  const [billable, setBillable] = useState<{ billable: boolean; nonBillable: boolean }>({
    billable: true,
    nonBillable: true,
  });

  const fetchTimeLogsData = async () => {
    if (!memberId || !currentSession?.team_id) return;
    try {
      setLoading(true);
      const body = {
        team_member_id: memberId,
        team_id: currentSession?.team_id as string,
        duration: duration,
        date_range: dateRange,
        archived: archived,
        billable: billable,
      };
      const response = await reportingApiService.getSingleMemberTimeLogs(body);
      if (response.done) {
        response.body.sort((a: any, b: any) => {
          const dateA = new Date(a.log_day);
          const dateB = new Date(b.log_day);
          return dateB.getTime() - dateA.getTime();
        });
        setTimeLogsData(response.body);
      }
    } catch (error) {
      logger.error('fetchTimeLogsData', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeLogsData();
  }, [memberId, duration, dateRange, archived, billable]);

  return (
    <Flex vertical gap={24}>
      <BillableFilter billable={billable} onBillableChange={setBillable} />

      <Skeleton active loading={loading} paragraph={{ rows: 10 }}>
        {timeLogsData.length > 0 ? (
          <Flex vertical gap={24}>
            {timeLogsData.map((logs, index) => (
              <TimeLogCard key={index} data={logs} />
            ))}
          </Flex>
        ) : (
          <EmptyListPlaceholder text={t('timeLogsEmptyPlaceholder')} />
        )}
      </Skeleton>

      {createPortal(<TaskDrawer />, document.body)}
    </Flex>
  );
};

export default MembersReportsTimeLogsTab;
