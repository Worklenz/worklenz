import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Team from './Team';
import Categories from './Categories';
import Projects from './Projects';
import Billable from './Billable';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchReportingTeams,
  fetchReportingProjects,
  fetchReportingCategories,
  fetchReportingMembers,
  fetchReportingUtilization,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import Members from './Members';
import Utilization from './Utilization';

const TimeReportPageHeader: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();

  // Check if current route is members time sheet
  const isMembersTimeSheet = location.pathname.includes('time-sheet-members');

  useEffect(() => {
    const fetchData = async () => {
      await dispatch(fetchReportingTeams());
      await dispatch(fetchReportingCategories());
      await dispatch(fetchReportingProjects());

      // Only fetch members and utilization data for members time sheet
      if (isMembersTimeSheet) {
        await dispatch(fetchReportingMembers());
        await dispatch(fetchReportingUtilization());
      }
    };

    fetchData();
  }, [dispatch, isMembersTimeSheet]);

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Team />
      <Categories />
      <Projects />
      <Billable />
      {isMembersTimeSheet && <Members />}
      {isMembersTimeSheet && <Utilization />}
    </div>
  );
};

export default TimeReportPageHeader;
