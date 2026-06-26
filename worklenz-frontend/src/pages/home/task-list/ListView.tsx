import { Tabs } from '@/shared/antd-imports';
import AddTaskInlineForm from './AddTaskInlineForm';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { IHomeTasksModel } from '@/types/home/home-page.types';
import { useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';

interface ListViewProps {
  model: IHomeTasksModel;
  refetch: () => void;
}

const ListView = ({ model, refetch }: ListViewProps) => {
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();

  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);

  const tabItems = [
    {
      key: 'All',
      label: `${t('tasks.all')} (${model.total})`,
      children: <AddTaskInlineForm t={t} calendarView={false} />,
    },
    {
      key: 'Today',
      label: `${t('tasks.today')} (${model.today})`,
    },
    {
      key: 'Upcoming',
      label: `${t('tasks.upcoming')} (${model.upcoming})`,
    },
    {
      key: 'Overdue',
      label: `${t('tasks.overdue')} (${model.overdue})`,
    },
    {
      key: 'NoDueDate',
      label: `${t('tasks.noDueDate')} (${model.no_due_date})`,
    },
  ];

  return (
    <Tabs
      type="card"
      activeKey={homeTasksConfig.current_tab || 'All'}
      items={tabItems}
      onChange={key => dispatch(setHomeTasksConfig({ ...homeTasksConfig, current_tab: key }))}
    />
  );
};

export default ListView;
