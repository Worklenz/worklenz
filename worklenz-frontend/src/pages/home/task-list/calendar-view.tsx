import HomeCalendar from '../../../components/calendars/homeCalendar/HomeCalendar';
import { Tag, Typography } from '@/shared/antd-imports';
import { ClockCircleOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import AddTaskInlineForm from './add-task-inline-form';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import dayjs from 'dayjs';

const CalendarView = () => {
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const { t } = useTranslation('home');

  useEffect(() => {
    if (!homeTasksConfig.selected_date) {
      setHomeTasksConfig({
        ...homeTasksConfig,
        selected_date: dayjs(),
      });
    }
  }, [homeTasksConfig.selected_date]);

  return (
    <div>
      <HomeCalendar />

      <Tag
        icon={<ClockCircleOutlined style={{ fontSize: 16 }} />}
        color="success"
        style={{
          display: 'flex',
          width: '100%',
          padding: '8px 12px',
          marginBlock: 12,
        }}
      >
        <Typography.Text>
          {t('home:tasks.dueOn')} {homeTasksConfig.selected_date?.format('MMM DD, YYYY')}
        </Typography.Text>
      </Tag>

      <AddTaskInlineForm t={t} calendarView={true} />
    </div>
  );
};

export default CalendarView;
