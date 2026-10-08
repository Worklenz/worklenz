import React, { useMemo } from 'react';
import { Modal, Flex, Badge, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import TimeLogForm from '@/components/task-drawer/shared/time-log/time-log-form';
import { useAuthService } from '@/hooks/useAuth';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';

const { Text } = Typography;

/** The fields of a time entry the edit modal needs; satisfied by both a flat-table row and a grouped-view entry. */
export interface EditableTimeEntry {
  id: string;
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  project_color?: string | null;
  user_id?: string;
  user_name?: string | null;
  /** Seconds. Postgres NUMERIC can arrive as a string at runtime, so it is coerced below. */
  time_spent?: number | string;
  description?: string | null;
  created_at: string;
}

interface EditTimeEntryModalProps {
  /** The entry being edited; `null` closes the modal. */
  entry: EditableTimeEntry | null;
  onClose: () => void;
  /** Called after the entry was saved. The caller closes the modal and refetches. */
  onSaved: () => void;
}

/** Edits one time entry in a dialog, saving through the Time Entries endpoint (owners/admins may edit anyone's). */
export const EditTimeEntryModal: React.FC<EditTimeEntryModalProps> = ({ entry, onClose, onSaved }) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const currentUserId = useAuthService().getCurrentSession()?.id;

  // Keep rendering the last entry while the dialog animates out, so its content doesn't blank mid-fade.
  const [lastEntry, setLastEntry] = React.useState<EditableTimeEntry | null>(entry);
  React.useEffect(() => {
    if (entry) setLastEntry(entry);
  }, [entry]);
  const shown = entry ?? lastEntry;

  const id = shown?.id;
  const timeSpent = shown?.time_spent;
  const description = shown?.description;
  const createdAt = shown?.created_at;
  // Stable across re-renders: TimeLogForm resets its fields whenever `initialValues` changes identity, so a
  // fresh object per render (e.g. after a background refetch) would wipe in-progress edits.
  const initialValues = useMemo<ITaskLogViewModel | undefined>(
    () =>
      id
        ? {
            id,
            time_spent: Number(timeSpent) || 0,
            description: description ?? undefined,
            created_at: createdAt,
          }
        : undefined,
    [id, timeSpent, description, createdAt]
  );

  if (!shown) return null;

  // An admin can edit a member's entry - say whose it is, so the wrong person's time isn't changed by mistake.
  const isSomeoneElses = !!shown.user_name && !!shown.user_id && shown.user_id !== currentUserId;

  return (
    <Modal
      open={!!entry}
      onCancel={onClose}
      title={t('editEntryTitle', { defaultValue: 'Edit time entry' })}
      footer={null}
      width={480}
      // A stray click outside shouldn't throw away typed edits; Esc and the close button still work.
      maskClosable={false}
      destroyOnHidden
    >
      <Flex
        vertical
        gap={2}
        style={{
          padding: '8px 12px',
          marginBottom: 12,
          borderRadius: token.borderRadius,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <Text strong ellipsis={{ tooltip: shown.task_name }}>
          {shown.task_name}
        </Text>
        <Flex align="center" gap={6} style={{ minWidth: 0 }}>
          <Badge color={shown.project_color || token.colorPrimary} />
          <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
            {shown.project_name}
          </Text>
        </Flex>
        {isSomeoneElses && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('editEntryLoggedBy', { name: shown.user_name, defaultValue: 'Logged by {{name}}' })}
          </Text>
        )}
      </Flex>

      <TimeLogForm
        mode="edit"
        asTimeEntry
        inModal
        initialValues={initialValues}
        taskId={shown.task_id}
        projectId={shown.project_id}
        onCancel={onClose}
        onSubmitSuccess={onSaved}
      />
    </Modal>
  );
};
