import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { ColumnsType } from 'antd/es/table';
import { ColumnFilterItem } from 'antd/es/table/interface';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigateFunction } from 'react-router-dom';
import Avatars from '../avatars/avatars';
import { ActionButtons } from './project-list-table/project-list-actions/project-list-actions';
import { CategoryCell } from './project-list-table/project-list-category/project-list-category';
import { ProgressListProgress } from './project-list-table/project-list-progress/progress-list-progress';
import { ProjectListUpdatedAt } from './project-list-table/project-list-updated-at/project-list-updated';
import { ProjectNameCell } from './project-list-table/project-name/project-name-cell';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ProjectRateCell } from './project-list-table/project-list-favorite/project-rate-cell';

const createFilters = (items: { id: string; name: string }[]) =>
  items.map(item => ({ text: item.name, value: item.id })) as ColumnFilterItem[];

interface ITableColumnsProps {
  navigate: NavigateFunction;
  filteredInfo: any;
}

const TableColumns = ({
  navigate,
  filteredInfo,
}: ITableColumnsProps): ColumnsType<IProjectViewModel> => {
  const { t } = useTranslation('all-project-list');
  const dispatch = useAppDispatch();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);
  const { filteredCategories, filteredStatuses } = useAppSelector(
    state => state.projectsReducer
  );
  const columns = useMemo(
    () => [
      {
        title: '',
        dataIndex: 'favorite',
        key: 'favorite',
        render: (text: string, record: IProjectViewModel) => (
          <ProjectRateCell key={record.id} t={t} record={record} />
        ),
      },
      {
        title: t('name'),
        dataIndex: 'name',
        key: 'name',
        sorter: true,
        showSorterTooltip: false,
        defaultSortOrder: 'ascend',
        render: (text: string, record: IProjectViewModel) => (
          <ProjectNameCell navigate={navigate} key={record.id} t={t} record={record} />
        ),
      },
      {
        title: t('client'),
        dataIndex: 'client_name',
        key: 'client_name',
        sorter: true,
        showSorterTooltip: false,
      },
      {
        title: t('category'),
        dataIndex: 'category',
        key: 'category_id',
        filters: createFilters(
          projectCategories.map(category => ({ id: category.id || '', name: category.name || '' }))
        ),
        filteredValue: filteredInfo.category_id || filteredCategories || [],
        filterMultiple: true,
        render: (text: string, record: IProjectViewModel) => (
          <CategoryCell key={record.id} t={t} record={record} />
        ),
        sorter: true,
      },
      {
        title: t('status'),
        dataIndex: 'status',
        key: 'status_id',
        filters: createFilters(
          projectStatuses.map(status => ({ id: status.id || '', name: status.name || '' }))
        ),
        filteredValue: filteredInfo.status_id || [],
        filterMultiple: true,
        sorter: true,
      },
      {
        title: t('tasksProgress'),
        dataIndex: 'tasksProgress',
        key: 'tasksProgress',
        render: (_: string, record: IProjectViewModel) => <ProgressListProgress record={record} />,
      },
      {
        title: t('updated_at'),
        dataIndex: 'updated_at',
        key: 'updated_at',
        sorter: true,
        showSorterTooltip: false,
        render: (_: string, record: IProjectViewModel) => <ProjectListUpdatedAt record={record} />,
      },
      {
        title: t('members'),
        dataIndex: 'names',
        key: 'members',
        render: (members: InlineMember[]) => <Avatars members={members} />,
      },
      {
        title: '',
        key: 'button',
        dataIndex: '',
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
    [t, projectCategories, projectStatuses, filteredInfo, filteredCategories, filteredStatuses]
  );
  return columns as ColumnsType<IProjectViewModel>;
};

export default TableColumns;
