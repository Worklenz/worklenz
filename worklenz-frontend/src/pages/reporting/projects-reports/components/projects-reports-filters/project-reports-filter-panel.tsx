import { memo, useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Flex,
  Popover,
  Tag,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { FilterOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  resetAllFilters,
  fetchProjectDataForCurrentView,
} from '@/features/reporting/projectReports/project-reports-slice';

import ProjectTeamFilterDropdown from './project-team-filter-dropdown';
import ProjectStatusFilterDropdown from './project-status-filter-dropdown';
import ProjectHealthFilterDropdown from './project-health-filter-dropdown';
import ProjectCategoriesFilterDropdown from './project-categories-filter-dropdown';
import ProjectManagersFilterDropdown from './project-managers-filter-dropdown';
import ProjectClientFilterDropdown from './project-client-filter-dropdown';
import ProjectPriorityFilterDropdown from './project-priority-filter-dropdown';

const { Text } = Typography;

const ProjectReportsFilterPanel = () => {
  const { t } = useTranslation('reporting-projects-filters');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const [panelOpen, setPanelOpen] = useState(false);

  const {
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    selectedClients,
    selectedProjectPriorities,
    teams,
  } = useAppSelector(state => state.projectReportsReducer);

  // Count active filters (teams where not all are selected also count)
  const deselectedTeamsCount = useMemo(
    () => teams.filter(t => !t.selected).length,
    [teams]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (deselectedTeamsCount > 0) count++;
    if (selectedProjectStatuses.length > 0) count++;
    if (selectedProjectHealths.length > 0) count++;
    if (selectedProjectCategories.length > 0) count++;
    if (selectedProjectManagers.length > 0) count++;
    if (selectedClients.length > 0) count++;
    if (selectedProjectPriorities.length > 0) count++;
    return count;
  }, [
    deselectedTeamsCount,
    selectedProjectStatuses,
    selectedProjectHealths,
    selectedProjectCategories,
    selectedProjectManagers,
    selectedClients,
    selectedProjectPriorities,
  ]);

  const handleClearAll = useCallback(() => {
    dispatch(resetAllFilters());
    dispatch(fetchProjectDataForCurrentView());
  }, [dispatch]);

  const panelContent = (
    <div style={{ width: 'min(520px, calc(100vw - 32px))', padding: '4px 0' }}>
      {/* Header row */}
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

      {/* All filter chips in a wrapping flex row */}
      <Flex gap={8} wrap="wrap" align="center">
        <ProjectTeamFilterDropdown />
        <ProjectStatusFilterDropdown />
        <ProjectHealthFilterDropdown />
        <ProjectCategoriesFilterDropdown />
        <ProjectManagersFilterDropdown />
        <ProjectClientFilterDropdown />
        <ProjectPriorityFilterDropdown />
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
        style={
          panelOpen || activeFilterCount > 0
            ? { borderColor: token.colorPrimary, color: token.colorPrimary }
            : undefined
        }
        className="transition-colors duration-300"
      >
        {t('filterButton', { defaultValue: 'Filter' })}
        {activeFilterCount > 0 && (
          <Badge
            count={activeFilterCount}
            size="small"
            style={{ marginLeft: 4, backgroundColor: token.colorPrimary }}
          />
        )}
      </Button>
    </Popover>
  );
};

export default memo(ProjectReportsFilterPanel);
