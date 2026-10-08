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
  theme,
} from '@/shared/antd-imports';
import { CaretDownFilled } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';

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
  searchable?: boolean;
  /** Placeholder (and accessible name) of the search box; pass a translated string. */
  searchPlaceholder?: string;
  /** Shown when there are no options at all, or none match the search. */
  emptyText?: React.ReactNode;
  loading?: boolean;
  /** Server-side search: when set, typed text is passed here and `options` are shown unfiltered. */
  onSearchChange?: (search: string) => void;
}

// Multi-select checklist pill — mirrors the Task List "Status" filter's Card
// + List + Checkbox look (components/project-task-filters/filter-dropdowns/status-filter-dropdown.tsx).
export const MultiSelectFilterPill: React.FC<MultiSelectFilterPillProps> = ({
  label,
  options,
  value,
  onChange,
  searchable = true,
  searchPlaceholder,
  emptyText,
  loading = false,
  onSearchChange,
}) => {
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filtered =
    search.trim() && !onSearchChange
      ? options.filter(o => o.label.toLowerCase().includes(search.trim().toLowerCase()))
      : options;

  const handleSearchChange = (next: string) => {
    setSearch(next);
    onSearchChange?.(next);
  };

  const toggle = (val: string) => {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val]);
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
      styles={{ body: { padding: searchable ? 8 : 0 } }}
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
                    checked={value.includes(opt.value)}
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
                description={emptyText}
                style={{ padding: 8 }}
              />
            )}
          </List>
        )}
      </Flex>
    </Card>
  );

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
          open || value.length > 0
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
          {value.length > 0 && (
            <Badge
              size="small"
              count={value.length}
              style={{ backgroundColor: token.colorPrimary }}
            />
          )}
        </Space>
      </Button>
    </Dropdown>
  );
};
