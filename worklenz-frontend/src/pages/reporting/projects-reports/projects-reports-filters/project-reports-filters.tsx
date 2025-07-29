import { Flex } from '@/shared/antd-imports';
import { useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import ProjectStatusFilterDropdown from './project-status-filter-dropdown';
import ProjectHealthFilterDropdown from './project-health-filter-dropdown';
import ProjectCategoriesFilterDropdown from './project-categories-filter-dropdown';
import ProjectManagersFilterDropdown from './project-managers-filter-dropdown';
import ProjectTableShowFieldsDropdown from './project-table-show-fields-dropdown';
import CustomSearchbar from '@/components/CustomSearchbar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSearchQuery } from '@/features/reporting/projectReports/project-reports-slice';

const ProjectsReportsFilters = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const { searchQuery } = useAppSelector(state => state.projectReportsReducer);

  // Memoize the search query handler to prevent recreation on every render
  const handleSearchQueryChange = useCallback(
    (text: string) => {
      dispatch(setSearchQuery(text));
    },
    [dispatch]
  );

  // Memoize the filter dropdowns container to prevent recreation on every render
  const filterDropdowns = useMemo(
    () => (
      <Flex gap={8} wrap={'wrap'}>
        <ProjectStatusFilterDropdown />
        <ProjectHealthFilterDropdown />
        <ProjectCategoriesFilterDropdown />
        <ProjectManagersFilterDropdown />
      </Flex>
    ),
    []
  );

  // Memoize the right side controls to prevent recreation on every render
  const rightControls = useMemo(
    () => (
      <Flex gap={12}>
        <ProjectTableShowFieldsDropdown />
        <CustomSearchbar
          placeholderText={t('searchByNamePlaceholder')}
          searchQuery={searchQuery}
          setSearchQuery={handleSearchQueryChange}
        />
      </Flex>
    ),
    [t, searchQuery, handleSearchQueryChange]
  );

  return (
    <Flex gap={8} align="center" justify="space-between">
      {filterDropdowns}
      {rightControls}
    </Flex>
  );
};

export default memo(ProjectsReportsFilters);
