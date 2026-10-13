import { DatePicker, Flex, Typography, message } from '@/shared/antd-imports';
import { CloseOutlined } from '@/shared/antd-imports';
import { useEffect, useState, useCallback, useRef, memo } from 'react';
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

type DateChangeAck = { success: boolean; error?: string };
const ACK_TIMEOUT_MS = 8000;

// Per-date save tracking so a late failure of an older edit can never overwrite a newer one.
type SaveState = {
  pending: number; // requests awaiting an ack
  confirmed: string | null; // last value the server acknowledged (or the loaded value)
  optimistic: string | null; // latest value the user chose
};

const toDateString = (value: string | Date | null): string | null =>
  value ? dayjs(value).format('YYYY-MM-DD') : null;

type ProjectDatesCellProps = {
  projectId: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
};

const ProjectDatesCell = memo(({ projectId, startDate, endDate }: ProjectDatesCellProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects');
  const { socket } = useSocket();

  // Optimistic local state
  const [localStartDate, setLocalStartDate] = useState<Dayjs | null>(() =>
    startDate ? dayjs(startDate) : null
  );
  const [localEndDate, setLocalEndDate] = useState<Dayjs | null>(() =>
    endDate ? dayjs(endDate) : null
  );

  const saveStateRef = useRef<Record<'start' | 'end', SaveState>>({
    start: { pending: 0, confirmed: toDateString(startDate), optimistic: toDateString(startDate) },
    end: { pending: 0, confirmed: toDateString(endDate), optimistic: toDateString(endDate) },
  });

  useEffect(() => {
    setLocalStartDate(startDate ? dayjs(startDate) : null);
    // Props echo our own optimistic dispatches, so only treat them as server truth when idle.
    const state = saveStateRef.current.start;
    if (state.pending === 0) {
      state.confirmed = state.optimistic = toDateString(startDate);
    }
  }, [startDate]);

  useEffect(() => {
    setLocalEndDate(endDate ? dayjs(endDate) : null);
    const state = saveStateRef.current.end;
    if (state.pending === 0) {
      state.confirmed = state.optimistic = toDateString(endDate);
    }
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



  const saveDate = useCallback(
    (kind: 'start' | 'end', date: Dayjs | null) => {
      try {
        if (!socket) {
          throw new Error('Socket connection not available');
        }

        const isStart = kind === 'start';
        const state = saveStateRef.current[kind];
        const formattedDate = date ? date.format('YYYY-MM-DD') : null;
        const setLocal = isStart ? setLocalStartDate : setLocalEndDate;
        const setRedux = (value: string | null) =>
          dispatch(
            isStart
              ? setProjectStartDate({ id: projectId, start_date: value })
              : setProjectEndDate({ id: projectId, end_date: value })
          );

        state.pending += 1;
        state.optimistic = formattedDate;
        setLocal(date);
        // Optimistically update Redux so dependent columns (e.g. Days Left) update in real-time
        setRedux(formattedDate);

        socket.timeout(ACK_TIMEOUT_MS).emit(
          (isStart
            ? SocketEvents.PROJECT_START_DATE_CHANGE
            : SocketEvents.PROJECT_END_DATE_CHANGE
          ).toString(),
          JSON.stringify({
            project_id: projectId,
            [isStart ? 'start_date' : 'end_date']: formattedDate,
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
          (err: Error | null, response?: DateChangeAck) => {
            state.pending -= 1;
            const saved = !err && !!response?.success;
            if (saved) {
              state.confirmed = formattedDate;
            }
            // Only settle once every in-flight edit has answered, and only roll back when the
            // latest chosen value was never confirmed. An older edit failing after a newer one
            // succeeded therefore leaves the newer value untouched.
            if (state.pending === 0 && state.optimistic !== state.confirmed) {
              state.optimistic = state.confirmed;
              setLocal(state.confirmed ? dayjs(state.confirmed) : null);
              setRedux(state.confirmed);
              message.error(
                response?.error ||
                  t(isStart ? 'startDateSaveFailed' : 'endDateSaveFailed', {
                    defaultValue: `Failed to save the ${kind} date. Please try again.`,
                  })
              );
            }
          }
        );

        setActiveDatePicker(null);
      } catch (error) {
        logger.error(`Error sending ${kind} date change:`, error);
      }
    },
    [socket, projectId, dispatch, t]
  );

  const handleStartDateChange = useCallback(
    (date: Dayjs | null) => saveDate('start', date),
    [saveDate]
  );

  const handleEndDateChange = useCallback(
    (date: Dayjs | null) => saveDate('end', date),
    [saveDate]
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
