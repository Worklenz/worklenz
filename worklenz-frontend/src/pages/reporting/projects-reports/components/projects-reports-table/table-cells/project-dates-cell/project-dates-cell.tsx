import { DatePicker, Flex, Typography } from '@/shared/antd-imports';
import { CloseOutlined } from '@/shared/antd-imports';
import { useEffect, useState, useCallback, memo } from 'react';
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
import { useTranslation } from 'react-i18next';

type ProjectDatesCellProps = {
  projectId: string;
  startDate: Date | null;
  endDate: Date | null;
};

const ProjectDatesCell = memo(({ projectId, startDate, endDate }: ProjectDatesCellProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects');
  const startDayjs = startDate ? dayjs(startDate) : null;
  const endDayjs = endDate ? dayjs(endDate) : null;
  const { socket, connected } = useSocket();

  // Active date picker state - similar to task DatePickerColumn
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);

  const handleStartDateChangeResponse = useCallback(
    (data: { project_id: string; start_date: string }) => {
      try {
        // FIX: Use 'id' instead of 'project_id' to match Redux slice expectations
        dispatch(
          setProjectStartDate({
            id: data.project_id,
            start_date: data.start_date, // Backend now returns YYYY-MM-DD format
          })
        );
      } catch (error) {
        logger.error('Error updating start date:', error);
      }
    },
    [dispatch]
  );

  const handleEndDateChangeResponse = useCallback(
    (data: { project_id: string; end_date: string }) => {
      try {
        // FIX: Use 'id' instead of 'project_id' to match Redux slice expectations
        dispatch(
          setProjectEndDate({
            id: data.project_id,
            end_date: data.end_date, // Backend now returns YYYY-MM-DD format
          })
        );
      } catch (error) {
        logger.error('Error updating end date:', error);
      }
    },
    [dispatch]
  );

  const handleStartDateChange = useCallback(
    (date: Dayjs | null) => {
      try {
        if (!socket) {
          throw new Error('Socket connection not available');
        }
        // FIX: Send date in YYYY-MM-DD format consistently like tasks, including timezone info
        socket.emit(
          SocketEvents.PROJECT_START_DATE_CHANGE.toString(),
          JSON.stringify({
            project_id: projectId,
            start_date: date?.format('YYYY-MM-DD'),
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        );

        // Close the date picker after selection - like tasks
        setActiveDatePicker(null);
      } catch (error) {
        logger.error('Error sending start date change:', error);
      }
    },
    [socket, projectId]
  );

  const handleEndDateChange = useCallback(
    (date: Dayjs | null) => {
      try {
        if (!socket) {
          throw new Error('Socket connection not available');
        }
        // FIX: Send date in YYYY-MM-DD format consistently like tasks, including timezone info
        socket.emit(
          SocketEvents.PROJECT_END_DATE_CHANGE.toString(),
          JSON.stringify({
            project_id: projectId,
            end_date: date?.format('YYYY-MM-DD'),
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        );

        // Close the date picker after selection - like tasks
        setActiveDatePicker(null);
      } catch (error) {
        logger.error('Error sending end date change:', error);
      }
    },
    [socket, projectId]
  );

  // Handle clear date - similar to task DatePickerColumn
  const handleClearStartDate = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleStartDateChange(null);
    },
    [handleStartDateChange]
  );

  const handleClearEndDate = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleEndDateChange(null);
    },
    [handleEndDateChange]
  );

  // Handle open date picker - similar to task DatePickerColumn
  const handleOpenStartDatePicker = useCallback(() => {
    setActiveDatePicker('start');
  }, []);

  const handleOpenEndDatePicker = useCallback(() => {
    setActiveDatePicker('end');
  }, []);

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
  }, [connected, socket, handleStartDateChangeResponse, handleEndDateChangeResponse]);

  return (
    <Flex gap={4} align="center">
      {/* Start Date Picker */}
      {activeDatePicker === 'start' ? (
        <div className="relative">
          <DatePicker
            disabledDate={current => current > (endDayjs || dayjs())}
            placeholder={t('setStartDate')}
            value={startDayjs}
            format={'MMM DD, YYYY'}
            suffixIcon={null}
            onChange={handleStartDateChange}
            open={true}
            onOpenChange={open => {
              if (!open) {
                setActiveDatePicker(null);
              }
            }}
            style={{
              backgroundColor: colors.transparent,
              border: 'none',
              boxShadow: 'none',
            }}
            autoFocus
          />
          {/* Custom clear button */}
          {startDayjs && (
            <button
              onClick={handleClearStartDate}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              title={t('clearStartDate')}
            >
              <CloseOutlined style={{ fontSize: '10px' }} />
            </button>
          )}
        </div>
      ) : (
        <div
          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors"
          onClick={e => {
            e.stopPropagation();
            handleOpenStartDatePicker();
          }}
        >
          {startDayjs ? (
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {startDayjs.format('MMM DD, YYYY')}
            </span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {t('setStartDate')}
            </span>
          )}
        </div>
      )}

      <Typography.Text>-</Typography.Text>

      {/* End Date Picker */}
      {activeDatePicker === 'end' ? (
        <div className="relative">
          <DatePicker
            disabledDate={current => current < (startDayjs || dayjs())}
            placeholder={t('setEndDate')}
            value={endDayjs}
            format={'MMM DD, YYYY'}
            suffixIcon={null}
            onChange={handleEndDateChange}
            open={true}
            onOpenChange={open => {
              if (!open) {
                setActiveDatePicker(null);
              }
            }}
            style={{
              backgroundColor: colors.transparent,
              border: 'none',
              boxShadow: 'none',
            }}
            autoFocus
          />
          {/* Custom clear button */}
          {endDayjs && (
            <button
              onClick={handleClearEndDate}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              title={t('clearEndDate')}
            >
              <CloseOutlined style={{ fontSize: '10px' }} />
            </button>
          )}
        </div>
      ) : (
        <div
          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors"
          onClick={e => {
            e.stopPropagation();
            handleOpenEndDatePicker();
          }}
        >
          {endDayjs ? (
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {endDayjs.format('MMM DD, YYYY')}
            </span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {t('setEndDate')}
            </span>
          )}
        </div>
      )}
    </Flex>
  );
});

ProjectDatesCell.displayName = 'ProjectDatesCell';

export default ProjectDatesCell;
