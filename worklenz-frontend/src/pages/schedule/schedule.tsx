import { Button, DatePicker, DatePickerProps, Flex, Select, Space } from '@/shared/antd-imports';
import React, { useRef, useEffect, useState, Suspense, lazy } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_schedule_page_visit } from '@/shared/worklenz-analytics-events';
import { SettingOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  setDate,
  setType,
  toggleSettingsDrawer,
  getWorking,
} from '@/features/schedule/scheduleSlice';
import ScheduleSettingsDrawer from '@/features/schedule/ScheduleSettingsDrawer';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import ScheduleDrawer from '@/features/schedule/ScheduleDrawer';
import GranttChart from '@/components/schedule/grant-chart/GranttChart';
import { TaskTimelineView } from '@/components/schedule/task-timeline';
import { useAppSelector } from '@/hooks/useAppSelector';
import { PickerType } from '@/types/schedule/schedule-v2.types';
import { scheduleApi } from '@/api/schedule/scheduleApi';
import { createPortal } from 'react-dom';
import { useScheduleSocketHandlers } from '@/hooks/useScheduleSocketHandlers';
import { useAppDispatch } from '@/hooks/useAppDispatch';

// Lazy load TaskDrawer
const TaskDrawer = lazy(() => import('@/components/task-drawer/task-drawer'));

const { Option } = Select;

type ScheduleViewMode = 'project' | 'task';

const PickerWithType = ({
  type,
  onChange,
  date,
}: {
  type: PickerType;
  onChange: DatePickerProps['onChange'];
  date?: Date;
}) => {
  return <DatePicker value={dayjs(date)} picker={type} onChange={onChange} />;
};

const Schedule: React.FC = () => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();
  const granttChartRef = useRef<any>(null);
  const { date, type, error } = useAppSelector(state => state.scheduleReducer);
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Initialize schedule socket handlers for real-time updates
  useScheduleSocketHandlers();

  // View mode state: 'project' for existing view, 'task' for new task timeline
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('project');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useDocumentTitle('Schedule');

  useEffect(() => {
    trackMixpanelEvent(evt_schedule_page_visit);
  }, [trackMixpanelEvent]);

  // Listen for settings changes and trigger refresh
  // The error state is cleared when triggerScheduleRefresh is called
  // We use a ref to track previous error state to detect changes
  const prevErrorRef = useRef(error);
  useEffect(() => {
    // If error changed from something to null, it means triggerScheduleRefresh was called
    if (prevErrorRef.current !== null && error === null && !isRefreshing) {
      handleRefresh();
    }
    prevErrorRef.current = error;
  }, [error]);

  const handleDateChange = (value: dayjs.Dayjs | null) => {
    if (!value) return;
    let selectedDate = value.toDate();

    // If 'Month' is selected, default to the first day of the selected month
    if (type === 'month') {
      selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    }

    dispatch(setDate(selectedDate));
  };

  const handleToday = () => {
    const today = new Date();
    dispatch(setDate(today));
    granttChartRef.current?.scrollToToday();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    // Invalidate all schedule-related cache to force refetch
    dispatch(
      scheduleApi.util.invalidateTags([
        'DateList',
        'Members',
        'MemberProjects',
        'Capacity',
        'Workload',
        'CapacityReport',
        'Conflicts',
        'TaskTimeline',
        'TimeOff',
      ])
    );

    // Wait a bit for the refetch to complete
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleOpenSettings = () => {
    // Pre-load settings before opening drawer to avoid loading state in drawer
    dispatch(getWorking());
    dispatch(toggleSettingsDrawer());
  };

  return (
    <div style={{ minHeight: '90vh' }}>
      <Flex align="center" justify="space-between">
        <Flex
          gap={16}
          align="center"
          style={{
            paddingTop: '25px',
            paddingBottom: '20px',
          }}
        >
          <Button onClick={handleToday}>{t('today', { defaultValue: 'Today' })}</Button>
          <Space>
            <Select value={type} onChange={value => dispatch(setType(value))}>
              <Option value="week">{t('week', { defaultValue: 'Week' })}</Option>
              <Option value="month">{t('month', { defaultValue: 'Month' })}</Option>
            </Select>
            <PickerWithType date={date as Date} type={type} onChange={handleDateChange} />
          </Space>

          {/* View Mode Toggle */}
          {/* <Radio.Group 
            value={viewMode} 
            onChange={e => setViewMode(e.target.value)}
            buttonStyle="solid"
            size="middle"
          >
            <Radio.Button value="project">
              {t('projectView', { defaultValue: 'Project View' })}
            </Radio.Button>
            <Radio.Button value="task">
              {t('taskView', { defaultValue: 'Task View' })}
            </Radio.Button>
          </Radio.Group> */}
        </Flex>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isRefreshing}
            shape="circle"
            title={t('refreshSchedule', { defaultValue: 'Refresh Schedule' })}
          />
          <Button
            size="small"
            shape="circle"
            onClick={handleOpenSettings}
            title={t('settings', { defaultValue: 'Settings' })}
          >
            <SettingOutlined />
          </Button>
        </Space>
      </Flex>

      <Flex vertical gap={24}>
        {viewMode === 'project' ? (
          <GranttChart type={type} date={date} ref={granttChartRef} />
        ) : (
          <TaskTimelineView type={type} date={date as Date} />
        )}
      </Flex>

      <ScheduleSettingsDrawer />
      <ScheduleDrawer />

      {/* Task Drawer for opening individual tasks */}
      {createPortal(
        <Suspense fallback={null}>
          <TaskDrawer />
        </Suspense>,
        document.body,
        'schedule-task-drawer'
      )}
    </div>
  );
};

export default Schedule;
