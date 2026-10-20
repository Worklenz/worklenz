import React from 'react';
import { Flex, Radio, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  type HomeSort,
  type HomeSortField,
  type HomeSortOrder,
} from '@/features/home-page/homePreferences.slice';

interface CustomizeSortPanelProps {
  sort: HomeSort | null;
  onChange: (sort: HomeSort | null) => void;
}

const DEFAULT_SORT_VALUE = 'default';

// Due date leads because it is also the default order; the rest follow the table's column order.
const SORT_FIELD_ORDER: HomeSortField[] = ['end_date', 'priority', 'status', 'name', 'project_name'];

const SORT_FIELD_LABELS: Record<HomeSortField, { key: string; defaultValue: string }> = {
  name: { key: 'tasks.name', defaultValue: 'Task Name' },
  project_name: { key: 'tasks.project', defaultValue: 'Project' },
  end_date: { key: 'tasks.dueDate', defaultValue: 'Due Date' },
  priority: { key: 'tasks.priority', defaultValue: 'Priority' },
  status: { key: 'tasks.status', defaultValue: 'Status' },
};

export const CustomizeSortPanel: React.FC<CustomizeSortPanelProps> = ({ sort, onChange }) => {
  const { t } = useTranslation('home');

  const handleFieldChange = (value: string) => {
    if (value === DEFAULT_SORT_VALUE) {
      onChange(null);
      return;
    }
    onChange({ field: value as HomeSortField, order: sort?.order ?? 'asc' });
  };

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t('customize.sortDescription', {
          defaultValue: 'Choose how tasks are ordered in the table. Pinned tasks always stay on top.',
        })}
      </Typography.Paragraph>

      <div>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
          {t('customize.sortField', { defaultValue: 'Sort by' })}
        </Typography.Text>
        <Radio.Group
          value={sort?.field ?? DEFAULT_SORT_VALUE}
          onChange={event => handleFieldChange(event.target.value)}
          aria-label={t('customize.sortField', { defaultValue: 'Sort by' })}
        >
          <Flex vertical gap={8}>
            <Radio value={DEFAULT_SORT_VALUE}>
              {t('customize.sortDefault', { defaultValue: 'Default order (due date, soonest first)' })}
            </Radio>
            {SORT_FIELD_ORDER.map(field => (
              <Radio key={field} value={field}>
                {t(SORT_FIELD_LABELS[field].key, { defaultValue: SORT_FIELD_LABELS[field].defaultValue })}
              </Radio>
            ))}
          </Flex>
        </Radio.Group>
      </div>

      <div>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
          {t('customize.sortOrder', { defaultValue: 'Direction' })}
        </Typography.Text>
        <Radio.Group
          value={sort?.order ?? 'asc'}
          disabled={!sort}
          onChange={event =>
            sort && onChange({ field: sort.field, order: event.target.value as HomeSortOrder })
          }
          aria-label={t('customize.sortOrder', { defaultValue: 'Direction' })}
        >
          <Radio value="asc">{t('customize.sortAsc', { defaultValue: 'Ascending' })}</Radio>
          <Radio value="desc">{t('customize.sortDesc', { defaultValue: 'Descending' })}</Radio>
        </Radio.Group>
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('customize.sortPinnedNote', {
          defaultValue: 'The Pinned tab always lists the most recently pinned task first.',
        })}
      </Typography.Text>
    </Flex>
  );
};
