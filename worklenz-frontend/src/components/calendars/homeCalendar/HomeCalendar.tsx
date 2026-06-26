import { Calendar, Badge } from '@/shared/antd-imports';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useState, useMemo } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import './homeCalendar.css';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import { useGetTaskCountsByMonthQuery } from '@/api/home-page/home-page.api.service';
import { getDueDateStatus, getDueDateColor } from '@/utils/dueDateColorHelper';

const HomeCalendar = () => {
  const dispatch = useAppDispatch();
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const [currentMonth, setCurrentMonth] = useState(() =>
    (homeTasksConfig.selected_date || dayjs()).format('YYYY-MM')
  );

  const { data: taskCounts } = useGetTaskCountsByMonthQuery(
    {
      month: currentMonth,
      group_by: homeTasksConfig.tasks_group_by || 0,
      time_zone: homeTasksConfig.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    {
      refetchOnMountOrArgChange: true,
    }
  );

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (taskCounts?.body) {
      taskCounts.body.forEach(item => {
        const dateKey = dayjs(item.date).format('YYYY-MM-DD');
        map.set(dateKey, item.count);
      });
    }
    return map;
  }, [taskCounts]);

  const onSelect = (newValue: Dayjs) => {
    dispatch(setHomeTasksConfig({ ...homeTasksConfig, selected_date: newValue }));
  };

  const onPanelChange = (value: Dayjs) => {
    setCurrentMonth(value.format('YYYY-MM'));
  };

  const fullCellRender = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD');
    const count = countsByDate.get(dateStr);

    const dueDateStatus = getDueDateStatus(value);
    const badgeColor = getDueDateColor(dueDateStatus) || '#1890ff';

    return (
      <div className="ant-picker-cell-inner ant-picker-calendar-date">
        <div className="ant-picker-calendar-date-value">
          {count && count > 0 ? (
            <Badge
              count={count}
              showZero={false}
              style={{
                backgroundColor: badgeColor,
                fontSize: '10px',
                height: '16px',
                minWidth: '16px',
                lineHeight: '16px',
              }}
            />
          ) : (
            <span />
          )}
          <span>{value.date()}</span>
        </div>
        <div className="ant-picker-calendar-date-content" />
      </div>
    );
  };

  return (
    <Calendar
      className="home-calendar"
      value={homeTasksConfig.selected_date || undefined}
      onSelect={onSelect}
      fullCellRender={fullCellRender}
      onPanelChange={onPanelChange}
    />
  );
};

export default HomeCalendar;
