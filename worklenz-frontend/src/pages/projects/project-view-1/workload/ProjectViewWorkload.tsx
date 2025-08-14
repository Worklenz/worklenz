import React, { useEffect } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_workload_visit } from '@/shared/worklenz-analytics-events';

const ProjectViewWorkload = () => {
  const { trackMixpanelEvent } = useMixpanelTracking();

  useEffect(() => {
    trackMixpanelEvent(evt_project_workload_visit);
  }, [trackMixpanelEvent]);

  return <div>ProjectViewWorkload</div>;
};

export default ProjectViewWorkload;
