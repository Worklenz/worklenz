import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  Spin,
  Typography,
  CaretDownFilled,
  SearchOutlined,
} from '@/shared/antd-imports';

export interface MultiSelectFilterOption {
  value: string;
  label: string;
  color?: string | null;
}

interface MultiSelectFilterDropdownProps {
  label: string;
  searchPlaceholder?: string;
  options: MultiSelectFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  loading?: boolean;
}

const MultiSelectFilterDropdown = ({
  label,
  searchPlaceholder,
  options,
  selected,
  onChange,
  loading,
}: MultiSelectFilterDropdownProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(
    () => options.filter(option => option.label.toLowerCase().includes(searchQuery.toLowerCase())),
    [options, searchQuery]
  );

  const handleToggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]
    );
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 260 } }}>
      <Flex vertical gap={8}>
        {searchPlaceholder && (
          <Input
            placeholder={searchPlaceholder}
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
          />
        )}
        {selected.length > 0 && (
          <Flex justify="flex-end">
            <Button type="link" size="small" onClick={() => onChange([])}>
              Clear All
            </Button>
          </Flex>
        )}
        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : filteredOptions.length ? (
          <Flex vertical gap={4} style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filteredOptions.map(option => (
              <Checkbox
                key={option.value}
                checked={selected.includes(option.value)}
                onChange={() => handleToggle(option.value)}
              >
                <Flex align="center" gap={8}>
                  {option.color && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: option.color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {option.label}
                </Flex>
              </Checkbox>
            ))}
          </Flex>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => dropdownContent}
      placement="bottomLeft"
    >
      <Button size="small">
        <Flex align="center" gap={4}>
          {label}
          {selected.length > 0 && (
            <Typography.Text type="secondary">({selected.length})</Typography.Text>
          )}
          <CaretDownFilled style={{ fontSize: 10 }} />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default MultiSelectFilterDropdown;
