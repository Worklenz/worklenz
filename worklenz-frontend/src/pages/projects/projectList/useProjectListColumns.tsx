import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigateFunction } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

import { ActionButtons } from '@/components/project-list/project-list-table/project-list-actions/project-list-actions';
import { CategoryCell } from '@/components/project-list/project-list-table/project-list-category/project-list-category';
import { ProjectRateCell } from '@/components/project-list/project-list-table/project-list-favorite/project-rate-cell';
import { ProgressListProgress } from '@/components/project-list/project-list-table/project-list-progress/progress-list-progress';
import { ProjectListUpdatedAt } from '@/components/project-list/project-list-table/project-list-updated-at/project-list-updated';
import { ProjectNameCell } from '@/components/project-list/project-list-table/project-name/project-name-cell';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ProjectListField, ProjectListFieldKey } from '@/types/project-list-field.types';
import { simpleDateFormat } from '@/utils/simpleDateFormat';

import { ProjectPriorityCell } from './ProjectPriorityCell';
import {
  ALWAYS_VISIBLE_COLUMN_KEYS,
  ColumnFilterOptions,
  ColumnFilterValues,
  DEFAULT_PROJECT_SORT_ORDER,
} from './project-list.constants';

interface UseProjectListColumnsArgs {
  filterOptions: ColumnFilterOptions;
  filterValues: ColumnFilterValues;
  fields: ProjectListField[];
  navigate: NavigateFunction;
  isOwnerOrAdmin: boolean;
}

/**
 * Builds the project table's columns.
 *
 * Split into two memos on purpose: the (expensive) column definitions are only
 * rebuilt when something they actually render changes, while toggling column
 * visibility just re-filters the existing array.
 */
export const useProjectListColumns = ({
  filterOptions,
  filterValues,
  fields,
  navigate,
  isOwnerOrAdmin,
}: UseProjectListColumnsArgs): ColumnsType<IProjectViewModel> => {
  const { t } = useTranslation('all-project-list');
  const dispatch = useAppDispatch();
  // Subscribed once per table rather than once per priority cell.
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');

  const allColumns = useMemo<ColumnsType<IProjectViewModel>>(
    () => [
      {
        title: '',
        dataIndex: 'favorite',
        key: ProjectListFieldKey.FAVORITE,
        width: 56,
        align: 'center',
        render: (_: string, record: IProjectViewModel) => <ProjectRateCell t={t} record={record} />,
      },
      {
        title: t('name'),
        dataIndex: 'name',
        key: ProjectListFieldKey.NAME,
        width: 280,
        sorter: true,
        defaultSortOrder: DEFAULT_PROJECT_SORT_ORDER,
        render: (_: string, record: IProjectViewModel) => (
          <ProjectNameCell navigate={navigate} t={t} record={record} />
        ),
      },
      {
        title: t('client'),
        dataIndex: 'client_name',
        key: ProjectListFieldKey.CLIENT,
        filters: filterOptions[ProjectListFieldKey.CLIENT],
        filteredValue: filterValues[ProjectListFieldKey.CLIENT],
        filterMultiple: true,
        // Teams accumulate far more clients than statuses or categories.
        filterSearch: true,
        sorter: true,
      },
      {
        title: t('priority', { defaultValue: 'Priority' }),
        dataIndex: 'priority_name',
        key: ProjectListFieldKey.PRIORITY,
        filters: filterOptions[ProjectListFieldKey.PRIORITY],
        filteredValue: filterValues[ProjectListFieldKey.PRIORITY],
        filterMultiple: true,
        sorter: true,
        render: (_: string, record: IProjectViewModel) => (
          <ProjectPriorityCell record={record} isDarkMode={isDarkMode} />
        ),
      },
      {
        title: t('status'),
        dataIndex: 'status',
        key: ProjectListFieldKey.STATUS,
        filters: filterOptions[ProjectListFieldKey.STATUS],
        filteredValue: filterValues[ProjectListFieldKey.STATUS],
        filterMultiple: true,
        sorter: true,
      },
      {
        title: t('tasksProgress'),
        dataIndex: 'tasksProgress',
        key: ProjectListFieldKey.TASKS_PROGRESS,
        render: (_: string, record: IProjectViewModel) => <ProgressListProgress record={record} />,
      },
      {
        title: t('category'),
        dataIndex: 'category_name',
        key: ProjectListFieldKey.CATEGORY,
        filters: filterOptions[ProjectListFieldKey.CATEGORY],
        filteredValue: filterValues[ProjectListFieldKey.CATEGORY],
        filterMultiple: true,
        sorter: true,
        render: (_: string, record: IProjectViewModel) => <CategoryCell t={t} record={record} />,
      },
      {
        title: t('updated_at', { defaultValue: 'Last Updated' }),
        dataIndex: 'updated_at',
        key: ProjectListFieldKey.UPDATED_AT,
        sorter: true,
        render: (_: string, record: IProjectViewModel) => <ProjectListUpdatedAt record={record} />,
      },
      {
        title: t('endDate', { defaultValue: 'Project End Date' }),
        dataIndex: 'end_date',
        key: ProjectListFieldKey.END_DATE,
        sorter: true,
        render: (_: string, record: IProjectViewModel) => (
          <span>{record.end_date ? simpleDateFormat(record.end_date) : '-'}</span>
        ),
      },
      {
        title: '',
        key: 'actions',
        dataIndex: '',
        width: 76,
        align: 'center',
        render: (record: IProjectViewModel) => (
          <ActionButtons
            t={t}
            record={record}
            dispatch={dispatch}
            isOwnerOrAdmin={isOwnerOrAdmin}
          />
        ),
      },
    ],
    [t, filterOptions, filterValues, isDarkMode, navigate, dispatch, isOwnerOrAdmin]
  );

  return useMemo(() => {
    // Map lookup instead of a `.find` per column — and an unknown key stays
    // visible, matching how the field slice treats columns it hasn't seen yet.
    const visibilityByKey = new Map(fields.map(field => [field.key, field.visible]));
    return allColumns.filter(column => {
      const key = column.key as string;
      return ALWAYS_VISIBLE_COLUMN_KEYS.has(key) || (visibilityByKey.get(key) ?? true);
    });
  }, [allColumns, fields]);
};
