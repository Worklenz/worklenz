import React, { useEffect, useState } from 'react';
import ReportsOverviewStatusGraph from './reports-overview-status-graph';
import OverviewReportsProjectCategoryGraph from './reports-overview-category-graph';
import OverviewReportsProjectHealthGraph from './reports-overview-project-health-graph';
import { IRPTOverviewTeamInfo } from '@/types/reporting/reporting.types';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';

type OverviewReportsOverviewTabProps = {
  teamId?: string | null;
};

const OverviewReportsOverviewTab = ({ teamId = null }: OverviewReportsOverviewTabProps) => {
  const [model, setModel] = useState<IRPTOverviewTeamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const { includeArchivedProjects } = useAppSelector(state => state.reportingReducer);

  const getModelData = async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      const { done, body } = await reportingApiService.getTeamInfo(teamId, includeArchivedProjects);
      if (done) {
        setModel(body);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getModelData();
  }, [includeArchivedProjects]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ReportsOverviewStatusGraph data={model?.by_status} />
      <OverviewReportsProjectCategoryGraph data={model?.by_category} />
      <OverviewReportsProjectHealthGraph data={model?.by_health} />
    </div>
  );
};

export default OverviewReportsOverviewTab;
