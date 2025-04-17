import React, { useEffect, useState } from 'react';
import ProjectReportsStatCard from './ProjectReportsStatCard';
import ProjectReportsStatusGraph from './ProjectReportsStatusGraph';
import ProjectReportsPriorityGraph from './ProjectReportsPriorityGraph';
import ProjectReportsDueDateGraph from './ProjectReportsDueDateGraph';
import { reportingProjectsApiService } from '@/api/reporting/reporting-projects.api.service';
import { IRPTOverviewProjectInfo } from '@/types/reporting/reporting.types';

type ProjectReportsOverviewTabProps = {
  projectId?: string | null;
};

const ProjectReportsOverviewTab = ({ projectId = null }: ProjectReportsOverviewTabProps) => {
  const [overviewData, setOverviewData] = useState<IRPTOverviewProjectInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchOverviewData = async () => {
    if (!projectId || loading) return;

    try {
      setLoading(true);
      const res = await reportingProjectsApiService.getProjectOverview(projectId);
      if (res.done) {
        setOverviewData(res.body);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [projectId]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ProjectReportsStatCard
        loading={loading}
        values={
          overviewData?.stats || {
            completed: 0,
            incompleted: 0,
            overdue: 0,
            total_allocated: 0,
            total_logged: 0,
          }
        }
      />
      <ProjectReportsStatusGraph
        loading={loading}
        values={
          overviewData?.by_status || {
            todo: 0,
            doing: 0,
            done: 0,
            all: 0,
            chart: [],
          }
        }
      />
      <ProjectReportsPriorityGraph
        loading={loading}
        values={
          overviewData?.by_priority || {
            high: 0,
            medium: 0,
            low: 0,
            all: 0,
            chart: [],
          }
        }
      />
      <ProjectReportsDueDateGraph
        loading={loading}
        values={
          overviewData?.by_due || {
            completed: 0,
            upcoming: 0,
            overdue: 0,
            no_due: 0,
            all: 0,
            chart: [],
          }
        }
      />
    </div>
  );
};

export default ProjectReportsOverviewTab;
