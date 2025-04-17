import { Flex } from 'antd';
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

  return (
    <Flex gap={8} align="center" justify="space-between">
      <Flex gap={8} wrap={'wrap'}>
        <ProjectStatusFilterDropdown />
        <ProjectHealthFilterDropdown />
        <ProjectCategoriesFilterDropdown />
        <ProjectManagersFilterDropdown />
      </Flex>

      <Flex gap={12}>
        <ProjectTableShowFieldsDropdown />

        <CustomSearchbar
          placeholderText={t('searchByNamePlaceholder')}
          searchQuery={searchQuery}
          setSearchQuery={text => dispatch(setSearchQuery(text))}
        />
      </Flex>
    </Flex>
  );
};

export default ProjectsReportsFilters;
