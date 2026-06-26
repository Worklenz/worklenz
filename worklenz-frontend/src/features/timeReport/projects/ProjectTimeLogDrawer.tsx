import {
  Avatar,
  Button,
  Card,
  Divider,
  Drawer,
  Tag,
  Timeline,
  Typography,
} from '@/shared/antd-imports';
import React, { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleTimeLogDrawer } from './timeLogSlice';
import { DownloadOutlined } from '@/shared/antd-imports';
import jsonData from './ProjectTimeLog.json';
import { AvatarNamesMap, durations } from '../../../shared/constants';
import './ProjectTimeLogDrawer.css';
import { useTranslation } from 'react-i18next';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import { IProjectLogsBreakdown, ITimeLogBreakdownReq } from '@/types/reporting/reporting.types';
import { reportingTimesheetApiService } from '@/api/reporting/reporting.timesheet.api.service';
import { useAuthService } from '@/hooks/useAuth';
import logger from '@/utils/errorLogger';

const ProjectTimeLogDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('time-report');
  const currentSession = useAuthService().getCurrentSession();

  const { selectedLabel, isTimeLogDrawerOpen } = useAppSelector(state => state.timeLogReducer);
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
  const [projectTimeLogs, setProjectTimeLogs] = useState<IProjectLogsBreakdown[]>([]);

  // Format date to desired format
  const formatDate = (date: string) => {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return formattedDate;
  };

  const handleDrawerOpen = async () => {
    if (!selectedLabel?.id) return;
    try {
      const body: ITimeLogBreakdownReq = {
        id: selectedLabel.id,
        duration: duration ? duration : durations[1].key,
        date_range: dateRange,
        time_zone: currentSession?.timezone_name
          ? (currentSession?.timezone_name as string)
          : (Intl.DateTimeFormat().resolvedOptions().timeZone as string),
      };
      const res = await reportingTimesheetApiService.getProjectTimeLogs(body);
      if (res.done) {
        setProjectTimeLogs(res.body || []);
      }
    } catch (error) {
      logger.error('Error fetching project time logs:', error);
    }
  };

  return (
    <Drawer
      width={736}
      open={isTimeLogDrawerOpen}
      onClose={() => dispatch(toggleTimeLogDrawer())}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Typography.Title level={5}>{selectedLabel?.name}</Typography.Title>
          <TimeWiseFilter />
        </div>
      }
      destroyOnClose
      afterOpenChange={() => {
        handleDrawerOpen();
      }}
    >
      <div style={{ textAlign: 'right', width: '100%', height: '40px' }}>
        <Button size="small" icon={<DownloadOutlined />}>
          {t('exportToExcel')}
        </Button>
      </div>
      {projectTimeLogs.map(logItem => (
        <div key={logItem.log_day}>
          <Card
            className="time-log-card"
            title={
              <Typography.Text
                style={{ fontWeight: 500, fontSize: '16px', overflowWrap: 'break-word' }}
              >
                {formatDate(logItem.log_day)}
              </Typography.Text>
            }
          >
            <Timeline>
              {logItem.logs.map((log, index) => (
                <Timeline.Item key={index}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar
                      style={{
                        backgroundColor: AvatarNamesMap[log.user_name.charAt(0)],
                        width: '26px',
                        height: '26px',
                      }}
                    >
                      {log.user_name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography.Text>
                      <b>{log.user_name}</b> {t('logged')} <b>{log.time_spent_string}</b> {t('for')}{' '}
                      <b>{log.task_name}</b> <Tag>{log.task_key}</Tag>
                    </Typography.Text>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
          <Divider />
        </div>
      ))}
    </Drawer>
  );
};

export default ProjectTimeLogDrawer;
