import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Checkbox, Dropdown, Input, List } from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined } from '@ant-design/icons';
import { InputRef } from 'antd/es/input';

export interface PlannerFilterOption {
  value: string;
  label?: string | null;
}

interface PlannerMultiFilterDropdownProps {
  label: string;
  options: PlannerFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  showSearch?: boolean;
}

// Search box + checkbox list dropdown, matching the pattern already used across the
// app (e.g. src/components/taskListCommon/assignee-selector/assignee-selector.tsx)
// rather than antd's default multi-select tag input.
const PlannerMultiFilterDropdown: React.FC<PlannerMultiFilterDropdownProps> = ({
  label,
  options,
  selected,
  onChange,
  showSearch = true,
}) => {
  const { t } = useTranslation('schedule');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<InputRef>(null);

  const filteredOptions = useMemo(() => {
    const searchLower = (search || '').trim().toLowerCase();
    if (!searchLower) return options || [];
    return (options || []).filter(o => {
      const itemLabel = String(o?.label ?? o?.value ?? '').toLowerCase();
      return itemLabel.includes(searchLower);
    });
  }, [options, search]);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      open={open}
      onOpenChange={handleOpenChange}
      popupRender={() => (
        <Card size="small" styles={{ body: { padding: 8, width: 220 } }}>
          {showSearch && (
            <Input
              ref={inputRef}
              size="small"
              prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
              placeholder={t('search', { defaultValue: 'Search...' })}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: 8, borderRadius: 7 }}
            />
          )}
          <List
            style={{ maxHeight: 260, overflowY: 'auto' }}
            dataSource={filteredOptions}
            locale={{ emptyText: t('noResults', { defaultValue: 'No results' }) }}
            renderItem={item => (
              <List.Item style={{ padding: '4px 4px', border: 'none' }}>
                <Checkbox checked={selected.includes(item.value)} onChange={() => toggle(item.value)}>
                  <span style={{ fontSize: 13 }}>{item.label || item.value || ''}</span>
                </Checkbox>
              </List.Item>
            )}
          />
        </Card>
      )}
    >
      <Button size="small" style={{ fontSize: 12, borderRadius: 7 }}>
        {label}
        {selected.length > 0 && <span style={{ opacity: 0.55 }}> ({selected.length})</span>}
        <CaretDownFilled style={{ fontSize: 10, marginLeft: 4 }} />
      </Button>
    </Dropdown>
  );
};

export default PlannerMultiFilterDropdown;
