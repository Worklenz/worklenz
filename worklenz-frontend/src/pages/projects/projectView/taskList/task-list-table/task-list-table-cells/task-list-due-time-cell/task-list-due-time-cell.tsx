import { TimePicker, TimePickerProps } from '@/shared/antd-imports';
import React from 'react';
// import dayjs from 'dayjs';

const TaskListDueTimeCell = () => {
  // function to trigger time change
  const onTimeChange: TimePickerProps['onChange'] = (_time, _timeString) => {
    // TODO: persist due time when backend supports it
  };

  return (
    <TimePicker
      format={'HH:mm'}
      changeOnScroll
      onChange={onTimeChange}
      style={{
        border: 'none',
        background: 'transparent',
      }}
    />
  );
};

export default TaskListDueTimeCell;
