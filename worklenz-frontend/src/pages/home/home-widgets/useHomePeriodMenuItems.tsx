import { useMemo } from 'react';
import { CalendarOutlined, CheckOutlined, type MenuProps } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setHomeSelections, type HomePeriod } from '@/features/home-page/homePreferences.slice';

/**
 * The "Today" / "This week" entries of a widget's "..." menu, for the widgets that show a period
 * (the stat cards, My progress and the Priorities table). The choice is the page's one period, so
 * the three always agree; it is saved straight away like moving or removing a widget.
 */
export const useHomePeriodMenuItems = (): NonNullable<MenuProps['items']> => {
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();
  const period = useAppSelector(state => state.homePreferencesReducer.selections.period);

  return useMemo(() => {
    const periodItem = (value: HomePeriod, label: string) => {
      const isSelected = period === value;
      return {
        key: `period-${value}`,
        // The tick marks the current period; the empty slot keeps the two labels aligned.
        icon: isSelected ? <CheckOutlined aria-hidden /> : <CalendarOutlined aria-hidden style={{ visibility: 'hidden' }} />,
        label,
        onClick: () => dispatch(setHomeSelections({ period: value })),
      };
    };

    return [
      {
        type: 'group' as const,
        label: t('widgets.menu.showPeriod', { defaultValue: 'Show' }),
        children: [
          periodItem('today', t('greeting.today', { defaultValue: 'Today' })),
          periodItem('week', t('greeting.thisWeek', { defaultValue: 'This Week' })),
        ],
      },
    ];
  }, [period, dispatch, t]);
};
