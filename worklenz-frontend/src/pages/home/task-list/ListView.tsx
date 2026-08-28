import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import PillToggle from '../PillToggle';

type HomeTaskTab = 'All' | 'Today' | 'Overdue' | 'Upcoming' | 'NoDueDate';

interface ListViewProps {
  refetch: () => void;
}

const ListView = ({ refetch }: ListViewProps) => {
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();

  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);

  const tabOptions: { value: HomeTaskTab; label: string }[] = [
    { value: 'All', label: t('projects.recent', { defaultValue: 'Recent' }) },
    { value: 'Today', label: t('homeCalendar.todayButton', { defaultValue: 'Today' }) },
    { value: 'Overdue', label: t('tasks.overdue', { defaultValue: 'Overdue' }) },
    { value: 'Upcoming', label: t('tasks.upcoming', { defaultValue: 'Upcoming' }) },
    { value: 'NoDueDate', label: t('tasks.noDueDate', { defaultValue: 'No Due Date' }) },
  ];

  return (
    <PillToggle<HomeTaskTab>
      value={(homeTasksConfig.current_tab as HomeTaskTab) || 'All'}
      options={tabOptions}
      onChange={key => {
        dispatch(setHomeTasksConfig({ ...homeTasksConfig, current_tab: key }));
        refetch();
      }}
    />
  );
};

export default ListView;
