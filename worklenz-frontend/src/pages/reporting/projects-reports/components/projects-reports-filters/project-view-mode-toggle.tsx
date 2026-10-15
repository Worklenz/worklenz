import { useCallback, memo, useMemo } from 'react';
import { TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import PillToggle from '@/pages/home/PillToggle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setViewMode,
  setIndex,
  setPageSize,
  ProjectReportsViewMode,
  fetchProjectData,
} from '@/features/reporting/projectReports/project-reports-slice';

const ProjectViewModeToggle = () => {
  const { t } = useTranslation('reporting-projects-filters');
  const dispatch = useAppDispatch();
  const { viewMode } = useAppSelector(state => state.projectReportsReducer);

  const handleViewModeChange = useCallback(
    (mode: ProjectReportsViewMode) => {
      if (mode === viewMode) return;
      dispatch(setViewMode(mode));

      if (mode !== 'grouped') {
        // For table view, reset to normal pagination and fetch
        dispatch(setIndex(1));
        dispatch(setPageSize(10));
        dispatch(fetchProjectData());
      }
      // For grouped: setViewMode sets isLoading = true;
      // ProjectsGroupedView's useEffect dispatches fetchGroupedProjects() on mount
    },
    [dispatch, viewMode]
  );

  const options = useMemo(
    () => [
      {
        value: 'table' as ProjectReportsViewMode,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <TableOutlined />
            {t('tableViewText', { defaultValue: 'Table' })}
          </span>
        ),
      },
      {
        value: 'grouped' as ProjectReportsViewMode,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <AppstoreOutlined />
            {t('groupedViewText', { defaultValue: 'Grouped' })}
          </span>
        ),
      },
    ],
    [t]
  );

  return (
    <PillToggle<ProjectReportsViewMode>
      value={viewMode}
      options={options}
      onChange={handleViewModeChange}
      style={{ height: 32 }}
      ariaLabel={t('viewModeLabel', { defaultValue: 'View mode' })}
    />
  );
};

export default memo(ProjectViewModeToggle);
