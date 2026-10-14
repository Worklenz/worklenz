import React, { useMemo } from 'react';
import { CheckOutlined, type MenuProps } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setHomeContinueTabs } from '@/features/home-page/homePreferences.slice';
import {
  getVisibleContinueTabs,
  HOME_CONTINUE_TABS,
  setContinueTabHidden,
  type HomeContinueTab,
} from '../home-layout/homeContinueTabs';
import { HomeWidgetMenuButton } from '../home-widgets/HomeWidgetMenuButton';

// Every item is a toggle, and a run of toggles is what the menu is for: it stays open while they are
// switched, and closes the way any menu does when clicked away from.
const KEEP_OPEN_KEYS: ReadonlySet<string> = new Set(HOME_CONTINUE_TABS);

/** The "..." menu of the Continue widget: which of its Projects / Tasks / Activity / Time Logged toggles show. */
export const ContinueTabsMenu: React.FC = () => {
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();
  const config = useAppSelector(state => state.homePreferencesReducer.continueTabs);

  const items = useMemo<MenuProps['items']>(() => {
    const labels: Record<HomeContinueTab, string> = {
      projects: t('continueCardTabs.projects', { defaultValue: 'Projects' }),
      tasks: t('continueCardTabs.tasks', { defaultValue: 'Tasks' }),
      activity: t('continueCardTabs.activity', { defaultValue: 'Activity' }),
      time: t('continueCardTabs.timeLogged', { defaultValue: 'Time Logged' }),
    };
    const isLastVisible = getVisibleContinueTabs(config).length === 1;

    return [
      {
        type: 'group' as const,
        label: t('continueCardTabs.showTabs', { defaultValue: 'Show tabs' }),
        children: HOME_CONTINUE_TABS.map(id => {
          const isShown = !config.hidden.includes(id);
          return {
            key: id,
            // A check where it is shown, and the same width of nothing where it is not, so labels line up.
            icon: isShown ? <CheckOutlined aria-hidden /> : <span aria-hidden style={{ display: 'inline-block', width: 14 }} />,
            label: labels[id],
            // At least one has to stay: the last one shown can't be switched off.
            disabled: isShown && isLastVisible,
            title: isShown && isLastVisible ? t('customize.cannotHideLastTab', { defaultValue: 'At least one tab must stay visible.' }) : undefined,
            role: 'menuitemcheckbox',
            'aria-checked': isShown,
            onClick: () => dispatch(setHomeContinueTabs(setContinueTabHidden(config, id, isShown))),
          };
        }),
      },
    ] as MenuProps['items'];
  }, [config, dispatch, t]);

  return <HomeWidgetMenuButton extraItems={items} keepOpenKeys={KEEP_OPEN_KEYS} />;
};
