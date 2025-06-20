import { Calendar } from 'antd';
import React, { useEffect } from 'react';
import type { Dayjs } from 'dayjs';
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { useAppSelector } from '@/hooks/use-app-selector';
/* homepage calendar style override  */
import './home-calendar.css';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';

const HomeCalendar = () => {
  const dispatch = useAppDispatch();
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);

  const onSelect = (newValue: Dayjs) => {
    dispatch(setHomeTasksConfig({ ...homeTasksConfig, selected_date: newValue }));
  };

  return (
    <Calendar
      className="home-calendar"
      value={homeTasksConfig.selected_date || undefined}
      onSelect={onSelect}
    />
  );
};

export default HomeCalendar;
