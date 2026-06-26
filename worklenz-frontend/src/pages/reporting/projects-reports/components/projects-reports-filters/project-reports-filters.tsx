import { Flex } from '@/shared/antd-imports';
import { useMemo, useCallback, memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProjectTeamFilterDropdown from './project-team-filter-dropdown';
import ProjectStatusFilterDropdown from './project-status-filter-dropdown';
import ProjectHealthFilterDropdown from './project-health-filter-dropdown';
import ProjectCategoriesFilterDropdown from './project-categories-filter-dropdown';
import ProjectManagersFilterDropdown from './project-managers-filter-dropdown';
import ProjectTableShowFieldsDropdown from './project-table-show-fields-dropdown';
import ProjectViewModeToggle from './project-view-mode-toggle';
import ProjectGroupByDropdown from './project-group-by-dropdown';
import CustomSearchbar from '@/components/CustomSearchbar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSearchQuery } from '@/features/reporting/projectReports/project-reports-slice';

// How long to wait after the user stops typing before firing the API call (ms)
const SEARCH_DEBOUNCE_MS = 500;

const ProjectsReportsFilters = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');

  // Read both searchQuery and viewMode from the shared slice
  const { searchQuery, viewMode } = useAppSelector(state => state.projectReportsReducer);

  // Local state drives what the user SEES in the input box — updates instantly on every keystroke
  // so the input never feels laggy.
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Keep a ref to the previous viewMode so we can detect when the user switches views
  const prevViewModeRef = useRef(viewMode);

  // ── Fix #1: Clear search when the user toggles between Table and Grouped views ──
  // The searchQuery lives in the shared Redux slice, so without this reset it would
  // carry over and silently filter the other view.
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      prevViewModeRef.current = viewMode;
      // Clear both the local input display and the Redux state
      setLocalSearch('');
      dispatch(setSearchQuery(''));
    }
  }, [viewMode, dispatch]);

  // ── Fix #2: Debounce the API-triggering dispatch ──
  // Every time localSearch changes we set a 500 ms timer. If the user keeps typing
  // the previous timer is cancelled (cleanup function), so the API is only called
  // 500 ms after the user stops. This prevents the 30 000 ms timeout error caused
  // by firing a new request on every single keystroke.
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      dispatch(setSearchQuery(localSearch));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(debounceTimer);
  }, [localSearch, dispatch]);

  // Update local state immediately so the input box responds without delay
  const handleSearchQueryChange = useCallback((text: string) => {
    setLocalSearch(text);
  }, []);

  // Memoize the filter dropdowns container to prevent recreation on every render
  const filterDropdowns = useMemo(
    () => (
      <Flex gap={8} wrap={'wrap'}>
        <ProjectTeamFilterDropdown />
        <ProjectStatusFilterDropdown />
        <ProjectHealthFilterDropdown />
        <ProjectCategoriesFilterDropdown />
        <ProjectManagersFilterDropdown />
      </Flex>
    ),
    []
  );

  // Memoize the right side controls to prevent recreation on every render.
  // Note: we pass localSearch (not searchQuery) so the input box always reflects
  // what the user typed, even while the debounce timer is still running.
  const rightControls = useMemo(
    () => (
      <Flex gap={12} align="center">
        <ProjectViewModeToggle />
        <ProjectGroupByDropdown />
        <ProjectTableShowFieldsDropdown />
        <CustomSearchbar
          placeholderText={t('searchByNamePlaceholder')}
          searchQuery={localSearch}
          setSearchQuery={handleSearchQueryChange}
        />
      </Flex>
    ),
    [t, localSearch, handleSearchQueryChange]
  );

  return (
    <Flex gap={8} align="center" justify="space-between">
      {filterDropdowns}
      {rightControls}
    </Flex>
  );
};

export default memo(ProjectsReportsFilters);