import React, { useEffect } from 'react';
import Team from './team';
import Categories from './categories';
import Projects from './projects';
import Billable from './billable';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchReportingTeams,
  fetchReportingProjects,
  fetchReportingCategories,
  fetchReportingMembers,
  fetchReportingUtilization,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import Members from './members';
import Utilization from './utilization';

const TimeReportPageHeader: React.FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const fetchData = async () => {
      await dispatch(fetchReportingTeams());
      await dispatch(fetchReportingCategories());
      await dispatch(fetchReportingProjects());
      await dispatch(fetchReportingMembers());
      await dispatch(fetchReportingUtilization());
    };

    fetchData();
  }, [dispatch]);

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Team />
      <Categories />
      <Projects />
      <Billable />
      <Members/>
      <Utilization />
    </div>
  );
};

export default TimeReportPageHeader;
