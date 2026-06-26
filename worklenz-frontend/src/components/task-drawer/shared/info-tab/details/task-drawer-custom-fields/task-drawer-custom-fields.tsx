import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Badge, DatePicker, Flex, Input, InputNumber, Select, Typography, message } from '@/shared/antd-imports';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import { store } from '@/app/store';
import AvatarGroup from '@/components/AvatarGroup';
import PeopleDropdown from '@/components/common/people-dropdown/PeopleDropdown';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setTaskCustomColumnValue } from '@/features/task-drawer/task-drawer.slice';
import { updateTask } from '@/features/task-management/task-management.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import {
  ITaskCustomColumn,
  ITaskCustomColumnSelectionOption,
  ITaskCustomColumnValue,
  ITaskTeamMember,
  ITaskViewModel,
} from '@/types/tasks/task.types';
import { useTranslation } from 'react-i18next';
import {
  getDrawerSupportedCustomFields,
  getTaskCustomNumberAffixes,
  getTaskCustomFieldDisplayName,
  parsePeopleCustomFieldValue,
} from '@/utils/task-custom-columns';

interface TaskDrawerCustomFieldsProps {
  customColumns: ITaskCustomColumn[];
  projectId: string | null;
  task: ITaskViewModel | null;
  teamMembers: ITaskTeamMember[];
}

const getSelectionOptions = (column: ITaskCustomColumn): ITaskCustomColumnSelectionOption[] =>
  column.custom_column_obj?.selectionsList || [];

const formatNumberValue = (
  value: ITaskCustomColumnValue,
  column: ITaskCustomColumn
): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? null : numericValue;
  }

  return null;
};

interface DrawerPeopleCustomFieldProps {
  column: ITaskCustomColumn;
  rawValue: ITaskCustomColumnValue;
  teamMembers: ITaskTeamMember[];
  onValueChange: (column: ITaskCustomColumn, value: string[]) => Promise<void>;
}

