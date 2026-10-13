import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { DatePicker, Form, Input, Modal, Tag, Typography, message, theme } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSprintActions } from '@/hooks/useSprintActions';
import { updateSprintDetails } from '@/features/projects/singleProject/phase/phases.slice';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';

export type SprintFormMode = 'edit' | 'start';

interface SprintFormModalProps {
  open: boolean;
  mode: SprintFormMode;
  sprint: ITaskPhase | null;
  projectId: string;
  issueCount: number;
  unassignedCount: number;
  onClose: () => void;
}

interface SprintFormValues {
  name: string;
  sprint_goal?: string;
  dates?: [Dayjs | null, Dayjs | null] | null;
}

export const SprintFormModal = ({
  open,
  mode,
  sprint,
  projectId,
  issueCount,
  unassignedCount,
  onClose,
}: SprintFormModalProps) => {
  const { t } = useTranslation('phases-drawer');
  const dispatch = useAppDispatch();
  const { startSprint } = useSprintActions(projectId);
  const [form] = Form.useForm<SprintFormValues>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isStartMode = mode === 'start';

  useEffect(() => {
    if (!open || !sprint) return;
    form.setFieldsValue({
      name: sprint.name,
      sprint_goal: sprint.sprint_goal ?? '',
      dates: [
        sprint.start_date ? dayjs(sprint.start_date) : isStartMode ? dayjs() : null,
        sprint.end_date ? dayjs(sprint.end_date) : isStartMode ? dayjs().add(2, 'week') : null,
      ],
    });
  }, [form, isStartMode, open, sprint]);

  const handleSubmit = async () => {
    if (!sprint) return;
    const values = await form.validateFields();
    const [startDate, endDate] = values.dates ?? [null, null];

    setIsSubmitting(true);
    try {
      await dispatch(
        updateSprintDetails({
          phase: sprint,
          projectId,
          details: {
            name: values.name.trim(),
            sprint_goal: values.sprint_goal?.trim() || null,
            start_date: startDate ? startDate.startOf('day').toISOString() : null,
            end_date: endDate ? endDate.endOf('day').toISOString() : null,
          },
        })
      ).unwrap();

      if (isStartMode) {
        const isStarted = await startSprint(sprint.id);
        if (!isStarted) return;
      } else {
        message.success(t('sprintUpdated', { defaultValue: 'Sprint updated' }));
      }
      onClose();
    } catch (error: unknown) {
      message.error(
        (error as { message?: string } | undefined)?.message ||
          t('sprintUpdateError', { defaultValue: 'Could not update sprint' })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateDateRange = (_: unknown, dates: SprintFormValues['dates']) => {
    const [startDate, endDate] = dates ?? [null, null];
    if (isStartMode && (!startDate || !endDate)) {
      return Promise.reject(
        new Error(t('sprintDatesRequired', { defaultValue: 'Set start and end dates to start the sprint' }))
      );
    }
    if (startDate && endDate && endDate.isBefore(startDate, 'day')) {
      return Promise.reject(
        new Error(t('sprintEndBeforeStart', { defaultValue: 'End date must be after start date' }))
      );
    }
    return Promise.resolve();
  };

  const modalTitle = isStartMode ? (
    t('startSprintNamedTitle', { defaultValue: 'Start {{name}}', name: sprint?.name ?? '' })
  ) : (
    <span className="inline-flex items-center gap-2">
      {t('editSprintTitle', { defaultValue: 'Edit sprint' })}
      {sprint?.sprint_status && sprint.sprint_status !== 'completed' && (
        <SprintStatusChip status={sprint.sprint_status} />
      )}
    </span>
  );

  return (
    <Modal
      open={open}
      title={modalTitle}
      okText={
        isStartMode
          ? t('startSprint', { defaultValue: 'Start sprint' })
          : t('saveChanges', { defaultValue: 'Save changes' })
      }
      cancelText={t('cancel', { defaultValue: 'Cancel' })}
      confirmLoading={isSubmitting}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      {isStartMode && (
        <>
          {sprint?.sprint_goal && (
            <Typography.Paragraph className="mb-3">{sprint.sprint_goal}</Typography.Paragraph>
          )}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <SprintStatCard
              label={t('startSprintWorkItems', { defaultValue: 'Work items' })}
              value={issueCount}
            />
            <SprintStatCard
              label={t('startSprintUnassigned', { defaultValue: 'Unassigned' })}
              value={unassignedCount}
            />
          </div>
        </>
      )}
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="name"
          label={t('sprintName', { defaultValue: 'Sprint name' })}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('sprintNameRequired', { defaultValue: 'Sprint name is required' }),
            },
          ]}
        >
          <Input maxLength={SPRINT_NAME_MAX_LENGTH} showCount />
        </Form.Item>
        <Form.Item name="sprint_goal" label={t('sprintGoal', { defaultValue: 'Sprint goal' })}>
          <Input.TextArea
            maxLength={SPRINT_GOAL_MAX_LENGTH}
            showCount
            autoSize={{ minRows: 2, maxRows: 5 }}
            placeholder={t('sprintGoalPlaceholder', {
              defaultValue: 'What should this sprint achieve?',
            })}
          />
        </Form.Item>
        <Form.Item
          name="dates"
          label={t('sprintDates', { defaultValue: 'Sprint dates' })}
          required={isStartMode}
          rules={[{ validator: validateDateRange }]}
        >
          <DatePicker.RangePicker
            className="w-full"
            allowEmpty={[!isStartMode, !isStartMode]}
            placeholder={[
              t('startDate', { defaultValue: 'Start date' }),
              t('endDate', { defaultValue: 'End date' }),
            ]}
          />
        </Form.Item>
      </Form>
      {!isStartMode && (
        <Typography.Text type="secondary" className="text-xs">
          {t('editSprintNote', {
            defaultValue: 'Editing sprint details does not change its status or move its work items.',
          })}
        </Typography.Text>
      )}
    </Modal>
  );
};

export const SprintStatusChip = ({ status }: { status: 'planned' | 'active' }) => {
  const { t } = useTranslation('task-management');
  const isActive = status === 'active';
  return (
    <Tag
      bordered={false}
      color={isActive ? 'processing' : 'purple'}
      className="m-0 rounded-full px-2 text-[10.5px] font-bold leading-[18px]"
    >
      {isActive
        ? t('sprintStatusActive', { defaultValue: 'Active' })
        : t('sprintStatusPlanned', { defaultValue: 'Planned' })}
    </Tag>
  );
};

const SprintStatCard = ({ label, value }: { label: string; value: number }) => {
  const { token } = theme.useToken();
  return (
    <div
      className="rounded-lg p-3"
      style={{ border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
    >
      <div className="text-xs mb-1" style={{ color: token.colorTextSecondary }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: token.colorText }}>
        {value}
      </div>
    </div>
  );
};

const SPRINT_NAME_MAX_LENGTH = 50;
const SPRINT_GOAL_MAX_LENGTH = 500;
