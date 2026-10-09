import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Badge,
  Button,
  DatePicker,
  Flex,
  Input,
  InputNumber,
  PlusOutlined,
  CrownOutlined,
  Popover,
  Select,
  Typography,
  message,
} from '@/shared/antd-imports';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import { store } from '@/app/store';
import AvatarGroup from '@/components/AvatarGroup';
import PeopleDropdown from '@/components/common/people-dropdown/PeopleDropdown';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { setTaskCustomColumnValue } from '@/features/task-drawer/task-drawer.slice';
import { updateTask } from '@/features/task-management/task-management.slice';
import { selectCustomColumns } from '@/features/task-management/task-management.selectors';
import {
  resetCustomFieldValues,
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { openUpgradeModal, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
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
import { hasBusinessFeatureAccess, isFreeUser } from '@/utils/subscription-utils';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { LICENSING_SETTINGS } from '@/shared/licensing_settings';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';

interface TaskDrawerCustomFieldsProps {
  customColumns: ITaskCustomColumn[];
  projectId: string | null;
  task: ITaskViewModel | null;
  teamMembers: ITaskTeamMember[];
  isGuest?: boolean;
  canCreateTask?: boolean;
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
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
  disabled?: boolean;
  onValueChange: (column: ITaskCustomColumn, value: string[]) => Promise<void>;
}

const DrawerPeopleCustomField = ({
  column,
  rawValue,
  teamMembers,
  disabled = false,
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

  if (disabled) {
    return (
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
    );
  }

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
  isGuest = false,
  canCreateTask = true,
  isExpanded,
  onExpandedChange,
}: TaskDrawerCustomFieldsProps) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-drawer/task-drawer');
  const { t: tTaskList } = useTranslation('task-list-table');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isFree = isFreeUser(currentSession);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const isLtdUser =
    currentSession?.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL ||
    String(currentSession?.subscription_status || '').toLowerCase() === 'life_time_deal';
  const isAppSumoUser = String(currentSession?.subscription_type || '')
    .toLowerCase()
    .includes('appsumo');
  const { trackAppSumoEvent } = useAppSumoTracking();
  const storeCustomColumns = useAppSelector(selectCustomColumns);
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  const [numberDraftValues, setNumberDraftValues] = useState<Record<string, number | null>>({});
  const [textDraftValues, setTextDraftValues] = useState<Record<string, string>>({});
  const [limitPopoverOpen, setLimitPopoverOpen] = useState(false);
  const isReadOnly = isGuest || !canCreateTask;
  const canAddCustomColumn = !isGuest && canCreateTask;
  const customColumnsCount = storeCustomColumns?.length ?? customColumns.length;
  const hasReachedLimit =
    !hasBusinessAccess && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;
  const isGrandfathered =
    !hasBusinessAccess && isLtdUser && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;

  const visibleSupportedColumns = useMemo(() => {
    const sourceColumns =
      storeCustomColumns?.length > 0
        ? (storeCustomColumns as ITaskCustomColumn[])
        : customColumns;
    const supportedColumns = getDrawerSupportedCustomFields(sourceColumns);
    if (!projectId) return supportedColumns;

    try {
      const storedOrder = localStorage.getItem(`worklenz.taskList.columnOrder.${projectId}`);
      if (!storedOrder) return supportedColumns;

      const orderedColumnIds = JSON.parse(storedOrder) as string[];
      const orderByColumnId = new Map(orderedColumnIds.map((columnId, index) => [columnId, index]));

      return [...supportedColumns].sort(
        (leftColumn, rightColumn) =>
          (orderByColumnId.get(leftColumn.key) ?? Number.MAX_SAFE_INTEGER) -
          (orderByColumnId.get(rightColumn.key) ?? Number.MAX_SAFE_INTEGER)
      );
    } catch {
      return supportedColumns;
    }
  }, [customColumns, projectId, storeCustomColumns]);
  const initiallyVisibleColumns = visibleSupportedColumns.slice(0, 4);
  const hiddenColumns = visibleSupportedColumns.slice(4);

  const handleOpenCreateCustomColumn = () => {
    if (!canAddCustomColumn) return;

    if (isFree) {
      dispatch(toggleUpgradeModal());
      return;
    }

    if (isGrandfathered || hasReachedLimit) {
      setLimitPopoverOpen(true);
      if (isAppSumoUser) {
        trackAppSumoEvent(AppSumoUpsellEvents.CUSTOM_FIELD_LIMIT_HIT, { feature: 'custom_fields' });
        trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN, { feature: 'custom_fields' });
      }
      return;
    }

    if (hiddenColumns.length > 0 && !isExpanded) {
      onExpandedChange(true);
    }

    dispatch(resetCustomFieldValues());
    dispatch(
      setCustomColumnModalAttributes({ modalType: 'create', columnId: null, projectId: projectId ?? null })
    );
    dispatch(toggleCustomColumnModalOpen(true));
  };

  const handleUpgradeNow = () => {
    setLimitPopoverOpen(false);
    if (isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'custom_fields' });
    }
    dispatch(openUpgradeModal('customFields'));
  };

  const handleValueChange = async (
    column: ITaskCustomColumn,
    value: string | number | boolean | string[] | null
  ) => {
    if (isReadOnly || !task?.id || !projectId) return;

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
    if (!hasDraftValue) return;

    const nextDraftValue = textDraftValues[column.key];
    const nextValue = nextDraftValue === '' ? null : nextDraftValue;
    const currentValue = rawValue == null ? null : String(rawValue);

    // Clear draft immediately so a following blur (e.g. after Enter) cannot re-commit as null.
    setTextDraftValues(currentValues => {
      const updatedValues = { ...currentValues };
      delete updatedValues[column.key];
      return updatedValues;
    });

    if (nextValue === currentValue) return;

    await handleValueChange(column, nextValue);
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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

  if (!task) return null;

  const limitPopoverTitle = isGrandfathered
    ? tTaskList('customColumns.limitPopover.appSumoTitle', {
        defaultValue: 'Plan Upgrade Required',
      })
    : tTaskList('customColumns.limitPopover.title', {
        defaultValue: 'Custom Field Limit Reached',
      });

  const limitPopoverBody = isGrandfathered
    ? tTaskList('customColumns.limitPopover.appSumoBody', {
        defaultValue:
          'Adding custom fields beyond your current plan limit requires a Business plan.',
      })
    : tTaskList('customColumns.limitPopover.body', {
        defaultValue:
          'You have used all {{limit}} custom fields available on your plan. Upgrade to add unlimited custom fields to your projects.',
        limit: LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT,
      });

  return (
    <Flex vertical gap={12}>
      {visibleSupportedColumns.length > 0 && (
        <Typography.Text type="secondary">
          {t('taskInfoTab.customFields.autoSaveHint', {
            defaultValue: 'Changes save automatically when you leave a field.',
          })}
        </Typography.Text>
      )}

      {initiallyVisibleColumns.map(column => (
        <Flex key={column.id || column.key} align="center" gap={16}>
          <div style={{ minWidth: 160, flex: '0 0 160px' }}>
            <Typography.Text type="secondary">
              {getTaskCustomFieldDisplayName(column)}
            </Typography.Text>
          </div>
          <div style={{ flex: 1 }}>{renderField(column)}</div>
        </Flex>
      ))}

      {canAddCustomColumn && (
        <Popover
          open={limitPopoverOpen}
          title={limitPopoverTitle}
          content={
            <Flex vertical gap={12} style={{ maxWidth: 260 }}>
              <Typography.Text>{limitPopoverBody}</Typography.Text>
              <Button type="primary" size="small" onClick={handleUpgradeNow}>
                {tTaskList('customColumns.limitPopover.cta', { defaultValue: 'Upgrade Now' })}
              </Button>
            </Flex>
          }
          trigger={[]}
          placement="bottomLeft"
          onOpenChange={setLimitPopoverOpen}
        >
          <div className="flex items-center min-w-max px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px] rounded">
            <button
              type="button"
              aria-label={t('taskInfoTab.customFields.addCustomColumn', {
                defaultValue: 'Add Custom Column',
              })}
              onClick={handleOpenCreateCustomColumn}
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors h-full w-full px-2 text-left"
            >
              {isFree ? (
                <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
              ) : (
                <PlusOutlined style={{ color: isDarkMode ? '#8c8c8c' : '#595959' }} />
              )}
              {t('taskInfoTab.customFields.addCustomColumn', {
                defaultValue: 'Add Custom Column',
              })}
            </button>
          </div>
        </Popover>
      )}

      {hiddenColumns.length > 0 && (
        <Button
          type="link"
          style={{ alignSelf: 'flex-start', padding: 0, height: 'auto' }}
          onClick={() => onExpandedChange(!isExpanded)}
        >
          {isExpanded
            ? t('taskInfoTab.customFields.hideFields', { defaultValue: 'Hide fields' })
            : t('taskInfoTab.customFields.showMoreFields', {
                count: hiddenColumns.length,
                defaultValue: 'Show {{count}} more fields',
              })}
        </Button>
      )}

      {isExpanded &&
        hiddenColumns.map(column => (
          <Flex key={column.id || column.key} align="center" gap={16}>
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
