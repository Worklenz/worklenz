import React from 'react';
import 'gantt-task-react/dist/index.css';
import { ViewMode } from 'gantt-task-react';
import { Flex, Select } from '@/shared/antd-imports';
type TimeFilterProps = {
  onViewModeChange: (viewMode: ViewMode) => void;
};
export const TimeFilter = ({ onViewModeChange }: TimeFilterProps) => {
  //   function to handle time change
  const handleChange = (value: string) => {
    switch (value) {
      case 'hour':
        return onViewModeChange(ViewMode.Hour);
      case 'quaterDay':
        return onViewModeChange(ViewMode.QuarterDay);
      case 'halfDay':
        return onViewModeChange(ViewMode.HalfDay);
      case 'day':
        return onViewModeChange(ViewMode.Day);
      case 'week':
        return onViewModeChange(ViewMode.Week);
      case 'month':
        return onViewModeChange(ViewMode.Month);
      case 'year':
        return onViewModeChange(ViewMode.Year);
      default:
        return onViewModeChange(ViewMode.Day);
    }
  };

  const timeFilterItems = [
    {
      value: 'hour',
      label: 'Hour',
    },
    {
      value: 'quaterDay',
      label: 'Quater Day',
    },
    {
      value: 'halfDay',
      label: 'Half Day',
    },
    {
      value: 'day',
      label: 'Day',
    },
    {
      value: 'week',
      label: 'Week',
    },
    {
      value: 'month',
      label: 'Month',
    },
    {
      value: 'year',
      label: 'Year',
    },
  ];

  return (
    <Flex gap={12} align="center" justify="flex-end" style={{ marginBlockEnd: 24 }}>
      <Select
        className="ViewModeSelect"
        style={{ minWidth: 120 }}
        placeholder="Select View Mode"
        onChange={handleChange}
        options={timeFilterItems}
        defaultValue={'day'}
      />
    </Flex>
  );
};
