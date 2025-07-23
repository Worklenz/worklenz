import { TimePicker, TimePickerProps } from '@/shared/antd-imports';
import React from 'react';
// import dayjs from 'dayjs';

const TaskListDueTimeCell = () => {
  // function to trigger time change
  const onTimeChange: TimePickerProps['onChange'] = (time, timeString) => {
    console.log(time, timeString);
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
