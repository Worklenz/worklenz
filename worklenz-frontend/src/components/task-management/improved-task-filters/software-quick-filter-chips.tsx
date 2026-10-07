import { useTranslation } from 'react-i18next';
import { Button, Flex, theme } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  SoftwareQuickFilter,
  toggleSoftwareQuickFilter,
} from '@/features/projects/singleProject/quick-filters/software-quick-filters.slice';

interface SoftwareQuickFilterChipsProps {
  /** Called after a chip is toggled so the current view can refetch. */
  onChange: () => void;
}

/** Mockup-style "My work / Bugs / Blocked" toggles for software projects. */
export const SoftwareQuickFilterChips = ({ onChange }: SoftwareQuickFilterChipsProps) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const activeFilters = useAppSelector(state => state.softwareQuickFiltersReducer.active);

  const handleToggle = (filter: SoftwareQuickFilter) => {
    dispatch(toggleSoftwareQuickFilter(filter));
    onChange();
  };

  return (
    <Flex gap={6} wrap="wrap" role="group" aria-label={t('quickFilters', { defaultValue: 'Quick filters' })}>
      {QUICK_FILTERS.map(({ key, labelKey, defaultLabel }) => {
        const isActive = activeFilters.includes(key);
        return (
          <Button
            key={key}
            size="small"
            color={isActive ? 'primary' : 'default'}
            variant="outlined"
            aria-pressed={isActive}
            onClick={() => handleToggle(key)}
            style={{ height: 30, background: isActive ? token.colorPrimaryBg : undefined }}
          >
            {t(labelKey, { defaultValue: defaultLabel })}
          </Button>
        );
      })}
    </Flex>
  );
};

const QUICK_FILTERS: { key: SoftwareQuickFilter; labelKey: string; defaultLabel: string }[] = [
  { key: 'mine', labelKey: 'quickFilterMyWork', defaultLabel: 'My work' },
  { key: 'bugs', labelKey: 'quickFilterBugs', defaultLabel: 'Bugs' },
  { key: 'blocked', labelKey: 'quickFilterBlocked', defaultLabel: 'Blocked' },
];
