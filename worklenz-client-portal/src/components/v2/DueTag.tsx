import { Tag } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { daysFromToday } from '@/utils/dates';

/** "Due in 3 days" / "Due tomorrow" / "2 days overdue", coloured by urgency. */
export const DueTag = ({ date }: { date: string }) => {
  const { t } = useTranslation();
  const days = daysFromToday(date);
  const color = days < 0 ? 'red' : days <= 3 ? 'orange' : 'default';
  const label =
    days < 0
      ? t('due.overdue', { count: -days, defaultValue_one: '{{count}} day overdue', defaultValue_other: '{{count}} days overdue' })
      : days === 0
        ? t('due.today', { defaultValue: 'Due today' })
        : days === 1
          ? t('due.tomorrow', { defaultValue: 'Due tomorrow' })
          : t('due.inDays', { count: days, defaultValue: 'Due in {{count}} days' });
  return <Tag color={color}>{label}</Tag>;
};
