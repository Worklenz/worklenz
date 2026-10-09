import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Button, Tag, Tooltip, theme } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useProjectTabNavigation } from '@/hooks/useProjectTabNavigation';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { formatStoryPoints } from '@/lib/project/story-points';

interface SprintHealthBarProps {
  projectId: string;
}

/**
 * Software-project summary of the active sprint shown above the project tabs:
 * goal, completion, scope change, blocked and high-priority work, and delivery risk.
 */
export const SprintHealthBar = ({ projectId }: SprintHealthBarProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const { goToProjectTab } = useProjectTabNavigation();
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const listTaskEntities = useAppSelector(state => state.taskManagement.entities);
  const boardTaskGroups = useAppSelector(state => state.enhancedKanbanReducer.taskGroups);
  const isFirstRenderRef = useRef(true);

  const activeSprint = useMemo(
    () => phaseList.find(phase => phase.sprint_status === 'active'),
    [phaseList]
  );

  // Task edits in the list or board change sprint metrics; refresh them shortly after.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void dispatch(fetchPhasesByProjectId(projectId));
    }, METRICS_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dispatch, listTaskEntities, boardTaskGroups, projectId]);

  const secondaryTextStyle = { color: token.colorTextSecondary };

  if (!activeSprint) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 mt-1 mb-3 text-[12.5px]" style={secondaryTextStyle}>
        <strong style={{ color: token.colorText }}>
          {t('sprintHealthNoActiveSprint', { defaultValue: 'No active sprint' })}
        </strong>
        <Button size="small" type="primary" onClick={() => goToProjectTab('backlog')}>
          {t('sprintHealthPlanSprint', { defaultValue: 'Plan sprint' })}
        </Button>
      </div>
    );
  }

  const progress = getSprintProgress(activeSprint);
  const completionPercent = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;
  const risk = getSprintRisk(activeSprint);

  return (
    <div
      className="flex flex-wrap items-center gap-2.5 mt-1 mb-3 text-[12.5px]"
      style={secondaryTextStyle}
      aria-label={t('sprintHealthLabel', { defaultValue: 'Active sprint health' })}
    >
      <strong style={{ color: token.colorText }}>{activeSprint.name}</strong>

      {activeSprint.sprint_goal && (
        <Tooltip title={activeSprint.sprint_goal}>
          <span className="max-w-[420px] truncate">{activeSprint.sprint_goal}</span>
        </Tooltip>
      )}

      <span
        role="progressbar"
        aria-valuenow={completionPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('sprintHealthProgress', {
          defaultValue: '{{percent}}% complete',
          percent: completionPercent,
        })}
        className="hidden sm:block w-[115px] h-[5px] rounded overflow-hidden"
        style={{ background: token.colorBorderSecondary }}
      >
        <span
          className="block h-full transition-[width] duration-300"
          style={{ width: `${completionPercent}%`, background: token.colorPrimary }}
        />
      </span>

      <span>
        {progress.isPointBased
          ? t('sprintHealthPointsDone', {
              defaultValue: '{{done}}/{{total}} pts',
              done: formatStoryPoints(progress.done),
              total: formatStoryPoints(progress.total),
            })
          : t('sprintHealthIssuesDone', {
              defaultValue: '{{done}}/{{total}} issues',
              done: progress.done,
              total: progress.total,
            })}
      </span>

      <HealthLink
        label={t('sprintHealthScope', {
          defaultValue: '+{{count}} scope',
          count: activeSprint.scope_added_count ?? 0,
        })}
        tooltip={t('sprintHealthScopeTooltip', {
          defaultValue: 'Issues added after the sprint started',
        })}
        onClick={() => goToProjectTab('backlog')}
      />
      <HealthLink
        label={t('sprintHealthBlocked', {
          defaultValue: '{{count}} blocked',
          count: activeSprint.blocked_issue_count ?? 0,
        })}
        onClick={() => goToProjectTab('board')}
      />
      <HealthLink
        label={t('sprintHealthHighPriority', {
          defaultValue: '{{count}} critical/high open',
          count: activeSprint.high_priority_open_count ?? 0,
        })}
        onClick={() => goToProjectTab('board')}
      />

      {risk && (
        <Tag
          bordered={false}
          color={RISK_TAG_COLORS[risk]}
          className="m-0 rounded-full px-2 font-bold"
        >
          {risk === 'overdue'
            ? t('sprintHealthOverdue', { defaultValue: 'Overdue' })
            : risk === 'atRisk'
              ? t('sprintHealthAtRisk', { defaultValue: 'At risk' })
              : t('sprintHealthOnTrack', { defaultValue: 'On track' })}
        </Tag>
      )}
    </div>
  );
};

interface HealthLinkProps {
  label: string;
  tooltip?: string;
  onClick: () => void;
}

const HealthLink = ({ label, tooltip, onClick }: HealthLinkProps) => {
  const { token } = theme.useToken();
  const [isHovered, setIsHovered] = useState(false);
  const link = (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className="border-0 bg-transparent p-0 cursor-pointer rounded-sm transition-colors duration-150"
      style={{ color: isHovered ? token.colorPrimary : 'inherit' }}
    >
      {label}
    </button>
  );
  return tooltip ? <Tooltip title={tooltip}>{link}</Tooltip> : link;
};

type SprintRisk = 'onTrack' | 'atRisk' | 'overdue';

/** Progress in story points when the sprint is estimated, otherwise in issues. */
const getSprintProgress = (sprint: ITaskPhase) => {
  const totalPoints = sprint.total_points ?? 0;
  if (totalPoints > 0) {
    return { isPointBased: true, done: sprint.done_points ?? 0, total: totalPoints };
  }
  return {
    isPointBased: false,
    done: sprint.done_issue_count ?? 0,
    total: sprint.issue_count ?? 0,
  };
};

/** Compares elapsed sprint time with completed work to flag delivery risk. */
const getSprintRisk = (sprint: ITaskPhase): SprintRisk | null => {
  if (!sprint.start_date || !sprint.end_date) return null;
  const startDate = dayjs(sprint.start_date);
  const endDate = dayjs(sprint.end_date);
  const totalDuration = endDate.diff(startDate);
  if (totalDuration <= 0) return null;

  const progress = getSprintProgress(sprint);
  const completedRatio = progress.total ? progress.done / progress.total : 1;
  if (dayjs().isAfter(endDate) && completedRatio < 1) return 'overdue';

  const elapsedRatio = Math.min(Math.max(dayjs().diff(startDate) / totalDuration, 0), 1);
  return elapsedRatio - completedRatio > AT_RISK_THRESHOLD ? 'atRisk' : 'onTrack';
};

const METRICS_REFRESH_DELAY_MS = 1500;
const AT_RISK_THRESHOLD = 0.2;
const RISK_TAG_COLORS: Record<SprintRisk, string> = {
  onTrack: 'success',
  atRisk: 'warning',
  overdue: 'error',
};

export default SprintHealthBar;
