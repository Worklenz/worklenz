import HomeCalendar from '../../../components/calendars/homeCalendar/HomeCalendar';
import { Tag, Typography } from '@/shared/antd-imports';
import { ClockCircleOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import AddTaskInlineForm from './AddTaskInlineForm';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo } from 'react';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import dayjs from 'dayjs';
import { getDueDateStatus, getDueDateColorClass } from '@/utils/dueDateColorHelper';

const CalendarView = () => {
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('home');

  useEffect(() => {
    if (!homeTasksConfig.selected_date) {
      setHomeTasksConfig({
        ...homeTasksConfig,
        selected_date: dayjs(),
      });
    }
  }, [homeTasksConfig.selected_date]);

  // Get due date status and color for the selected date
  const dueDateStatus = useMemo(
    () => getDueDateStatus(homeTasksConfig.selected_date),
    [homeTasksConfig.selected_date]
  );
  const isDarkMode = themeMode === 'dark';

  // Determine tag color based on due date status
  const getTagColor = () => {
    if (!dueDateStatus) return 'default';
    switch (dueDateStatus) {
      case 'overdue':
        return 'error';
      case 'today':
      case 'tomorrow':
        return 'success';
      case 'upcoming':
      default:
        return 'default';
    }
  };

  return (
    <div>
      <HomeCalendar />

      <Tag
        icon={<ClockCircleOutlined style={{ fontSize: 16 }} />}
        color={getTagColor()}
        style={{
          display: 'flex',
          width: '100%',
          padding: '8px 12px',
          marginBlock: 12,
        }}
      >
        <Typography.Text className={getDueDateColorClass(dueDateStatus, isDarkMode)}>
          {t('home:tasks.dueOn')} {homeTasksConfig.selected_date?.format('MMM DD, YYYY')}
        </Typography.Text>
      </Tag>

      <AddTaskInlineForm t={t} calendarView={true} />
    </div>
  );
};

export default CalendarView;
