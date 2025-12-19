import { Segmented } from '@/shared/antd-imports';
import { TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setViewMode,
  setIndex,
  setPageSize,
  ProjectReportsViewMode,
  fetchProjectData,
} from '@/features/reporting/projectReports/project-reports-slice';

// For grouped view, use a larger initial page size to show more groups upfront
const GROUPED_VIEW_INITIAL_SIZE = 100;

const ProjectViewModeToggle = () => {
  const { t } = useTranslation('reporting-projects-filters');
  const dispatch = useAppDispatch();
  const { viewMode } = useAppSelector(state => state.projectReportsReducer);

  const handleViewModeChange = useCallback(
    (value: string | number) => {
      const mode = value as ProjectReportsViewMode;
      dispatch(setViewMode(mode));

      if (mode === 'grouped') {
        // For grouped view, load initial batch with larger page size
        dispatch(setIndex(1));
        dispatch(setPageSize(GROUPED_VIEW_INITIAL_SIZE));
        dispatch(fetchProjectData());
      } else {
        // For table view, reset to normal pagination
        dispatch(setIndex(1));
        dispatch(setPageSize(10));
        dispatch(fetchProjectData());
      }
    },
    [dispatch]
  );

  const options = [
    {
      value: 'table',
      icon: <TableOutlined />,
      label: t('tableViewText'),
    },
    {
      value: 'grouped',
      icon: <AppstoreOutlined />,
      label: t('groupedViewText'),
    },
  ];

  return (
    <Segmented
      value={viewMode}
      onChange={handleViewModeChange}
      options={options}
    />
  );
};

export default memo(ProjectViewModeToggle);
