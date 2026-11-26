import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  TimePicker,
  Typography,
  dayjs,
} from '@/shared/antd-imports';
import type { Dayjs } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { ITaskRecurring } from '@/types/tasks/task-recurring-schedule';
import type {
  AnalyticsReportSchedule,
  AnalyticsScheduleFormat,
  AnalyticsScheduleUpsertPayload,
} from '@/types/reporting/analytics-schedules.types';

const { Text, Paragraph } = Typography;

const EMAIL_RE =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i;

const monthlyDateOptions = Array.from({ length: 28 }, (_, i) => i + 1);

const REPORT_NAME_MAX = 120;

interface ScheduleFormValues {
  report_name: string;
  schedule_type: ITaskRecurring;
  days_of_week?: number[];
  monthly_mode?: 'date' | 'day';
  date_of_month?: number;
  week_of_month?: number;
  day_of_month?: number;
  interval_days?: number;
  interval_weeks?: number;
  interval_months?: number;
  send_time: Dayjs;
  recipients: string[];
  formats: AnalyticsScheduleFormat[];
  message?: string;
}

export interface ScheduleReportModalProps {
  open: boolean;
  reportKind: string;
  reportName: string;
  templateId?: string | null;
  timezone?: string;
  existing?: AnalyticsReportSchedule | null;
  confirmLoading?: boolean;
  defaultRecipient?: string | null;
  getFilters: () => Record<string, unknown>;
  onCancel: () => void;
  onSave: (payload: AnalyticsScheduleUpsertPayload) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}

function toDayjsTime(value: string | undefined, fallback = '08:00'): Dayjs {
  return dayjs(value || fallback, 'HH:mm');
}

