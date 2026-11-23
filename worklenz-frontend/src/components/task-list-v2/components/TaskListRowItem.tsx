import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';
import { Task } from '@/types/task-management.types';
import { ColumnConfig, AddTaskRowItem } from '../constants/columns';
import { DropSpacer, InsertTaskDivider } from './TaskListDropIndicators';
import AddTaskRow from './AddTaskRow';
import TaskRowWithSubtasks from '../TaskRowWithSubtasks';
import { isTaskListProfilingEnabled, recordTaskListRender } from '../task-list-profiling';
import type { VirtuosoGroupItem } from '../hooks/useVirtuosoGroups';

export type VirtuosoRowItem = (Task & { originalIndex: number }) | AddTaskRowItem;

export interface TaskListRowItemProps {
  item: VirtuosoRowItem;
  index: number;
  group: VirtuosoGroupItem;
  projectId: string;
  visibleColumns: ColumnConfig[];
  isDarkMode: boolean;
  isBacklogMode: boolean;
  activeSprintGroupIds: Set<string>;
  activeId: string | null;
  overId: string | null;
  dropPosition: 'before' | 'after' | 'into' | null;
  canCreateTask: boolean;
  isWorkReadOnly: boolean;
  isActiveAddRow: boolean;
  onActivateAddRow: (groupId: string) => void;
  onDeactivateAddRow: (groupId: string) => void;
  onTaskCreated: (
    task: Task,
    groupId: string,
    openDrawer: boolean,
    insertedAfterTaskId?: string | null
  ) => void;
  onSetInsertAnchor: (anchor: { groupId: string; afterTaskId: string | null }) => void;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
}

export const TaskListRowItem: React.FC<TaskListRowItemProps> = React.memo(
  ({
    item,
    index,
    group,
    projectId,
    visibleColumns,
    isDarkMode,
    isBacklogMode,
    activeSprintGroupIds,
    activeId,
    overId,
    dropPosition,
    canCreateTask,
    isWorkReadOnly,
    isActiveAddRow,
    onActivateAddRow,
    onDeactivateAddRow,
    onTaskCreated,
    onSetInsertAnchor,
    updateTaskCustomColumnValue,
  }) => {
    const { t } = useTranslation('task-list-table');
    const { token: themeToken } = theme.useToken();

    const indexInGroup = index - group.startIndex;
    const isFirstInGroup = indexInGroup === 0 && !('isAddTaskRow' in item);
    const previousItem = indexInGroup > 0 ? group?.tasks?.[indexInGroup - 1] : null;

    const showInsertDivider =
      indexInGroup > 0 &&
      !('isAddTaskRow' in item) &&
      previousItem &&
      !('isAddTaskRow' in previousItem);

    const isLastInGroup =
      !('isAddTaskRow' in item) &&
      indexInGroup === group.tasks.length - 1 &&
      item.id !== `add-task-${group.id}-0`;

    const isOverThisTask = activeId && overId === item.id && !('isAddTaskRow' in item);
    const showBefore = isOverThisTask && dropPosition === 'before';
    const showAfter = isOverThisTask && dropPosition === 'after';
    const showIntoParent = isOverThisTask && dropPosition === 'into';
    const isAddTaskRowItem = 'isAddTaskRow' in item && item.isAddTaskRow;
    const isLastItemOfGroup =
      indexInGroup === (group?.tasks?.length ?? 0) - 1 &&
      group.tasks.some(task => !('isAddTaskRow' in task));

    const backlogCardStyle: React.CSSProperties = isBacklogMode
      ? {
          background: themeToken.colorBgContainer,
          borderLeft: activeSprintGroupIds.has(group?.id ?? '')
            ? `3px solid ${themeToken.colorPrimary}`
            : `1px solid ${themeToken.colorBorderSecondary}`,
          borderRight: `1px solid ${themeToken.colorBorderSecondary}`,
          ...(isLastItemOfGroup && {
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            // overflow:hidden breaks position:sticky on the create-work-item row
            ...(!isAddTaskRowItem && { overflow: 'hidden' }),
          }),
        }
      : {};

    const renderContent = () => {
      if ('isAddTaskRow' in item && item.isAddTaskRow) {
        if (!canCreateTask || isWorkReadOnly) return null;
        return (
          <AddTaskRow
            groupId={item.groupId}
            groupType={item.groupType}
            groupValue={item.groupValue}
            projectId={projectId}
            visibleColumns={visibleColumns}
            rowId={item.rowId}
            autoFocus={item.autoFocus}
            isActive={isActiveAddRow}
            isInsertMode={!!item.isInsertMode}
            insertAfterTaskId={item.insertAfterTaskId || null}
            onActivate={() => onActivateAddRow(item.groupId)}
            onDeactivate={() => onDeactivateAddRow(item.groupId)}
            onTaskCreated={(task, options) =>
              onTaskCreated(
                task,
                item.groupId,
                !!options?.openDrawer,
                options?.insertAfterTaskId || null
              )
            }
          />
        );
      }

      const row = (
        <TaskRowWithSubtasks
          taskId={item.id}
          projectId={projectId}
          visibleColumns={visibleColumns}
          isFirstInGroup={isFirstInGroup}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
          canCreateTask={canCreateTask}
          isGuest={isWorkReadOnly}
        />
      );

      return isTaskListProfilingEnabled ? (
        <React.Profiler id="row" onRender={recordTaskListRender}>
          {row}
        </React.Profiler>
      ) : (
        row
      );
    };

    return (
      <div
        style={{ minWidth: 'max-content', ...backlogCardStyle }}
        className={`relative ${
          showIntoParent
            ? 'ring-2 ring-inset ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20 rounded'
            : ''
        }`}
        onMouseMove={e => {
          // Direct DOM update: cursor tracking for insert task button without state re-render
          const btn = (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(
            '[data-insert-btn]'
          );
          if (!btn) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          btn.style.left = `${x}px`;
        }}
      >
        {showBefore && activeId && (
          <DropSpacer
            key="drop-before"
            isVisible={true}
            visibleColumns={visibleColumns}
            isDarkMode={isDarkMode}
          />
        )}
        {showInsertDivider && previousItem && canCreateTask && !isWorkReadOnly && (
          <InsertTaskDivider
            key="insert-divider"
            isVisible={true}
            isNearGroupHeader={false}
            title={t('insertTaskText', { defaultValue: 'Insert Task' })}
            onInsert={() => {
              onSetInsertAnchor({
                groupId: group.id,
                afterTaskId: previousItem.id,
              });
            }}
          />
        )}
        <React.Fragment key={item.id ?? `virtuoso-item-${index}`}>{renderContent()}</React.Fragment>
        {isLastInGroup && canCreateTask && !isWorkReadOnly && (
          <InsertTaskDivider
            key="insert-divider-bottom"
            isVisible={true}
            isNearGroupHeader={false}
            title={t('insertTaskAtBottomText', { defaultValue: 'Insert Task at Bottom' })}
            onInsert={() => {
              onSetInsertAnchor({
                groupId: group.id,
                afterTaskId: item.id,
              });
            }}
          />
        )}
        {showAfter && activeId && (
          <DropSpacer
            key="drop-after"
            isVisible={true}
            visibleColumns={visibleColumns}
            isDarkMode={isDarkMode}
          />
        )}
      </div>
    );
  }
);

TaskListRowItem.displayName = 'TaskListRowItem';
