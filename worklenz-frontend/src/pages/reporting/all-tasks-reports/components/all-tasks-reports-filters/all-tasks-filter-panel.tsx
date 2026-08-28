import { memo, useCallback, useMemo, useState } from 'react';
import { Badge, Button, Flex, Popover, Typography } from '@/shared/antd-imports';
import { FilterOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  resetAllFilters,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

import AllTasksTeamFilter from './all-tasks-team-filter';
import AllTasksProjectFilter from './all-tasks-project-filter';
import AllTasksStatusFilter from './all-tasks-status-filter';
import AllTasksPriorityFilter from './all-tasks-priority-filter';
import AllTasksAssigneeFilter from './all-tasks-assignee-filter';
import AllTasksPhaseFilter from './all-tasks-phase-filter';
import AllTasksClientFilter from './all-tasks-client-filter';

const { Text } = Typography;

const AllTasksFilterPanel = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  const [panelOpen, setPanelOpen] = useState(false);

  const {
    teams,
    selectedProjects,
    selectedStatuses,
    selectedPriorities,
    selectedAssignees,
    selectedPhases,
    selectedClients,
  } = useAppSelector(state => state.allTasksReportsReducer);

  // Count active filters
  const deselectedTeamsCount = useMemo(
    () => teams.filter(t => !t.selected).length,
    [teams]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (deselectedTeamsCount > 0) count++;
    if (selectedProjects.length > 0) count++;
    if (selectedStatuses.length > 0) count++;
    if (selectedPriorities.length > 0) count++;
    if (selectedAssignees.length > 0) count++;
    if (selectedPhases.length > 0) count++;
    if (selectedClients.length > 0) count++;
    return count;
  }, [
    deselectedTeamsCount,
    selectedProjects,
    selectedStatuses,
    selectedPriorities,
    selectedAssignees,
    selectedPhases,
    selectedClients,
  ]);

  const handleClearAll = useCallback(() => {
    dispatch(resetAllFilters());
    dispatch(fetchAllTasks());
  }, [dispatch]);

  const panelContent = (
    <div style={{ width: 'min(560px, calc(100vw - 32px))', padding: '4px 0' }}>
      {/* Header */}
      <Flex align="center" justify="space-between" style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14 }}>
          {t('filtersTitle', { defaultValue: 'Filters' })}
        </Text>
        {activeFilterCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={handleClearAll}>
            {t('clearAll', { defaultValue: 'Clear' })}
          </Button>
        )}
      </Flex>

      {/* Quick filters label */}
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
        {t('quickFilters', { defaultValue: 'Quick filters' })}
      </Text>

      {/* All filter chips */}
      <Flex gap={8} wrap="wrap" align="center">
        <AllTasksTeamFilter />
        <AllTasksProjectFilter />
        <AllTasksStatusFilter />
        <AllTasksPriorityFilter />
        <AllTasksAssigneeFilter />
        <AllTasksPhaseFilter />
        <AllTasksClientFilter />
      </Flex>
    </div>
  );

  return (
    <Popover
      content={panelContent}
      trigger="click"
      placement="bottomLeft"
      open={panelOpen}
      onOpenChange={setPanelOpen}
      overlayStyle={{ padding: 0 }}
      overlayInnerStyle={{ padding: '12px 16px', borderRadius: 8 }}
    >
      <Button
        icon={<FilterOutlined />}
        className={`transition-colors duration-300 ${
          panelOpen || activeFilterCount > 0 ? 'border-[#1890ff] text-[#1890ff]' : ''
        }`}
        style={{ height: 30, fontSize: 12, borderRadius: 7, paddingInline: 12 }}
      >
        {t('filterButton', { defaultValue: 'Filter' })}
        {activeFilterCount > 0 && (
          <Badge
            count={activeFilterCount}
            size="small"
            style={{ marginLeft: 4, backgroundColor: '#1890ff' }}
          />
        )}
      </Button>
    </Popover>
  );
};

export default memo(AllTasksFilterPanel);
