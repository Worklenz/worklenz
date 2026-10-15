import { Button, Dropdown, Flex, Input } from '@/shared/antd-imports';
import { DownOutlined, SearchOutlined } from '@/shared/antd-imports';
import { useCallback, useMemo, memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProjectViewModeToggle from './project-view-mode-toggle';
import ProjectGroupByDropdown from './project-group-by-dropdown';
import ProjectTableShowFieldsDropdown from './project-table-show-fields-dropdown';
import ProjectReportsFilterPanel from './project-reports-filter-panel';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import {
  buildProjectsExportParams,
  setSearchQuery,
} from '@/features/reporting/projectReports/project-reports-slice';

// How long to wait after the user stops typing before firing the API call (ms)
const SEARCH_DEBOUNCE_MS = 500;

const ProjectsReportsFilters = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const { t: tProjects } = useTranslation('reporting-projects');
  const currentSession = useAuthService().getCurrentSession();

  const projectReports = useAppSelector(state => state.projectReportsReducer);
  const columnsVisibility = useAppSelector(state => state.projectReportsTableColumnsReducer);

  const exportMenuItems = useMemo(
    () => [
      {
        // Everything, regardless of the filters currently applied
        key: 'detailed',
        label: tProjects('detailedReport', { defaultValue: 'Detailed Report' }),
        onClick: () =>
          reportingExportApiService.exportProjects(currentSession?.team_name || 'Team'),
      },
      {
        // Table view: the table as shown. Grouped view: the grouped report.
        key: 'filtered',
        label: tProjects('filteredReport', {
          defaultValue: 'Filtered Report',
        }),
        onClick: () =>
          reportingExportApiService.exportProjectsFiltered({
            ...buildProjectsExportParams(projectReports),
            columns: Object.keys(columnsVisibility)
              .filter(key => columnsVisibility[key])
              .join(','),
            team_name: currentSession?.team_name || 'Team',
          }),
      },
    ],
    [tProjects, currentSession?.team_name, projectReports, columnsVisibility]
  );

  const { searchQuery, viewMode } = useAppSelector(state => state.projectReportsReducer);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const prevViewModeRef = useRef(viewMode);

  // Clear search when view mode switches
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      prevViewModeRef.current = viewMode;
      setLocalSearch('');
      dispatch(setSearchQuery(''));
    }
  }, [viewMode, dispatch]);

  // Debounce the Redux dispatch so the API only fires 500 ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(setSearchQuery(localSearch));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localSearch, dispatch]);

  const handleSearchQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(event.target.value);
  }, []);

  // Right-aligned toolbar:  view toggle → group by → search → Filter → Export → show/hide columns
  return (
    <Flex gap={8} wrap="wrap" align="center" justify="space-between">
      <Flex gap={8} wrap="wrap" align="center">
        <ProjectViewModeToggle />
        <ProjectGroupByDropdown />
      </Flex>
      <Flex gap={8} wrap="wrap" align="center" justify="end">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={localSearch}
          onChange={handleSearchQueryChange}
          placeholder={t('searchByNamePlaceholder', { defaultValue: 'Search by project name' })}
          aria-label={t('searchLabel', { defaultValue: 'Search projects' })}
          className="w-[320px] max-w-full"
        />
        <Flex gap={8} align="center">
          <ProjectReportsFilterPanel />
          <Dropdown menu={{ items: exportMenuItems }}>
            <Button icon={<DownOutlined />} iconPosition="end">
              {tProjects('exportButton')}
            </Button>
          </Dropdown>
          <ProjectTableShowFieldsDropdown />
        </Flex>
      </Flex>
    </Flex>
  );
};

export default memo(ProjectsReportsFilters);
