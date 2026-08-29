import HomeCalendar from '../../../components/calendars/homeCalendar/HomeCalendar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useEffect } from 'react';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import dayjs from 'dayjs';

const CalendarView = () => {
  const dispatch = useAppDispatch();
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);

  useEffect(() => {
    if (!homeTasksConfig.selected_date) {
      dispatch(setHomeTasksConfig({
        ...homeTasksConfig,
        selected_date: dayjs(),
      }));
    }
  }, [homeTasksConfig.selected_date]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <HomeCalendar />
    </div>
  );
};

export default CalendarView;
