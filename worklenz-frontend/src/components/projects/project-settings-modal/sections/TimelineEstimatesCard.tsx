import dayjs from 'dayjs';
import { Flex, Form, FormInstance, Input } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import logger from '@/utils/errorLogger';
import { ProjectDatePicker } from '../../project-drawer/components/ProjectDatePicker';
import SettingsCard from '../components/settings-card';

interface TimelineEstimatesCardProps {
  form: FormInstance;
  disabled: boolean;
  disabledStartDate: (current: dayjs.Dayjs) => boolean;
  disabledEndDate: (current: dayjs.Dayjs) => boolean;
  onStartDateChange: (date: dayjs.Dayjs | null) => void;
  onEndDateChange: (date: dayjs.Dayjs | null) => void;
}

const TimelineEstimatesCard = ({
  form,
  disabled,
  disabledStartDate,
  disabledEndDate,
  onStartDateChange,
  onEndDateChange,
}: TimelineEstimatesCardProps) => {
  const { t } = useTranslation('project-drawer');

  return (
    <SettingsCard
      title={t('timelineAndEstimatesCardTitle', {
        defaultValue: 'Timeline & Estimates',
      })}
    >
      <Form.Item name="date" layout="horizontal">
        <Flex gap={8}>
          <Form.Item
            name="start_date"
            label={t('startDate')}
            rules={[
              {
                validator: (_, value) => {
                  const endDate = form.getFieldValue('end_date');
                  if (value && endDate && dayjs(value).isAfter(dayjs(endDate), 'day')) {
                    return Promise.reject(
                      new Error(
                        t('startDateAfterEndDate', {
                          defaultValue: 'Start date cannot be later than end date',
                        })
                      )
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <ProjectDatePicker
              field="start_date"
              value={form.getFieldValue('start_date')}
              disabled={disabled}
              disabledDate={disabledStartDate}
              onChange={date => {
                try {
                  onStartDateChange(date);
                  form.validateFields(['start_date', 'end_date']);
                } catch (error) {
                  logger.error('Error calculating working days on start date change', error);
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="end_date"
            label={t('endDate')}
            rules={[
              {
                validator: (_, value) => {
                  const startDate = form.getFieldValue('start_date');
                  if (value && startDate && dayjs(value).isBefore(dayjs(startDate), 'day')) {
                    return Promise.reject(
                      new Error(
                        t('endDateBeforeStartDate', {
                          defaultValue: 'End date cannot be earlier than start date',
                        })
                      )
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <ProjectDatePicker
              field="end_date"
              value={form.getFieldValue('end_date')}
              disabled={disabled}
              disabledDate={disabledEndDate}
              onChange={date => {
                try {
                  onEndDateChange(date);
                  form.validateFields(['start_date', 'end_date']);
                } catch (error) {
                  logger.error('Error calculating working days on end date change', error);
                }
              }}
            />
          </Form.Item>
        </Flex>
      </Form.Item>

      <Form.Item
        name="working_days"
        label={t('estimateWorkingDays')}
        rules={[
          {
            validator: (_, value) => {
              if (value === undefined || value >= 0) return Promise.resolve();
              return Promise.reject(new Error(t('workingDaysValidationMessage', { min: 0 })));
            },
          },
        ]}
      >
        <Input type="number" min={0} disabled={disabled} />
      </Form.Item>

      <Form.Item
        name="man_days"
        label={t('estimateManDays')}
        rules={[
          {
            validator: (_, value) => {
              if (value === undefined || value >= 0) return Promise.resolve();
              return Promise.reject(new Error(t('manDaysValidationMessage', { min: 0 })));
            },
          },
        ]}
      >
        <Input
          type="number"
          min={0}
          disabled={disabled}
          onBlur={e => {
            const value = parseInt(e.target.value, 10);
            if (value < 0) form.setFieldsValue({ man_days: 0 });
          }}
        />
      </Form.Item>

      <Form.Item
        name="hours_per_day"
        label={t('hoursPerDay')}
        rules={[
          {
            validator: (_, value) => {
              if (value === undefined || (value >= 0 && value <= 24)) return Promise.resolve();
              return Promise.reject(
                new Error(t('hoursPerDayValidationMessage', { min: 0, max: 24 }))
              );
            },
          },
        ]}
      >
        <Input
          type="number"
          min={0}
          disabled={disabled}
          onBlur={e => {
            const value = parseInt(e.target.value, 10);
            if (value < 0) form.setFieldsValue({ hours_per_day: 8 });
          }}
        />
      </Form.Item>
    </SettingsCard>
  );
};

export default TimelineEstimatesCard;
