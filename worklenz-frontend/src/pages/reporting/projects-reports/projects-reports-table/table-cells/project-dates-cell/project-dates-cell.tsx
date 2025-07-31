import { DatePicker, Flex, Typography } from 'antd';
import { useEffect } from 'react';
import { colors } from '@/styles/colors';
import dayjs, { Dayjs } from 'dayjs';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setProjectEndDate,
  setProjectStartDate,
} from '@/features/reporting/projectReports/project-reports-slice';
import logger from '@/utils/errorLogger';

type ProjectDatesCellProps = {
  projectId: string;
  startDate: Date | null;
  endDate: Date | null;
};

const ProjectDatesCell = ({ projectId, startDate, endDate }: ProjectDatesCellProps) => {
  const dispatch = useAppDispatch();
  const startDayjs = startDate ? dayjs(startDate) : null;
  const endDayjs = endDate ? dayjs(endDate) : null;
  const { socket, connected } = useSocket();

  const handleStartDateChangeResponse = (data: { project_id: string; start_date: string }) => {
    try {
      dispatch(setProjectStartDate(data));
    } catch (error) {
      logger.error('Error updating start date:', error);
    }
  };

  const handleEndDateChangeResponse = (data: { project_id: string; end_date: string }) => {
    try {
      dispatch(setProjectEndDate(data));
    } catch (error) {
      logger.error('Error updating end date:', error);
    }
  };

  const handleStartDateChange = (date: Dayjs | null) => {
    try {
      if (!socket) {
        throw new Error('Socket connection not available');
      }
      socket.emit(
        SocketEvents.PROJECT_START_DATE_CHANGE.toString(),
        JSON.stringify({
          project_id: projectId,
          start_date: date?.format('YYYY-MM-DD'),
        })
      );
    } catch (error) {
      logger.error('Error sending start date change:', error);
    }
  };

  const handleEndDateChange = (date: Dayjs | null) => {
    try {
      if (!socket) {
        throw new Error('Socket connection not available');
      }
      socket.emit(
        SocketEvents.PROJECT_END_DATE_CHANGE.toString(),
        JSON.stringify({
          project_id: projectId,
          end_date: date?.format('YYYY-MM-DD'),
        })
      );
    } catch (error) {
      logger.error('Error sending end date change:', error);
    }
  };

  useEffect(() => {
    if (connected && socket) {
      socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleStartDateChangeResponse);
      socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleEndDateChangeResponse);

      return () => {
        socket.removeListener(
          SocketEvents.PROJECT_START_DATE_CHANGE.toString(),
          handleStartDateChangeResponse
        );
        socket.removeListener(
          SocketEvents.PROJECT_END_DATE_CHANGE.toString(),
          handleEndDateChangeResponse
        );
      };
    }
  }, [connected, socket]);

  return (
    <Flex gap={4}>
      <DatePicker
        disabledDate={current => current > (endDayjs || dayjs())}
        placeholder="Set Start Date"
        defaultValue={startDayjs}
        format={'MMM DD, YYYY'}
        suffixIcon={null}
        onChange={handleStartDateChange}
        style={{
          backgroundColor: colors.transparent,
          border: 'none',
          boxShadow: 'none',
        }}
      />

      <Typography.Text>-</Typography.Text>

      <DatePicker
        disabledDate={current => current < (startDayjs || dayjs())}
        placeholder="Set End Date"
        defaultValue={endDayjs}
        format={'MMM DD, YYYY'}
        suffixIcon={null}
        style={{
          backgroundColor: colors.transparent,
          border: 'none',
          boxShadow: 'none',
        }}
        onChange={handleEndDateChange}
      />
    </Flex>
  );
};

export default ProjectDatesCell;