export const ScheduleReportModal: React.FC<ScheduleReportModalProps> = ({
  open,
  reportKind,
  reportName,
  templateId,
  timezone = 'UTC',
  existing,
  confirmLoading,
  defaultRecipient,
  getFilters,
  onCancel,
  onSave,
  onRemove,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { t: tRecurring } = useTranslation('task-drawer/task-drawer-recurring-config');
  const [form] = Form.useForm<ScheduleFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const scheduleType = Form.useWatch('schedule_type', form) ?? ITaskRecurring.Weekly;
  const monthlyMode = Form.useWatch('monthly_mode', form) ?? 'date';

  const frequencyOptions = useMemo(
    () => [
      { label: tRecurring('daily', { defaultValue: 'Daily' }), value: ITaskRecurring.Daily },
      { label: tRecurring('weekly', { defaultValue: 'Weekly' }), value: ITaskRecurring.Weekly },
      { label: tRecurring('monthly', { defaultValue: 'Monthly' }), value: ITaskRecurring.Monthly },
      { label: tRecurring('yearly', { defaultValue: 'Yearly' }), value: ITaskRecurring.Yearly },
      {
        label: tRecurring('everyXDays', { defaultValue: 'Every X Days' }),
        value: ITaskRecurring.EveryXDays,
      },
      {
        label: tRecurring('everyXWeeks', { defaultValue: 'Every X Weeks' }),
        value: ITaskRecurring.EveryXWeeks,
      },
      {
        label: tRecurring('everyXMonths', { defaultValue: 'Every X Months' }),
        value: ITaskRecurring.EveryXMonths,
      },
    ],
    [tRecurring]
  );

  const daysOfWeekOptions = useMemo(
    () => [
      { label: tRecurring('sun', { defaultValue: 'Sun' }), value: 0 },
      { label: tRecurring('mon', { defaultValue: 'Mon' }), value: 1 },
      { label: tRecurring('tue', { defaultValue: 'Tue' }), value: 2 },
      { label: tRecurring('wed', { defaultValue: 'Wed' }), value: 3 },
      { label: tRecurring('thu', { defaultValue: 'Thu' }), value: 4 },
      { label: tRecurring('fri', { defaultValue: 'Fri' }), value: 5 },
      { label: tRecurring('sat', { defaultValue: 'Sat' }), value: 6 },
    ],
    [tRecurring]
  );

  const weekOptions = useMemo(
    () => [
      { label: tRecurring('first', { defaultValue: 'First' }), value: 1 },
      { label: tRecurring('second', { defaultValue: 'Second' }), value: 2 },
      { label: tRecurring('third', { defaultValue: 'Third' }), value: 3 },
      { label: tRecurring('fourth', { defaultValue: 'Fourth' }), value: 4 },
      { label: tRecurring('last', { defaultValue: 'Last' }), value: 5 },
    ],
    [tRecurring]
  );

  const formatOptions = useMemo(
    () => [
      { label: t('scheduleFormatPdf', { defaultValue: 'PDF' }), value: 'PDF' },
      { label: t('scheduleFormatCsv', { defaultValue: 'CSV' }), value: 'CSV' },
      { label: t('scheduleFormatExcel', { defaultValue: 'Excel' }), value: 'Excel' },
    ],
    [t]
  );

  useEffect(() => {
    if (!open) return;

    const recipients =
      existing?.recipients?.length
        ? existing.recipients
        : defaultRecipient
          ? [defaultRecipient]
          : [];

    const monthlyModeValue =
      existing?.date_of_month != null
        ? 'date'
        : existing?.week_of_month != null
          ? 'day'
          : 'date';

    form.setFieldsValue({
      report_name: existing?.report_name?.trim() || reportName,
      schedule_type: (existing?.schedule_type as ITaskRecurring) || ITaskRecurring.Weekly,
      days_of_week: existing?.days_of_week?.length ? existing.days_of_week : [1],
      monthly_mode: monthlyModeValue,
      date_of_month: existing?.date_of_month ?? 1,
      week_of_month: existing?.week_of_month ?? 1,
      day_of_month: existing?.day_of_month ?? 1,
      interval_days: existing?.interval_days ?? 1,
      interval_weeks: existing?.interval_weeks ?? 1,
      interval_months: existing?.interval_months ?? 1,
      send_time: toDayjsTime(existing?.send_time, '08:00'),
      recipients,
      formats:
        existing?.formats?.length
          ? existing.formats
          : (['PDF'] as AnalyticsScheduleFormat[]),
      message: existing?.message || undefined,
    });
  }, [open, existing, defaultRecipient, reportName, form]);

  const buildPayload = (values: ScheduleFormValues): AnalyticsScheduleUpsertPayload => {
    const payload: AnalyticsScheduleUpsertPayload = {
      report_kind: reportKind,
      report_name: values.report_name.trim(),
      template_id: templateId ?? null,
      schedule_type: values.schedule_type,
      send_time: values.send_time.format('HH:mm'),
      timezone,
      recipients: values.recipients,
      formats: values.formats,
      message: values.message?.trim() || null,
      filters: getFilters(),
      paused: false,
      days_of_week: null,
      day_of_month: null,
      date_of_month: null,
      week_of_month: null,
      interval_days: null,
      interval_weeks: null,
      interval_months: null,
    };

    switch (values.schedule_type) {
      case ITaskRecurring.Weekly:
        payload.days_of_week = values.days_of_week || [];
        break;
      case ITaskRecurring.Monthly:
        if (values.monthly_mode === 'day') {
          payload.week_of_month = values.week_of_month ?? 1;
          payload.day_of_month = values.day_of_month ?? 1;
        } else {
          payload.date_of_month = values.date_of_month ?? 1;
        }
        break;
      case ITaskRecurring.EveryXDays:
        payload.interval_days = values.interval_days ?? 1;
        break;
      case ITaskRecurring.EveryXWeeks:
        payload.interval_weeks = values.interval_weeks ?? 1;
        break;
      case ITaskRecurring.EveryXMonths:
        payload.interval_months = values.interval_months ?? 1;
        break;
      default:
        break;
    }

    return payload;
  };

  const handleOk = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      await onSave(buildPayload(values));
    } catch {
      // validation errors stay on the form
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    try {
      setRemoving(true);
      await onRemove();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('scheduleReportTitle', { defaultValue: 'Schedule report' })}
      onCancel={onCancel}
      onOk={() => void handleOk()}
      confirmLoading={confirmLoading || submitting}
      destroyOnClose
      width={560}
      footer={[
        existing && onRemove ? (
          <Button
            key="remove"
            danger
            type="link"
            disabled={removing || confirmLoading || submitting}
            loading={removing}
            onClick={() => void handleRemove()}
            style={{ float: 'left', paddingInline: 0 }}
          >
            {t('scheduleRemove', { defaultValue: 'Remove schedule' })}
          </Button>
        ) : (
          <span key="spacer" />
        ),
        <Button key="cancel" onClick={onCancel}>
          {t('cancel', { defaultValue: 'Cancel' })}
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={confirmLoading || submitting}
          onClick={() => void handleOk()}
        >
          {t('scheduleSave', { defaultValue: 'Save schedule' })}
        </Button>,
      ]}
    >
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        {t('scheduleReportDescription', {
          defaultValue: 'Email a snapshot of this report with the current filters.',
        })}
      </Paragraph>

      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="report_name"
          label={t('scheduleName', { defaultValue: 'Name' })}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('scheduleNameRequired', {
                defaultValue: 'Enter a schedule name',
              }),
            },
            {
              max: REPORT_NAME_MAX,
              message: t('scheduleNameTooLong', {
                defaultValue: 'Name must be at most {{max}} characters',
                max: REPORT_NAME_MAX,
              }),
            },
          ]}
        >
          <Input
            maxLength={REPORT_NAME_MAX}
            placeholder={t('scheduleNamePlaceholder', {
              defaultValue: 'e.g. Weekly time report',
            })}
            aria-label={t('scheduleName', { defaultValue: 'Name' })}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="schedule_type"
              label={t('scheduleFrequency', { defaultValue: 'Frequency' })}
              rules={[
                {
                  required: true,
                  message: t('scheduleFrequencyRequired', {
                    defaultValue: 'Select a frequency',
                  }),
                },
              ]}
            >
              <Select options={frequencyOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="send_time"
              label={t('scheduleTime', { defaultValue: 'Time' })}
              rules={[
                {
                  required: true,
                  message: t('scheduleTimeRequired', { defaultValue: 'Select a send time' }),
                },
              ]}
            >
              <TimePicker format="HH:mm" allowClear={false} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {scheduleType === ITaskRecurring.Weekly && (
          <Form.Item
            name="days_of_week"
            label={tRecurring('selectDaysOfWeek', { defaultValue: 'Select Days of the Week' })}
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: t('scheduleDaysRequired', {
                  defaultValue: 'Select at least one day',
                }),
              },
            ]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row>
                {daysOfWeekOptions.map(day => (
                  <Col span={8} key={day.value}>
                    <Checkbox value={day.value}>{day.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        )}

        {scheduleType === ITaskRecurring.Monthly && (
          <>
            <Form.Item
              name="monthly_mode"
              label={tRecurring('monthlyRepeatType', { defaultValue: 'Monthly repeat type' })}
            >
              <Radio.Group>
                <Radio.Button value="date">
                  {tRecurring('onSpecificDate', { defaultValue: 'On a specific date' })}
                </Radio.Button>
                <Radio.Button value="day">
                  {tRecurring('onSpecificDay', { defaultValue: 'On a specific day' })}
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
            {monthlyMode === 'date' ? (
              <Form.Item
                name="date_of_month"
                label={tRecurring('dateOfMonth', { defaultValue: 'Date of the month' })}
                rules={[{ required: true }]}
              >
                <Select
                  style={{ width: '100%' }}
                  options={monthlyDateOptions.map(date => ({
                    label: String(date),
                    value: date,
                  }))}
                />
              </Form.Item>
            ) : (
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="week_of_month"
                    label={tRecurring('weekOfMonth', { defaultValue: 'Week of the month' })}
                    rules={[{ required: true }]}
                  >
                    <Select style={{ width: '100%' }} options={weekOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="day_of_month"
                    label={tRecurring('dayOfWeek', { defaultValue: 'Day of the week' })}
                    rules={[{ required: true }]}
                  >
                    <Select style={{ width: '100%' }} options={daysOfWeekOptions} />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </>
        )}

        {scheduleType === ITaskRecurring.EveryXDays && (
          <Form.Item
            name="interval_days"
            label={tRecurring('intervalDays', { defaultValue: 'Interval (days)' })}
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        )}
        {scheduleType === ITaskRecurring.EveryXWeeks && (
          <Form.Item
            name="interval_weeks"
            label={tRecurring('intervalWeeks', { defaultValue: 'Interval (weeks)' })}
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        )}
        {scheduleType === ITaskRecurring.EveryXMonths && (
          <Form.Item
            name="interval_months"
            label={tRecurring('intervalMonths', { defaultValue: 'Interval (months)' })}
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        )}

        <Form.Item
          name="recipients"
          label={t('scheduleRecipients', { defaultValue: 'Recipients' })}
          rules={[
            {
              required: true,
              type: 'array',
              min: 1,
              message: t('scheduleRecipientsRequired', {
                defaultValue: 'Add at least one recipient',
              }),
            },
            {
              validator: async (_, value: string[]) => {
                if (!Array.isArray(value)) return;
                for (const email of value) {
                  if (!EMAIL_RE.test(String(email).trim())) {
                    throw new Error(
                      t('scheduleInvalidEmail', {
                        defaultValue: 'Invalid email: {{email}}',
                        email,
                      })
                    );
                  }
                }
              },
            },
          ]}
        >
          <Select
            mode="tags"
            tokenSeparators={[',', ' ']}
            placeholder={t('scheduleRecipientsPlaceholder', {
              defaultValue: 'Add recipient email, press Enter',
            })}
            open={false}
          />
        </Form.Item>

        <Form.Item
          name="formats"
          label={t('scheduleFormat', { defaultValue: 'Format' })}
          rules={[
            {
              required: true,
              type: 'array',
              min: 1,
              message: t('scheduleFormatsRequired', {
                defaultValue: 'Select at least one format',
              }),
            },
          ]}
        >
          <Select
            mode="multiple"
            options={formatOptions}
            placeholder={t('scheduleFormatsPlaceholder', {
              defaultValue: 'Select one or more formats',
            })}
          />
        </Form.Item>

        <Form.Item
          name="message"
          label={t('scheduleMessage', { defaultValue: 'Message (optional)' })}
        >
          <Input.TextArea rows={2} />
        </Form.Item>

        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('scheduleTimezoneHint', {
            defaultValue: 'Sends in timezone: {{timezone}}',
            timezone,
          })}
        </Text>
      </Form>
    </Modal>
  );
};
