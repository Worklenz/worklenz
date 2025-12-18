import { Segmented } from '@/shared/antd-imports';
import { TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setViewMode,
  ProjectReportsViewMode,
} from '@/features/reporting/projectReports/project-reports-slice';

const ProjectViewModeToggle = () => {
  const { t } = useTranslation('reporting-projects-filters');
  const dispatch = useAppDispatch();
  const { viewMode } = useAppSelector(state => state.projectReportsReducer);

  const handleViewModeChange = useCallback(
    (value: string | number) => {
      dispatch(setViewMode(value as ProjectReportsViewMode));
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
