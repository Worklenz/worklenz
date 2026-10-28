import React from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  List,
  Space,
  Spin,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { CaretDownFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

const { Text } = Typography;

// Matches the outer "Filter" trigger button's own size exactly, so every
// pill inside a filter panel (and the trigger itself) reads as one consistent row.
export const FILTER_PILL_BUTTON_STYLE: React.CSSProperties = {
  height: 30,
  fontSize: 12,
  borderRadius: 7,
  paddingInline: 12,
};

export interface FilterOption {
  value: string;
  label: string;
}

export interface MultiSelectFilterPillProps {
  /** Fixed pill label (e.g. "Project", "Members", "Clients"). */
  label: string;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /**
   * Values shown as checked when `value` is empty (e.g. projects currently on the chart).
   * Does not change the filter until the user toggles a checkbox.
   */
  indicatedValues?: string[];
  searchable?: boolean;
  /** Placeholder (and accessible name) of the search box; pass a translated string. */
  searchPlaceholder?: string;
  /** Shown when there are no options at all, or none match the search. */
  emptyText?: React.ReactNode;
  loading?: boolean;
  /** Server-side search: when set, typed text is passed here and `options` are shown unfiltered. */
  onSearchChange?: (search: string) => void;
  /** Show Select all / Clear all actions above the list. */
  showBulkActions?: boolean;
}

// Multi-select checklist pill — mirrors the Task List "Status" filter's Card
// + List + Checkbox look (components/project-task-filters/filter-dropdowns/status-filter-dropdown.tsx).
export const MultiSelectFilterPill: React.FC<MultiSelectFilterPillProps> = ({
  label,
  options,
  value,
  onChange,
  indicatedValues = [],
  searchable = true,
  searchPlaceholder,
  emptyText,
  loading = false,
  onSearchChange,
  showBulkActions = false,
}) => {
  const { t } = useTranslation('common');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filtered =
    search.trim() && !onSearchChange
      ? options.filter(o => o.label.toLowerCase().includes(search.trim().toLowerCase()))
      : options;

  // When nothing is explicitly selected, show indicated values as checked.
  const checkedValues = value.length > 0 ? value : indicatedValues;

  const handleSearchChange = (next: string) => {
    setSearch(next);
    onSearchChange?.(next);
  };

  const toggle = (val: string) => {
    const current = value.length > 0 ? value : indicatedValues;
    onChange(current.includes(val) ? current.filter(v => v !== val) : [...current, val]);
  };

  const selectAllVisible = () => {
    const visibleIds = filtered.map(o => o.value);
    const current = value.length > 0 ? value : indicatedValues;
    onChange([...new Set([...current, ...visibleIds])]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // A half-typed search should not linger into the next time the pill opens.
    if (!next) handleSearchChange('');
  };

  const dropdownContent = (
    <Card
      className="custom-card"
      style={{ width: 'min(240px, calc(100vw - 32px))' }}
      styles={{ body: { padding: searchable || showBulkActions ? 8 : 0 } }}
    >
      <Flex vertical gap={8}>
        {searchable && (
          <Input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder ?? label}
            allowClear
            size="small"
          />
        )}
        {showBulkActions && !loading && filtered.length > 0 && (
          <Flex justify="space-between" align="center" style={{ paddingInline: 4 }}>
            <Button
              type="link"
              size="small"
              onClick={selectAllVisible}
              style={{ paddingInline: 0, height: 'auto', fontSize: 12 }}
            >
              {t('selectAll', { defaultValue: 'Select all' })}
            </Button>
            <Button
              type="link"
              size="small"
              onClick={clearAll}
              disabled={value.length === 0}
              style={{ paddingInline: 0, height: 'auto', fontSize: 12 }}
            >
              {t('clearAll', { defaultValue: 'Clear all' })}
            </Button>
          </Flex>
        )}
        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : (
          <List style={{ padding: 0, maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length ? (
              filtered.map(opt => (
                <List.Item
                  className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                  key={opt.value}
                  style={{ display: 'flex', padding: '4px 8px', border: 'none' }}
                >
                  {/* The label fills the row, so a click anywhere on it toggles exactly once. */}
                  <Checkbox
                    checked={checkedValues.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    {opt.label}
                  </Checkbox>
                </List.Item>
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={emptyText ?? <Text type="secondary">{label}</Text>}
                style={{ padding: 8 }}
              />
            )}
          </List>
        )}
      </Flex>
    </Card>
  );

  const badgeCount = value.length > 0 ? value.length : indicatedValues.length;

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      popupRender={() => dropdownContent}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        style={
          open || badgeCount > 0
            ? {
                ...FILTER_PILL_BUTTON_STYLE,
                borderColor: token.colorPrimary,
                color: token.colorPrimary,
              }
            : FILTER_PILL_BUTTON_STYLE
        }
      >
        <Space>
          {label}
          {badgeCount > 0 && (
            <Badge
              size="small"
              count={badgeCount}
              style={{ backgroundColor: token.colorPrimary }}
            />
          )}
        </Space>
      </Button>
    </Dropdown>
  );
};
