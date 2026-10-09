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
  startDate: string | Date | null;
  endDate: string | Date | null;
};

const ProjectDatesCell = memo(({ projectId, startDate, endDate }: ProjectDatesCellProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects');
  const { socket, connected } = useSocket();

  // Optimistic local state
  const [localStartDate, setLocalStartDate] = useState<Dayjs | null>(() =>
    startDate ? dayjs(startDate) : null
  );
  const [localEndDate, setLocalEndDate] = useState<Dayjs | null>(() =>
    endDate ? dayjs(endDate) : null
  );

  useEffect(() => {
    setLocalStartDate(startDate ? dayjs(startDate) : null);
  }, [startDate]);

  useEffect(() => {
    setLocalEndDate(endDate ? dayjs(endDate) : null);
  }, [endDate]);

  // Active date picker state
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);

  // Date validation: start date cannot be after end date, and end date cannot be before start date
  const disabledStartDate = useCallback(
    (current: Dayjs) => {
      if (localEndDate && current) {
        return current.startOf('day').isAfter(localEndDate.startOf('day'));
      }
      return false;
    },
    [localEndDate]
  );

  const disabledEndDate = useCallback(
    (current: Dayjs) => {
      if (localStartDate && current) {
        return current.startOf('day').isBefore(localStartDate.startOf('day'));
      }
      return false;
    },
    [localStartDate]
  );

  const handleStartDateChangeResponse = useCallback(
    (data: { project_id: string; start_date: string }) => {
      try {
        if (data.project_id === projectId) {
          setLocalStartDate(data.start_date ? dayjs(data.start_date) : null);
        }
        dispatch(
          setProjectStartDate({
            id: data.project_id,
            start_date: data.start_date,
          })
        );
      } catch (error) {
        logger.error('Error updating start date:', error);
      }
    },
    [dispatch, projectId]
  );

  const handleEndDateChangeResponse = useCallback(
    (data: { project_id: string; end_date: string }) => {
      try {
        if (data.project_id === projectId) {
          setLocalEndDate(data.end_date ? dayjs(data.end_date) : null);
        }
        dispatch(
          setProjectEndDate({
            id: data.project_id,
            end_date: data.end_date,
          })
        );
      } catch (error) {
        logger.error('Error updating end date:', error);
      }
    },
    [dispatch, projectId]
  );

  const handleStartDateChange = useCallback(
    (date: Dayjs | null) => {
      try {
        if (!socket) {
          throw new Error('Socket connection not available');
        }

        const formattedDate = date ? date.format('YYYY-MM-DD') : null;
        setLocalStartDate(date);

        // Optimistically update Redux
        dispatch(
          setProjectStartDate({
            id: projectId,
            start_date: formattedDate,
          })
        );

        socket.emit(
          SocketEvents.PROJECT_START_DATE_CHANGE.toString(),
          JSON.stringify({
            project_id: projectId,
            start_date: formattedDate,
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        );

        setActiveDatePicker(null);
      } catch (error) {
        logger.error('Error sending start date change:', error);
      }
    },
    [socket, projectId, dispatch]
  );

  const handleEndDateChange = useCallback(
    (date: Dayjs | null) => {
      try {
        if (!socket) {
          throw new Error('Socket connection not available');
        }

        const formattedDate = date ? date.format('YYYY-MM-DD') : null;
        setLocalEndDate(date);

        // Optimistically update Redux so Days Left / Overdue column updates in real-time
        dispatch(
          setProjectEndDate({
            id: projectId,
            end_date: formattedDate,
          })
        );

        socket.emit(
          SocketEvents.PROJECT_END_DATE_CHANGE.toString(),
          JSON.stringify({
            project_id: projectId,
            end_date: formattedDate,
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        );

        setActiveDatePicker(null);
      } catch (error) {
        logger.error('Error sending end date change:', error);
      }
    },
    [socket, projectId, dispatch]
  );

  // Handle clear date on mousedown so it fires before blur/unmount
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
        socket.off(
          SocketEvents.PROJECT_START_DATE_CHANGE.toString(),
          handleStartDateChangeResponse
        );
        socket.off(
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
            disabledDate={disabledStartDate}
            placeholder={t('setStartDate')}
            value={localStartDate}
            format={'MMM DD, YYYY'}
            allowClear={false}
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
          {localStartDate && (
            <button
              onMouseDown={handleClearStartDate}
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
          {localStartDate ? (
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {localStartDate.format('MMM DD, YYYY')}
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
            disabledDate={disabledEndDate}
            placeholder={t('setEndDate')}
            value={localEndDate}
            format={'MMM DD, YYYY'}
            allowClear={false}
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
          {localEndDate && (
            <button
              onMouseDown={handleClearEndDate}
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
          {localEndDate ? (
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {localEndDate.format('MMM DD, YYYY')}
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