const DrawerPeopleCustomField = ({
  column,
  rawValue,
  teamMembers,
  onValueChange,
}: DrawerPeopleCustomFieldProps) => {
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [optimisticSelectedIds, setOptimisticSelectedIds] = useState<string[]>([]);

  const selectedMemberIds = useMemo(() => parsePeopleCustomFieldValue(rawValue), [rawValue]);

  const displayedMemberIds = useMemo(() => {
    if (pendingChanges.size > 0) return optimisticSelectedIds;
    return selectedMemberIds;
  }, [optimisticSelectedIds, pendingChanges.size, selectedMemberIds]);

  useEffect(() => {
    if (pendingChanges.size === 0) {
      setOptimisticSelectedIds(selectedMemberIds);
    }
  }, [pendingChanges.size, selectedMemberIds]);

  const selectedMembers = useMemo(() => {
    const availableMembers = members?.data?.length ? members.data : teamMembers;
    if (!availableMembers.length || !displayedMemberIds.length) return [];
    return availableMembers.filter(member => displayedMemberIds.includes(member.id));
  }, [displayedMemberIds, members?.data, teamMembers]);

  const handleMemberToggle = async (memberId: string, checked: boolean) => {
    setPendingChanges(prev => new Set(prev).add(memberId));

    const nextSelectedIds = checked
      ? [...displayedMemberIds, memberId]
      : displayedMemberIds.filter(id => id !== memberId);

    setOptimisticSelectedIds(nextSelectedIds);

    try {
      await onValueChange(column, nextSelectedIds);
    } finally {
      setTimeout(() => {
        setPendingChanges(prev => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
      }, 300);
    }
  };

  return (
    <div className="flex items-center gap-1 relative">
      {selectedMembers.length > 0 && (
        <AvatarGroup
          members={selectedMembers.map(member => ({
            id: member.id,
            team_member_id: member.id,
            name: member.name,
            avatar_url: member.avatar_url,
            color_code: member.color_code,
          }))}
          maxCount={3}
          size={24}
          isDarkMode={isDarkMode}
        />
      )}

      <PeopleDropdown
        selectedMemberIds={displayedMemberIds}
        onMemberToggle={(memberId, checked) => void handleMemberToggle(memberId, checked)}
        isDarkMode={isDarkMode}
        pendingChanges={pendingChanges}
        buttonClassName="w-6 h-6"
      />
    </div>
  );
};

const TaskDrawerCustomFields = ({
  customColumns,
  projectId,
  task,
  teamMembers,
}: TaskDrawerCustomFieldsProps) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-drawer/task-drawer');
  const [numberDraftValues, setNumberDraftValues] = useState<Record<string, number | null>>({});
  const [textDraftValues, setTextDraftValues] = useState<Record<string, string>>({});

  const visibleSupportedColumns = getDrawerSupportedCustomFields(customColumns);

  const handleValueChange = async (
    column: ITaskCustomColumn,
    value: string | number | boolean | string[] | null
  ) => {
    if (!task?.id || !projectId) return;

    const previousValue = task.custom_column_values?.[column.key] ?? null;

    try {
      dispatch(
        setTaskCustomColumnValue({
          taskId: task.id,
          columnKey: column.key,
          value,
        })
      );

      const currentListTask = store.getState().taskManagement.entities[task.id];
      if (currentListTask) {
        dispatch(
          updateTask({
            ...currentListTask,
            custom_column_values: {
              ...currentListTask.custom_column_values,
              [column.key]: value,
            },
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        );
      }

      const body = {
        task_id: task.id,
        column_key: column.key,
        value,
        project_id: projectId,
      };

      if (socket && connected) {
        socket.emit(SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(), JSON.stringify(body));
        return;
      }

      await tasksCustomColumnsService.updateTaskCustomColumnValue(
        task.id,
        column.key,
        value,
        projectId
      );
    } catch (error) {
      dispatch(
        setTaskCustomColumnValue({
          taskId: task.id,
          columnKey: column.key,
          value: previousValue,
        })
      );

      const currentListTask = store.getState().taskManagement.entities[task.id];
      if (currentListTask) {
        dispatch(
          updateTask({
            ...currentListTask,
            custom_column_values: {
              ...currentListTask.custom_column_values,
              [column.key]: previousValue,
            },
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        );
      }

      message.error(
        t('taskInfoTab.details.customFields.updateError', {
          defaultValue: 'Failed to update custom field',
        })
      );
    }
  };

  const commitNumberValue = async (column: ITaskCustomColumn, rawValue: ITaskCustomColumnValue) => {
    const hasDraftValue = Object.prototype.hasOwnProperty.call(numberDraftValues, column.key);
    const nextValue = hasDraftValue
      ? numberDraftValues[column.key]
      : formatNumberValue(rawValue, column);
    const currentValue = formatNumberValue(rawValue, column);

    if (nextValue === currentValue) {
      if (hasDraftValue) {
        setNumberDraftValues(currentValues => {
          const updatedValues = { ...currentValues };
          delete updatedValues[column.key];
          return updatedValues;
        });
      }
      return;
    }

    await handleValueChange(column, nextValue ?? null);
    setNumberDraftValues(currentValues => {
      const updatedValues = { ...currentValues };
      delete updatedValues[column.key];
      return updatedValues;
    });
  };

  const commitTextValue = async (column: ITaskCustomColumn, rawValue: ITaskCustomColumnValue) => {
    const hasDraftValue = Object.prototype.hasOwnProperty.call(textDraftValues, column.key);
    const nextDraftValue = hasDraftValue ? textDraftValues[column.key] : null;
    const nextValue = nextDraftValue === '' ? null : nextDraftValue;
    const currentValue = rawValue == null ? null : String(rawValue);

    if (nextValue === currentValue) {
      if (hasDraftValue) {
        setTextDraftValues(currentValues => {
          const updatedValues = { ...currentValues };
          delete updatedValues[column.key];
          return updatedValues;
        });
      }
      return;
    }

    await handleValueChange(column, nextValue);
    setTextDraftValues(currentValues => {
      const updatedValues = { ...currentValues };
      delete updatedValues[column.key];
      return updatedValues;
    });
  };

  const renderField = (column: ITaskCustomColumn) => {
    const fieldType = column.custom_column_obj?.fieldType;
    const rawValue = task?.custom_column_values?.[column.key] ?? null;

    switch (fieldType) {
      case 'date': {
        const dateValue =
          typeof rawValue === 'string' && rawValue
            ? dayjs(rawValue)
            : rawValue instanceof Date
              ? dayjs(rawValue)
              : null;

        return (
          <DatePicker
            value={dateValue}
            allowClear
            className="w-full"
            placeholder={t('taskInfoTab.details.customFields.selectDate', {
              defaultValue: 'Select date',
            })}
            onChange={date => handleValueChange(column, date ? date.toISOString() : null)}
          />
        );
      }

      case 'number': {
        const decimals = column.custom_column_obj?.decimals ?? 0;
        const { addonBefore, addonAfter } = getTaskCustomNumberAffixes(column);

        return (
          <InputNumber
            value={
              Object.prototype.hasOwnProperty.call(numberDraftValues, column.key)
                ? numberDraftValues[column.key]
                : formatNumberValue(rawValue, column)
            }
            className="w-full"
            controls={false}
            addonBefore={addonBefore}
            addonAfter={addonAfter}
            precision={typeof decimals === 'number' ? decimals : 0}
            placeholder={t('taskInfoTab.details.customFields.enterNumber', {
              defaultValue: 'Enter number',
            })}
            onChange={value =>
              setNumberDraftValues(currentValues => ({
                ...currentValues,
                [column.key]: value ?? null,
              }))
            }
            onBlur={() => void commitNumberValue(column, rawValue)}
            onPressEnter={() => void commitNumberValue(column, rawValue)}
          />
        );
      }

      case 'selection': {
        const selectionsList = getSelectionOptions(column);

        return (
          <Select
            allowClear
            value={typeof rawValue === 'string' ? rawValue : undefined}
            className="w-full"
            placeholder={t('taskInfoTab.details.customFields.selectOption', {
              defaultValue: 'Select option',
            })}
            onChange={value => handleValueChange(column, value ?? null)}
            options={selectionsList.map(option => ({
              value: option.selection_name,
              label: (
                <Flex align="center" gap={8}>
                  <Badge color={option.selection_color} />
                  <span>{option.selection_name}</span>
                </Flex>
              ),
            }))}
          />
        );
      }

      case 'people': {
        return (
          <DrawerPeopleCustomField
            column={column}
            rawValue={rawValue}
            teamMembers={teamMembers}
            onValueChange={async (currentColumn, value) => handleValueChange(currentColumn, value)}
          />
        );
      }

      case 'text': {
        return (
          <Input
            value={
              Object.prototype.hasOwnProperty.call(textDraftValues, column.key)
                ? textDraftValues[column.key]
                : rawValue == null
                  ? ''
                  : String(rawValue)
            }
            className="w-full"
            placeholder={t('taskInfoTab.details.customFields.enterText', {
              defaultValue: 'Enter text',
            })}
            onChange={event =>
              setTextDraftValues(currentValues => ({
                ...currentValues,
                [column.key]: event.target.value,
              }))
            }
            onBlur={() => void commitTextValue(column, rawValue)}
            onPressEnter={() => void commitTextValue(column, rawValue)}
          />
        );
      }

      default:
        return (
          <Typography.Text type="secondary">
            {t('taskInfoTab.details.customFields.empty', { defaultValue: 'Empty' })}
          </Typography.Text>
        );
    }
  };

  if (!task || !visibleSupportedColumns.length) return null;

  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">
        {t('taskInfoTab.customFields.autoSaveHint', {
          defaultValue: 'Changes save automatically when you leave a field.',
        })}
      </Typography.Text>
      {visibleSupportedColumns.map(column => (
        <Flex key={column.id} align="center" gap={16}>
          <div style={{ minWidth: 160, flex: '0 0 160px' }}>
            <Typography.Text type="secondary">
              {getTaskCustomFieldDisplayName(column)}
            </Typography.Text>
          </div>
          <div style={{ flex: 1 }}>{renderField(column)}</div>
        </Flex>
      ))}
    </Flex>
  );
};

export default TaskDrawerCustomFields;
