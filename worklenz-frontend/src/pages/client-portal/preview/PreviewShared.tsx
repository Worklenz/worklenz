import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Checkbox, Flex, Input, Popover, Statistic, Tag, Typography, theme } from '@/shared/antd-imports';
import { EyeOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';

/** Width of an element, kept current as the preview frame is resized. */
export const useContainerWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
};

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}

/** Same title block as every page of the client portal. */
export const PageHeader = ({ title, subtitle, extra }: PageHeaderProps) => (
  <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12} style={{ marginBottom: 20 }}>
    <div style={{ minWidth: 0 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      {subtitle && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
          {subtitle}
        </Typography.Text>
      )}
    </div>
    {extra && <div>{extra}</div>}
  </Flex>
);

interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'warning' | 'success' | 'error';
}

/** A summary number: the dashboard tiles and the change request list. */
export const StatTile = ({ label, value, sub, tone }: StatTileProps) => {
  const { token } = theme.useToken();
  const color =
    tone === 'warning' ? token.colorWarning : tone === 'success' ? token.colorSuccess : tone === 'error' ? token.colorError : undefined;
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Statistic title={label} value={value as string | number} valueStyle={{ color, fontSize: 26 }} />
      {sub && (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {sub}
        </Typography.Text>
      )}
    </Card>
  );
};

interface ActionRowProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}

/** A row inside a card: needs-action, milestones, activity. */
export const ActionRow = ({ icon, title, subtitle, right }: ActionRowProps) => {
  const { token } = theme.useToken();
  return (
    <Flex
      align="center"
      wrap="wrap"
      gap={12}
      style={{ padding: '10px 4px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
    >
      {icon && (
        <span aria-hidden style={{ color: token.colorTextSecondary, display: 'flex' }}>
          {icon}
        </span>
      )}
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <Typography.Text strong style={{ display: 'block' }}>
          {title}
        </Typography.Text>
        {subtitle && (
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {right && (
        <Flex gap={8} align="center">
          {right}
        </Flex>
      )}
    </Flex>
  );
};

const DAY_MS = 24 * 60 * 60 * 1000;

const daysFromToday = (value: string): number => {
  const target = new Date(value);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
};

/** "Due in 3 days" / "Due tomorrow" / "2 days overdue", coloured by urgency. */
export const DueTag = ({ date }: { date: string }) => {
  const { t } = useTranslation('client-portal-v2-preview');
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

export interface PreviewFilterGroup {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
}

export interface PreviewField {
  key: string;
  label: string;
}

interface PreviewSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  leading?: ReactNode;
  filterGroups?: PreviewFilterGroup[];
  fields?: PreviewField[];
  hiddenFields?: string[];
  onToggleField?: (key: string) => void;
}

/** Which table columns the eye menu has turned off. Columns without a key in `fields` always show. */
export const useHiddenColumns = (defaultHidden: string[] = []) => {
  const [hidden, setHidden] = useState<string[]>(defaultHidden);
  const toggle = (key: string) =>
    setHidden(current => (current.includes(key) ? current.filter(item => item !== key) : [...current, key]));
  const visible = <C extends { key?: unknown }>(columns: C[]): C[] => columns.filter(column => !hidden.includes(String(column.key)));
  return { hidden, toggle, visible };
};

/** Search, Filter and the eye "Fields" button, right-aligned, as on every portal table. */
export const PreviewToolbar = ({
  value,
  onChange,
  placeholder,
  leading,
  filterGroups = [],
  fields = [],
  hiddenFields = [],
  onToggleField,
}: PreviewSearchProps) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const activeFilters = filterGroups.reduce((sum, group) => sum + group.value.length, 0);

  const filterPanel = (
    <Flex vertical gap={12} style={{ minWidth: 220, maxHeight: 320, overflowY: 'auto' }}>
      {filterGroups.map(group => (
        <div key={group.key}>
          <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>
            {group.label}
          </Typography.Text>
          <Checkbox.Group
            value={group.value}
            onChange={next => group.onChange(next as string[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}
            options={group.options}
          />
        </div>
      ))}
      <Button size="small" disabled={activeFilters === 0} onClick={() => filterGroups.forEach(group => group.onChange([]))}>
        {t('toolbar.clearFilters', { defaultValue: 'Clear filters' })}
      </Button>
    </Flex>
  );

  const fieldsPanel = (
    <Flex vertical gap={4} style={{ minWidth: 180 }}>
      {fields.map(field => (
        <Checkbox key={field.key} checked={!hiddenFields.includes(field.key)} onChange={() => onToggleField?.(field.key)}>
          {field.label}
        </Checkbox>
      ))}
    </Flex>
  );

  return (
    <Flex justify={leading ? 'space-between' : 'flex-end'} align="center" wrap="wrap" gap={8} style={{ marginBottom: 12 }}>
      {leading}
      <Flex align="center" wrap="wrap" gap={8} style={{ marginInlineStart: 'auto' }}>
        <Input
          allowClear
          value={value}
          onChange={event => onChange(event.target.value)}
          prefix={<SearchOutlined />}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{ width: 320, maxWidth: '100%' }}
        />
        {filterGroups.length > 0 && (
          <Popover trigger="click" placement="bottomRight" content={filterPanel}>
            <Badge count={activeFilters} size="small">
              <Button icon={<FilterOutlined />}>{t('toolbar.filter', { defaultValue: 'Filter' })}</Button>
            </Badge>
          </Popover>
        )}
        {fields.length > 0 && (
          <Popover trigger="click" placement="bottomRight" content={fieldsPanel}>
            <Button icon={<EyeOutlined />} aria-label={t('toolbar.fields', { defaultValue: 'Fields' })}>
              {t('toolbar.fields', { defaultValue: 'Fields' })}
            </Button>
          </Popover>
        )}
      </Flex>
    </Flex>
  );
};

/** Empty block with a title and an optional hint, as the portal's EmptyState. */
export const PreviewEmpty = ({ title, description }: { title: string; description?: string }) => {
  const { token } = theme.useToken();
  return (
    <Card>
      <Flex vertical align="center" gap={4} style={{ padding: '24px 8px', textAlign: 'center' }}>
        <Typography.Text strong>{title}</Typography.Text>
        {description && <Typography.Text style={{ color: token.colorTextSecondary }}>{description}</Typography.Text>}
      </Flex>
    </Card>
  );
};
