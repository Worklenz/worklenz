import React, { useMemo, useState } from 'react';
import { Flex, Typography } from '@/shared/antd-imports';
import { Member } from '../../../types/schedule/schedule.types';
import DayAllocationCell from './day-allocation-cell';
import { CELL_WIDTH } from '../../../shared/constants';

type DatesType = {
  date_data: {
    month: string;
    weeks: any[];
    days: {
      day: number;
      name: string;
      isWeekend: boolean;
      isToday: boolean;
    }[];
  }[];
  chart_start: Date | null;
  chart_end: Date | null;
};

const Timeline = () => {
  const [dates, setDates] = useState<DatesType | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useMemo(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/scheduler-data/TeamData.json');
        const data = await response.json();
        setMembers(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  useMemo(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/scheduler-data/scheduler-timeline-dates.json');
        const data = await response.json();
        setDates(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  const getDaysBetween = (start: Date | null, end: Date | null): number => {
    const validStart = start ? new Date(start) : new Date();
    const validEnd = end ? new Date(end) : new Date();

    if (
      validStart instanceof Date &&
      !isNaN(validStart.getTime()) &&
      validEnd instanceof Date &&
      !isNaN(validEnd.getTime())
    ) {
      const oneDay = 24 * 60 * 60 * 1000;
      return Math.round(Math.abs((validStart.getTime() - validEnd.getTime()) / oneDay));
    } else {
      console.error('Invalid date(s)');
      return 0;
    }
  };

  const numberOfDays =
    dates?.chart_start && dates?.chart_end ? getDaysBetween(dates.chart_start, dates.chart_end) : 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${numberOfDays + 1}, ${CELL_WIDTH}px)`,
      }}
    >
      {dates?.date_data?.map((month, monthIndex) =>
        month.days.map((day, dayIndex) => (
          <div
            key={`${monthIndex}-${dayIndex}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 60,
              background: day.isWeekend
                ? 'rgba(217, 217, 217, 0.4)'
                : day.isToday
                  ? 'rgba(24, 144, 255, 1)'
                  : '',
            }}
          >
            <Typography.Text>{day.name},</Typography.Text>
            <Typography.Text>
              {month.month.substring(0, 3)} {day.day}
            </Typography.Text>
          </div>
        ))
      )}
    </div>
  );
};

export default Timeline;
