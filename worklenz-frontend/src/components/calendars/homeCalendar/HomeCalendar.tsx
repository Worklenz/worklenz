import { Calendar } from '@/shared/antd-imports';
import React, { useEffect } from 'react';
import type { Dayjs } from 'dayjs';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { selectedDate } from '../../../features/date/dateSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
/* homepage calendar style override  */
import './homeCalendar.css';
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
