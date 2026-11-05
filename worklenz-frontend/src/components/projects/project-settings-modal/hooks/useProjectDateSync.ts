import { useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import { FormInstance } from '@/shared/antd-imports';

import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { calculateWorkingDays } from '../utils/calculate-working-days';

/**
 * Keeps start/end date fields and derived working days in sync for the settings form.
 *
 * Local picks only update the form — persistence happens when the user clicks Update
 * (see useProjectSettingsSubmit). Socket listeners still apply remote date changes
 * (e.g. from reporting) so an open settings form stays current.
 */
export const useProjectDateSync = (form: FormInstance, projectId: string | null) => {
  const { socket, connected } = useSocket();

  const handleStartDateChangeResponse = useCallback(
    (data: { project_id: string; start_date: string }) => {
      try {
        if (data.project_id === projectId) {
          const newStartDate = data.start_date ? dayjs(data.start_date) : null;
          form.setFieldsValue({ start_date: newStartDate });

          const endDate = form.getFieldValue('end_date');
          if (newStartDate && endDate) {
            const days = calculateWorkingDays(newStartDate, endDate);
            form.setFieldsValue({ working_days: days });
          } else if (!newStartDate) {
            form.setFieldsValue({ working_days: 0 });
          }
        }
      } catch (error) {
        logger.error('Error handling start date change response:', error);
      }
    },
    [projectId, form]
  );

  const handleEndDateChangeResponse = useCallback(
    (data: { project_id: string; end_date: string }) => {
      try {
        if (data.project_id === projectId) {
          const newEndDate = data.end_date ? dayjs(data.end_date) : null;
          form.setFieldsValue({ end_date: newEndDate });

          const startDate = form.getFieldValue('start_date');
          if (startDate && newEndDate) {
            const days = calculateWorkingDays(startDate, newEndDate);
            form.setFieldsValue({ working_days: days });
          } else if (!newEndDate) {
            form.setFieldsValue({ working_days: 0 });
          }
        }
      } catch (error) {
        logger.error('Error handling end date change response:', error);
      }
    },
    [projectId, form]
  );

  useEffect(() => {
    if (connected && socket && projectId) {
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
  }, [connected, socket, projectId, handleStartDateChangeResponse, handleEndDateChangeResponse]);

  const handleStartDateChange = useCallback(
    (date: dayjs.Dayjs | null) => {
      try {
        form.setFieldsValue({ start_date: date });

        const endDate = form.getFieldValue('end_date');
        if (date && endDate) {
          const days = calculateWorkingDays(date, endDate);
          form.setFieldsValue({ working_days: days });
        } else if (!date) {
          form.setFieldsValue({ working_days: 0 });
        }
      } catch (error) {
        logger.error('Error handling start date change', error);
      }
    },
    [form]
  );

  const handleEndDateChange = useCallback(
    (date: dayjs.Dayjs | null) => {
      try {
        form.setFieldsValue({ end_date: date });

        const startDate = form.getFieldValue('start_date');
        if (startDate && date) {
          const days = calculateWorkingDays(startDate, date);
          form.setFieldsValue({ working_days: days });
        } else if (!date) {
          form.setFieldsValue({ working_days: 0 });
        }
      } catch (error) {
        logger.error('Error handling end date change', error);
      }
    },
    [form]
  );

  const disabledStartDate = useCallback(
    (current: dayjs.Dayjs) => {
      const endDate = form.getFieldValue('end_date');
      return current && endDate ? current.isAfter(dayjs(endDate), 'day') : false;
    },
    [form]
  );

  const disabledEndDate = useCallback(
    (current: dayjs.Dayjs) => {
      const startDate = form.getFieldValue('start_date');
      return current && startDate ? current.isBefore(dayjs(startDate), 'day') : false;
    },
    [form]
  );

  return {
    handleStartDateChange,
    handleEndDateChange,
    disabledStartDate,
    disabledEndDate,
  };
};
