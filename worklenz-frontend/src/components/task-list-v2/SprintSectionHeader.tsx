import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
// @ts-ignore: Heroicons module types
import { ChevronRightIcon, EllipsisHorizontalIcon, PencilIcon } from '@heroicons/react/24/outline';
import {
  Button,
  Dropdown,
  MenuProps,
  Tooltip,
  theme,
} from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useSprintActions } from '@/hooks/useSprintActions';
import { useProjectTabNavigation } from '@/hooks/useProjectTabNavigation';
import { selectAllTasksArray } from '@/features/task-management/task-management.slice';
import {
  SprintFormModal,
  SprintFormMode,
  SprintStatusChip,
} from '@/components/task-management/sprint-form-modal';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { formatStoryPoints } from '@/lib/project/story-points';

interface SprintSectionHeaderProps {
  /** `null` renders the Backlog (no sprint) section. */
  sprint: ITaskPhase | null;
  taskIds: string[];
  isCollapsed: boolean;
  onToggle: () => void;
  projectId: string;
  canManage: boolean;
  extraControls?: React.ReactNode;
}

/**
 * Backlog sprint-planning section header (Software projects): sprint status, metrics,
 * goal and lifecycle actions laid out as a full-width card header.
 */
export const SprintSectionHeader = ({
  sprint,
  taskIds,
  isCollapsed,
  onToggle,
  projectId,
  canManage,
  extraControls,
}: SprintSectionHeaderProps) => {
  const { t } = useTranslation('task-management');
  const { token } = theme.useToken();
  const { goToProjectTab } = useProjectTabNavigation();
  const sprintActions = useSprintActions(projectId);
  const allTasks = useAppSelector(selectAllTasksArray);
  const statusList = useAppSelector(state => state.taskStatusReducer.status);

  const headerRef = useRef<HTMLDivElement>(null);
  const visibleWidth = useVisibleScrollWidth(headerRef);
  const [isHovered, setIsHovered] = useState(false);
  const [sprintFormMode, setSprintFormMode] = useState<SprintFormMode | null>(null);

  const isActiveSprint = sprint?.sprint_status === 'active';
  const isPlannedSprint = sprint?.sprint_status === 'planned';

  const sprintStats = useMemo(() => {
    const doneStatusIds = new Set(statusList.filter(s => s.is_done).map(s => s.id));
    const tasksById = new Map(allTasks.map(task => [task.id, task]));
    return taskIds.reduce(
      (stats, taskId) => {
        const task = tasksById.get(taskId);
        if (!task) return stats;
        const points = task.story_points ?? 0;
        const isDone = doneStatusIds.has(task.status);
        stats.totalPoints += points;
        if (isDone) {
          stats.done += 1;
          stats.donePoints += points;
        }
        if (!task.assignees?.length) stats.unassigned += 1;
        return stats;
      },
      { done: 0, unassigned: 0, totalPoints: 0, donePoints: 0 }
    );
  }, [allTasks, statusList, taskIds]);

  const sprintDateRange = useMemo(() => {
    if (!sprint?.start_date && !sprint?.end_date) return null;
    const formatDate = (date?: string | null) => (date ? dayjs(date).format('MMM D') : '?');
    return `${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)}`;
  }, [sprint?.start_date, sprint?.end_date]);

  const title = !sprint
    ? t('backlogGroupName', { defaultValue: 'Backlog' })
    : isActiveSprint
      ? t('currentSprintName', { defaultValue: 'Current sprint · {{name}}', name: sprint.name })
      : sprint.name;

  const goal = sprint
    ? sprint.sprint_goal
    : t('backlogSectionGoal', { defaultValue: 'Prioritized future work' });

  const handleToggleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onToggle();
  };

  const handleViewOnBoard = () => goToProjectTab('board');

  const handleCompleteSprint = () => {
    if (!sprint) return;
    sprintActions.completeSprint(sprint.id, taskIds.length - sprintStats.done);
  };

  const sprintMenu: MenuProps = {
    items: [
      {
        key: 'edit',
        icon: <PencilIcon className="h-4 w-4" />,
        label: t('editSprint', { defaultValue: 'Edit sprint' }),
        onClick: () => setSprintFormMode('edit'),
      },
    ],
  };

  const metricStyle: React.CSSProperties = {
    color: token.colorTextSecondary,
    borderLeft: `1px solid ${token.colorBorderSecondary}`,
  };

  return (
    <div ref={headerRef} className="relative flex items-center w-full min-w-max">
      <span
        className="contents"
        onClick={stopEventPropagation}
        onKeyDown={stopEventPropagation}
        onPointerDown={stopEventPropagation}
        onMouseDown={stopEventPropagation}
      >
        {sprintActions.sprintModalContextHolder}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        aria-label={title}
        onClick={onToggle}
        onKeyDown={handleToggleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`sticky left-0 z-[25] flex items-center gap-2.5 px-3 py-2 min-h-[44px] cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 ${
          isCollapsed ? 'rounded-[10px]' : 'rounded-t-[10px]'
        }`}
        style={{
          width: visibleWidth ?? '100%',
          background: isActiveSprint
            ? token.colorPrimaryBg
            : isHovered
              ? token.colorFillQuaternary
              : token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderLeft: isActiveSprint
            ? `3px solid ${token.colorPrimary}`
            : `1px solid ${token.colorBorderSecondary}`,
          color: token.colorText,
        }}
      >
        <ChevronRightIcon
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
          style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
        />

        <span className="text-[13.5px] font-bold whitespace-nowrap">{title}</span>

        {sprint?.sprint_status && sprint.sprint_status !== 'completed' && (
          <SprintStatusChip status={sprint.sprint_status} />
        )}

        {isActiveSprint ? (
          <>
            <span className="text-[11px] pl-2 whitespace-nowrap" style={metricStyle}>
              {sprintStats.totalPoints > 0
                ? t('sprintCompletedPoints', {
                    defaultValue: '{{done}}/{{total}} pts completed',
                    done: formatStoryPoints(sprintStats.donePoints),
                    total: formatStoryPoints(sprintStats.totalPoints),
                  })
                : t('sprintCompletedCount', {
                    defaultValue: '{{done}}/{{total}} completed',
                    done: sprintStats.done,
                    total: taskIds.length,
                  })}
            </span>
            <Tooltip
              title={t('sprintScopeAddedTooltip', {
                defaultValue: 'Issues added after the sprint started',
              })}
            >
              <span className="text-[11px] pl-2 whitespace-nowrap" style={metricStyle}>
                {t('sprintScopeAdded', {
                  defaultValue: '+{{count}} scope',
                  count: sprint.scope_added_count ?? 0,
                })}
              </span>
            </Tooltip>
          </>
        ) : (
          <span className="text-xs whitespace-nowrap" style={{ color: token.colorTextSecondary }}>
            {t('sprintItemCount', { defaultValue: '{{count}} items', count: taskIds.length })}
            {' · '}
            {t('sprintPointsTotal', {
              defaultValue: '{{points}} pts',
              points: formatStoryPoints(sprintStats.totalPoints),
            })}
          </span>
        )}

        {sprintDateRange && (
          <span className="text-[11px] pl-2 whitespace-nowrap" style={metricStyle}>
            {sprintDateRange}
          </span>
        )}

        {goal && (
          <Tooltip title={goal}>
            <span
              className="hidden lg:block ml-2 min-w-0 flex-1 truncate text-xs"
              style={{ color: token.colorTextSecondary }}
            >
              {goal}
            </span>
          </Tooltip>
        )}

        <div
          className="ml-auto flex items-center gap-1.5 shrink-0"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          {extraControls}
          {sprint && canManage && (
            <>
              {isActiveSprint && (
                <>
                  <Button size="small" onClick={handleViewOnBoard}>
                    {t('viewOnBoard', { defaultValue: 'View on Board' })}
                  </Button>
                  <Button size="small" onClick={handleCompleteSprint}>
                    {t('completeSprint', { defaultValue: 'Complete sprint' })}
                  </Button>
                </>
              )}
              {isPlannedSprint && (
                <Button size="small" type="primary" onClick={() => setSprintFormMode('start')}>
                  {t('startSprint', { defaultValue: 'Start sprint' })}
                </Button>
              )}
              <Dropdown menu={sprintMenu} trigger={['click']} placement="bottomRight">
                <Button
                  size="small"
                  type="text"
                  icon={<EllipsisHorizontalIcon className="h-4 w-4" />}
                  aria-label={t('sprintActionsFor', {
                    defaultValue: 'Actions for {{name}}',
                    name: sprint.name,
                  })}
                />
              </Dropdown>
            </>
          )}
        </div>
      </div>

      {sprint && sprintFormMode && (
        <SprintFormModal
          open
          mode={sprintFormMode}
          sprint={sprint}
          projectId={projectId}
          issueCount={taskIds.length}
          unassignedCount={sprintStats.unassigned}
          onClose={() => setSprintFormMode(null)}
        />
      )}
    </div>
  );
};

/** Width of the nearest horizontally scrolling ancestor, so the header spans the visible area. */
const useVisibleScrollWidth = (ref: React.RefObject<HTMLElement | null>) => {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const scrollParent = findHorizontalScrollParent(ref.current);
    if (!scrollParent) return;
    const updateWidth = () => setWidth(scrollParent.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollParent);
    return () => observer.disconnect();
  }, [ref]);

  return width;
};

const stopEventPropagation = (event: React.SyntheticEvent) => event.stopPropagation();

const findHorizontalScrollParent = (element: HTMLElement | null): HTMLElement | null => {
  let node = element?.parentElement ?? null;
  while (node) {
    const { overflowX } = window.getComputedStyle(node);
    if (overflowX === 'auto' || overflowX === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
};

export default SprintSectionHeader;
