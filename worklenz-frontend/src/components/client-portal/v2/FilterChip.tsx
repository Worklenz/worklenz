import { useState } from 'react';
import { CaretDownFilled, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Dropdown, Flex, Input, Typography } from '@/shared/antd-imports';

interface FilterChipProps {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  selectAllLabel: string;
  clearLabel: string;
  searchPlaceholder?: string;
}

/** A multi-select filter chip: a button with a caret that opens a checkbox list, matching the reporting filters. */
export const FilterChip = ({ label, options, value, onChange, selectAllLabel, clearLabel, searchPlaceholder }: FilterChipProps) => {
  const [query, setQuery] = useState('');
  const visible = searchPlaceholder
    ? options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  const isAllSelected = options.length > 0 && value.length === options.length;
  const isSomeSelected = value.length > 0 && !isAllSelected;

  const toggle = (optionValue: string) =>
    onChange(value.includes(optionValue) ? value.filter(item => item !== optionValue) : [...value, optionValue]);

  const content = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 220 } }}>
      <Flex vertical gap={8}>
        {searchPlaceholder && (
          <Input
            size="small"
            allowClear
            prefix={<SearchOutlined />}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        )}
        <Flex justify="space-between" align="center">
          <Checkbox
            checked={isAllSelected}
            indeterminate={isSomeSelected}
            onChange={event => onChange(event.target.checked ? options.map(option => option.value) : [])}
          >
            {selectAllLabel}
          </Checkbox>
          <Button type="link" size="small" disabled={value.length === 0} onClick={() => onChange([])}>
            {clearLabel}
          </Button>
        </Flex>
        <Flex vertical gap={6} style={{ maxHeight: 240, overflowY: 'auto', paddingInline: 4 }} role="group" aria-label={label}>
          {visible.map(option => (
            <Checkbox key={option.value} checked={value.includes(option.value)} onChange={() => toggle(option.value)}>
              {option.label}
            </Checkbox>
          ))}
        </Flex>
      </Flex>
    </Card>
  );

  return (
    <Dropdown overlayClassName="custom-dropdown" dropdownRender={() => content} trigger={['click']} placement="bottomLeft">
      <Button>
        <Flex align="center" gap={4}>
          {label}
          {value.length > 0 && <Typography.Text type="secondary">({value.length})</Typography.Text>}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};
