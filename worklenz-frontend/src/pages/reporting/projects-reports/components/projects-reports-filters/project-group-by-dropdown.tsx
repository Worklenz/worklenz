import { Select } from '@/shared/antd-imports';
import { useCallback, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setGroupBy,
  ProjectReportsGroupBy,
} from '@/features/reporting/projectReports/project-reports-slice';

const ProjectGroupByDropdown = () => {
  const { t } = useTranslation('reporting-projects-filters');
  const dispatch = useAppDispatch();
  const { groupBy, viewMode } = useAppSelector(state => state.projectReportsReducer);

  const handleGroupByChange = useCallback(
    (value: ProjectReportsGroupBy) => {
      dispatch(setGroupBy(value));
    },
    [dispatch]
  );

  const options = useMemo(
    () => [
      { value: 'category', label: t('groupByCategoryText') },
      { value: 'status', label: t('groupByStatusText') },
      { value: 'health', label: t('groupByHealthText') },
      { value: 'team', label: t('groupByTeamText') },
      { value: 'manager', label: t('groupByManagerText') },
    ],
    [t]
  );

  if (viewMode !== 'grouped') {
    return null;
  }

  return (
    <Select
      value={groupBy}
      onChange={handleGroupByChange}
      options={options}
      style={{ width: 150 }}
      popupMatchSelectWidth={false}
    />
  );
};

export default memo(ProjectGroupByDropdown);
