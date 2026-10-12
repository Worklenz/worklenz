import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Team from './Team';
import Categories from './Categories';
import Projects from './Projects';
import Billable from './Billable';
import Department from './Department';
import Practice from './Practice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchReportingTeams,
  fetchReportingProjects,
  fetchReportingCategories,
  fetchReportingDepartments,
  fetchReportingPractices,
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

  const { practices, departments } = useAppSelector(state => state.timeReportsOverviewReducer);
  const practicesKey = practices
    .filter(p => p.selected)
    .map(p => p.id)
    .join(',');
  const departmentsKey = departments
    .filter(d => d.selected)
    .map(d => d.id)
    .join(',');
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await dispatch(fetchReportingTeams());
        await dispatch(fetchReportingCategories());
        await dispatch(fetchReportingProjects());

        // Only fetch members and utilization data for members time sheet
        if (isMembersTimeSheet) {
          await dispatch(fetchReportingDepartments());
          await dispatch(fetchReportingPractices());
          await dispatch(fetchReportingMembers());
          await dispatch(fetchReportingUtilization());
        }
      } finally {
        initialLoadDone.current = true;
      }
    };

    initialLoadDone.current = false;
    fetchData();
  }, [dispatch, isMembersTimeSheet]);

  // Re-scope the member dropdown to the selected practices/departments once the
  // initial load has finished, so the list narrows instead of always showing everyone.
  useEffect(() => {
    if (!initialLoadDone.current || !isMembersTimeSheet) return;
    dispatch(fetchReportingMembers());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, practicesKey, departmentsKey]);

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', rowGap: '8px' }}>
      <Team />
      <Categories />
      <Projects />
      <Billable />
      {isMembersTimeSheet && <Department />}
      {isMembersTimeSheet && <Practice />}
      {isMembersTimeSheet && <Members />}
      {isMembersTimeSheet && <Utilization />}
    </div>
  );
};

export default TimeReportPageHeader;
