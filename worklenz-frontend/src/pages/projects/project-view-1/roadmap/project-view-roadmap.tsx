import { useState, useEffect } from 'react';
import { useMixpanelTracking } from '../../../../hooks/useMixpanelTracking';
import { evt_project_roadmap_visit } from '../../../../shared/worklenz-analytics-events';
import { ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import './project-view-roadmap.css';
import { Flex } from '@/shared/antd-imports';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { TimeFilter } from './time-filter';
import RoadmapTable from './roadmap-table/roadmap-table';
import RoadmapGrantChart from './roadmap-grant-chart';

const ProjectViewRoadmap = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.Day);
  const { trackMixpanelEvent } = useMixpanelTracking();

  // get theme details
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  useEffect(() => {
    trackMixpanelEvent(evt_project_roadmap_visit);
  }, [trackMixpanelEvent]);

  return (
    <Flex vertical className={`${themeMode === 'dark' ? 'dark-theme' : ''}`}>
      {/* time filter */}
      <TimeFilter onViewModeChange={viewMode => setView(viewMode)} />

      <Flex>
        {/* table */}
        <div className="after:content relative h-fit w-full max-w-[500px] after:absolute after:-right-3 after:top-0 after:z-10 after:min-h-full after:w-3 after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent">
          <RoadmapTable />
        </div>

        {/* gantt Chart */}
        <RoadmapGrantChart view={view} />
      </Flex>
    </Flex>
  );
};

export default ProjectViewRoadmap;
