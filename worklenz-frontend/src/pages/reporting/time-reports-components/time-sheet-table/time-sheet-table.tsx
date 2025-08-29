import React, { useEffect, useState } from 'react';
import { MemberLoggedTimeType } from '@/types/timeSheet/project.types';
import { Empty, Progress, Spin } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { reportingTimesheetApiService } from '@/api/reporting/reporting.timesheet.api.service';
import { IAllocationProject } from '@/types/reporting/reporting-allocation.types';
import './time-sheet-table.css';

const TimeSheetTable: React.FC = () => {
  const [projects, setProjects] = useState<IAllocationProject[]>([]);
  const [members, setMembers] = useState<MemberLoggedTimeType[]>([]);
  const [loading, setLoading] = useState(false);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const {
    teams,
    loadingTeams,
    categories,
    loadingCategories,
    projects: filterProjects,
    loadingProjects,
    billable,
    archived,
  } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  const { t } = useTranslation('time-report');

  const isNumeric = (value: string | undefined): boolean => {
    if (!value) return false;
    // Check if the value is a number or a time format (e.g., "1h 30m")
    return /^[0-9]+([,.][0-9]+)?$|^[0-9]+h( [0-9]+m)?$|^[0-9]+m$/.test(value.trim());
  };

  const fetchTimeSheetData = async () => {
    try {
      setLoading(true);
      const selectedTeams = teams.filter(team => team.selected);
      const selectedProjects = filterProjects.filter(project => project.selected);
      const selectedCategories = categories.filter(category => category.selected);
      const body = {
        teams: selectedTeams.map(t => t.id) as string[],
        projects: selectedProjects.map(project => project.id) || [],
        categories: selectedCategories.map(category => category.id) || [],
        duration,
        date_range: dateRange,
        archived,
        billable,
      };
      const response = await reportingTimesheetApiService.getTimeSheetData(body, archived);
      if (response.done) {
        setProjects(response.body.projects);
        setMembers(response.body.users);
      }
    } catch (error) {
      console.error('Error fetching time sheet data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingTeams && !loadingCategories && !loadingProjects) fetchTimeSheetData();
  }, [teams, duration, dateRange, filterProjects, categories, billable, archived]);

  // Set theme variables
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--background-color', '#141414');
    } else {
      root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.06)');
      root.style.setProperty('--background-color', '#fff');
    }
  }, [themeMode]);

  return (
    <Spin spinning={loading} tip="Loading...">
      <div
        style={{
          overflow: 'auto',
          width: 'max-content',
          maxWidth: 'calc(100vw - 225px)',
        }}
      >
        {members.length == 0 && projects.length == 0 && (
          <div className="no-data">
            <Empty description="No data" />
          </div>
        )}
        {/* Columns */}
        {members && members.length > 0 ? (
          <div className="header-row d-flex">
            <div className="project-name"></div>
            {members.map(item => (
              <div key={item.id} className="member-name f-500">
                {item.name}
              </div>
            ))}
            <div className="total-time text-center">Total</div>
          </div>
        ) : null}

        {/* Rows */}
        {projects.length > 0 ? (
          <>
            {projects.map((item, index) => (
              <div key={index} className="table-row_ d-flex">
                <div className="project-name">
                  <span className="anticon" style={{ color: item.status_color_code }}>
                    <i className={item.status_icon}></i>
                  </span>
                  <span className="ms-1">{item.name}</span>
                  <div className="d-block">
                    <Progress percent={item.progress} strokeColor={item.color_code} size="small" />
                  </div>
                </div>
                {item.time_logs?.map((log, index) => (
                  <div
                    key={index}
                    className={`member-time ${isNumeric(log.time_logged) ? 'numeric' : ''}`}
                  >
                    {log.time_logged}
                  </div>
                ))}
                <div className="total-time">{item.total}</div>
              </div>
            ))}

            {/* total row */}
            {members.length > 0 && (
              <div className="table-row_ d-flex bottom-row">
                <div className="project-name bg-bold">Total</div>
                {members.map(item => (
                  <div
                    key={item.id}
                    className={`member-total-time bg-bold ${isNumeric(item.total_time) ? 'numeric' : ''}`}
                  >
                    {item.total_time}
                  </div>
                ))}
                <div className="total-time"></div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Spin>
  );
};

export default TimeSheetTable;
