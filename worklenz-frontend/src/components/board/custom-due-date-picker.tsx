import React, { useState, useRef } from 'react';
import { DatePicker, Button, Flex } from '@/shared/antd-imports';
import { CalendarOutlined } from '@/shared/antd-imports';
import dayjs, { Dayjs } from 'dayjs';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import logger from '@/utils/errorLogger';
import { useAuthService } from '@/hooks/useAuth';
import { getUserSession } from '@/utils/session-helper';

const CustomDueDatePicker = ({
  task,
  onDateChange,
}: {
  task: IProjectTask;
  onDateChange: (date: Dayjs | null) => void;
}) => {
  const { socket } = useSocket();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null); // Add ref to container

  const dueDayjs = task?.end_date ? dayjs(task.end_date) : null;

  const handleDateChange = (date: Dayjs | null) => {
    onDateChange(date);
    setIsDatePickerOpen(false);
    try {
      socket?.emit(
        SocketEvents.TASK_END_DATE_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          end_date: date?.format(),
          parent_task: task.parent_task_id,
          time_zone: getUserSession()?.timezone_name
            ? getUserSession()?.timezone_name
            : Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      );
    } catch (error) {
      logger.error('Failed to update due date:', error);
    }
  };

  // Stop propagation at the container level
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div ref={containerRef} onClick={handleContainerClick}>
      {task && task.end_date ? (
        <DatePicker
          value={dueDayjs}
          format={'MMM DD, YYYY'}
          onChange={handleDateChange}
          variant="borderless"
          suffixIcon={null}
          style={{ textAlign: 'right', padding: 0, maxWidth: 100 }}
          // Remove individual onClick handler since container handles it
        />
      ) : (
        <Flex gap={4} align="center" style={{ position: 'relative', width: 26, height: 26 }}>
          <DatePicker
            open={isDatePickerOpen}
            value={dueDayjs}
            format={'MMM DD, YYYY'}
            onChange={handleDateChange}
            style={{ opacity: 0, width: 0, height: 0, padding: 0 }}
            popupStyle={{ paddingBlock: 12 }}
            onBlur={() => setIsDatePickerOpen(false)}
            onOpenChange={open => setIsDatePickerOpen(open)}
            variant="borderless"
            // Remove individual onClick handler
          />
          <Button
            shape="circle"
            type="dashed"
            size="small"
            style={{
              background: 'transparent',
              boxShadow: 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              width: 26,
              height: 26,
            }}
            onClick={e => {
              e.stopPropagation(); // Keep this as a backup
              setIsDatePickerOpen(true);
            }}
            icon={<CalendarOutlined />}
          />
        </Flex>
      )}
    </div>
  );
};

export default CustomDueDatePicker;
