import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ExportOutlined, Tooltip } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import {
  downloadBlobFile,
  taskExportApiService,
} from '@/api/projects/task-export.api.service';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import alertService from '@/services/alerts/alertService';
import {
  canAccessTaskExport,
  hasTaskExportRoleAccess,
} from '@/utils/task-export-access';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import logger from '@/utils/errorLogger';
import { isTeamLeadRole } from '@/types/roles/role.types';

interface FilteredTaskExportButtonProps {
  position: 'list' | 'board';
  /** True when status/assignee/priority/phase/label/search (etc.) filters are active — not sort/groupBy alone. */
  hasActiveFilters: boolean;
  isDarkMode?: boolean;
}

/** Exported for TE-37 unit tests — List view filtered task ids as shown on screen. */
export const selectListFilteredTaskIds = (state: {
  taskManagement: { groups: Array<{ taskIds?: string[] }> };
}): string[] => {
  const ids = state.taskManagement.groups.flatMap(group => group.taskIds || []);
  return Array.from(new Set(ids.filter(Boolean)));
};

/**
 * Exported for TE-37 unit tests — Board view filtered top-level task ids only.
 * Aligned with List: do not flatten nested subtask ids so identical filters
 * produce the same export set from either view.
 */
export const selectBoardFilteredTaskIds = (state: {
  enhancedKanbanReducer: {
    taskGroups: Array<{
      tasks?: Array<{ id?: string }>;
    }>;
  };
}): string[] => {
  const ids: string[] = [];
  for (const group of state.enhancedKanbanReducer.taskGroups) {
    for (const task of group.tasks || []) {
      if (task.id) ids.push(task.id);
    }
  }
  return Array.from(new Set(ids));
};

/**
 * Filtered export control for List/Board toolbars (Phase 4).
 * Visible when filters are active and the user has export role access.
 * Free/Pro users see the button and are prompted to upgrade on click.
 * Disabled when the filtered set has zero tasks (Business users only).
 */
export const FilteredTaskExportButton = ({
  position,
  hasActiveFilters,
  isDarkMode = false,
}: FilteredTaskExportButtonProps) => {
  const { t } = useTranslation('task-list-filters');
  const { t: tCommon } = useTranslation('common');
  const dispatch = useAppDispatch();
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const auth = useAuthService();
  const isOwnerOrAdmin = auth.isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const isTeamLead = isTeamLeadRole(auth.role);
  const hasBusinessAccess = hasBusinessFeatureAccess(auth.getCurrentSession());
  const canViewExport = hasTaskExportRoleAccess(
    isOwnerOrAdmin,
    isProjectManager,
    isTeamLead
  );
  const canExport = canAccessTaskExport(
    isOwnerOrAdmin,
    isProjectManager,
    isTeamLead,
    hasBusinessAccess
  );

  const listTaskIds = useAppSelector(selectListFilteredTaskIds);
  const boardTaskIds = useAppSelector(selectBoardFilteredTaskIds);
  const taskIds = position === 'board' ? boardTaskIds : listTaskIds;

  const [isExporting, setIsExporting] = useState(false);

  const isDisabled = hasBusinessAccess && (taskIds.length === 0 || !projectId);

  const tooltipTitle = useMemo(() => {
    if (!hasBusinessAccess) {
      return t('exportFilteredBusinessPlanTooltip', {
        defaultValue: 'Task export requires a Business plan. Upgrade to export.',
      });
    }
    if (taskIds.length === 0) {
      return t('exportFilteredEmpty', {
        defaultValue: 'No tasks match current filters',
      });
    }
    return t('exportFilteredTooltip', {
      defaultValue: 'Export filtered tasks as CSV',
    });
  }, [hasBusinessAccess, taskIds.length, t]);

  const handleUpgradeClick = useCallback(() => {
    dispatch(toggleUpgradeModal());
  }, [dispatch]);

  const handleExport = useCallback(async () => {
    if (!hasBusinessAccess) {
      handleUpgradeClick();
      return;
    }
    if (!projectId || taskIds.length === 0) return;

    setIsExporting(true);
    try {
      const { blob, fileName } = await taskExportApiService.createFiltered(
        projectId,
        taskIds
      );
      downloadBlobFile(blob, fileName);
      alertService.success(
        t('exportFilteredSuccessTitle', { defaultValue: 'Export downloaded' }),
        t('exportFilteredSuccessMessage', {
          defaultValue: 'Filtered tasks CSV has been downloaded.',
        })
      );
    } catch (error: unknown) {
      logger.error('Filtered task export failed', error);
      alertService.error(
        t('exportFilteredFailedTitle', { defaultValue: 'Export failed' }),
        error instanceof Error
          ? error.message
          : t('exportFilteredFailedMessage', {
              defaultValue: 'Could not export filtered tasks. Please try again.',
            })
      );
    } finally {
      setIsExporting(false);
    }
  }, [hasBusinessAccess, handleUpgradeClick, projectId, taskIds, t]);

  if (!canViewExport || !hasActiveFilters) {
    return null;
  }

  return (
    <Tooltip title={tooltipTitle}>
      <Button
        size="small"
        type="default"
        icon={<ExportOutlined />}
        loading={isExporting}
        disabled={isDisabled}
        onClick={() => void handleExport()}
        aria-label={
          canExport
            ? t('exportFiltered', { defaultValue: 'Export' })
            : tCommon('upgrade-plan', { defaultValue: 'Upgrade plan' })
        }
        className={
          isDarkMode
            ? 'border-[#303030] bg-[#141414] text-gray-200'
            : undefined
        }
      >
        {t('exportFiltered', { defaultValue: 'Export' })}
      </Button>
    </Tooltip>
  );
};
