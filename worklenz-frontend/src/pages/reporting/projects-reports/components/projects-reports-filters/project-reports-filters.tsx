import { Flex } from '@/shared/antd-imports';
import { useMemo, useCallback, memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProjectViewModeToggle from './project-view-mode-toggle';
import ProjectGroupByDropdown from './project-group-by-dropdown';
import ProjectTableShowFieldsDropdown from './project-table-show-fields-dropdown';
import ProjectReportsFilterPanel from './project-reports-filter-panel';
import CustomSearchbar from '@/components/CustomSearchbar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSearchQuery } from '@/features/reporting/projectReports/project-reports-slice';

// How long to wait after the user stops typing before firing the API call (ms)
const SEARCH_DEBOUNCE_MS = 500;

const ProjectsReportsFilters = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');

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

  const handleSearchQueryChange = useCallback((text: string) => {
    setLocalSearch(text);
  }, []);

  // All controls live on the right:
  //   Table | Grouped  →  Filter  →  Group By  →  Show Fields  →  Search
  const controls = useMemo(
    () => (
      <Flex
        gap={8}
        align="center"
        wrap="nowrap"
        style={{ marginLeft: 'auto' }}
      >
        <ProjectViewModeToggle />
        <ProjectReportsFilterPanel />
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
    <Flex align="center" justify="space-between" style={{ width: '100%' }}>
      {controls}
    </Flex>
  );
};

export default memo(ProjectsReportsFilters);
