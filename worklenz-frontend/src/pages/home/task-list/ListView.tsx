import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import PillToggle from '../PillToggle';
import { selectHomeTabs } from '@/features/home-page/homePreferences.slice';
import {
  getHomeTabDefinition,
  getVisibleTabs,
  type HomePriorityTab,
} from '../home-layout/homeTabs';

interface ListViewProps {
  refetch: () => void;
}

const ListView = ({ refetch }: ListViewProps) => {
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();

  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const tabs = useAppSelector(selectHomeTabs);

  // Only the tabs the user has left switched on, in their chosen order (see the Customize dialog).
  const tabOptions: { value: HomePriorityTab; label: string }[] = getVisibleTabs(tabs).map(id => {
    const { labelKey, labelDefault } = getHomeTabDefinition(id);
    return { value: id, label: t(labelKey, { defaultValue: labelDefault }) };
  });

  return (
    <PillToggle<HomePriorityTab>
      value={(homeTasksConfig.current_tab as HomePriorityTab) || 'All'}
      options={tabOptions}
      ariaLabel={t('tasks.tabsLabel', { defaultValue: 'Filter tasks' })}
      style={{ maxWidth: '100%', overflowX: 'auto' }}
      onChange={key => {
        dispatch(setHomeTasksConfig({ ...homeTasksConfig, current_tab: key }));
        refetch();
      }}
    />
  );
};

export default ListView;
