import React, { useEffect } from 'react';
import MembersReportsStatCard from './members-reports-stat-card';
import MembersReportsStatusGraph from './MembersReportsStatusGraph';
import MembersReportsPriorityGraph from './MembersReportsPriorityGraph';
import MembersReportsProjectGraph from './MembersReportsProjectGraph';
import { IRPTOverviewMemberInfo } from '@/types/reporting/reporting.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';
import { set } from 'date-fns';

type MembersReportsOverviewTabProps = {
  memberId: string | null;
};

const MembersReportsOverviewTab = ({ memberId }: MembersReportsOverviewTabProps) => {
  const [model, setModel] = React.useState<IRPTOverviewMemberInfo>({});
  const [loadingModel, setLoadingModel] = React.useState<boolean>(true);

  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);
  const { archived } = useAppSelector(state => state.membersReportsReducer);

  const fetchStatsModelData = async () => {
    if (!memberId || !duration || !dateRange) return;
    try {
      setLoadingModel(true);
      const body = {
        teamMemberId: memberId,
        duration: duration,
        date_range: dateRange,
        archived,
      };
      const response = await reportingApiService.getMemberInfo(body);
      if (response.done) {
        setModel(response.body);
      }
    } catch (error) {
      logger.error('fetchStatsModelData', error);
    } finally {
      setLoadingModel(false);
    }
  };

  useEffect(() => {
    fetchStatsModelData();
  }, [memberId, duration, dateRange]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MembersReportsStatCard statsModel={model.stats} loading={loadingModel} />
      <MembersReportsProjectGraph model={model.by_project} loading={loadingModel} />
      <MembersReportsStatusGraph model={model.by_status} loading={loadingModel} />
      <MembersReportsPriorityGraph model={model.by_priority} loading={loadingModel} />
    </div>
  );
};

export default MembersReportsOverviewTab;
