import React, { useMemo, useState, useRef } from 'react';
import { Select, Spin, Tag } from 'antd';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';

interface StatusOption {
  id: string;
  name: string;
  color?: string;
  category?: string;
}

interface StatusDropdownProps {
  options?: StatusOption[];
  value?: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  dropdownStyle?: React.CSSProperties;
  disabled?: boolean;
}

const ITEM_HEIGHT = 36;
const WINDOW_HEIGHT = 280;

const StatusDropdown: React.FC<StatusDropdownProps> = ({
  options = [],
  value,
  onChange,
  loading = false,
  placeholder,
  style,
  dropdownStyle,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find selected status for display
  const selectedStatus = useMemo(() => {
    return options.find(option => option.id === value);
  }, [options, value]);

  // Memoize filtered options with null check
  const filteredOptions = useMemo(() => {
    if (!options || !Array.isArray(options)) return [];
    if (!searchValue) return options;
    return options.filter(option => 
      option?.name?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchValue]);

  // Create virtualizer for the dropdown list
  const rowVirtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5
  });

  // Debounced search handler
  const handleSearch = debounce((value: string) => {
    setSearchValue(value);
  }, 250);

  // Custom dropdown renderer with virtualization
  const dropdownRender = (menu: React.ReactNode) => (
    <div 
      ref={scrollRef}
      style={{ 
        maxHeight: WINDOW_HEIGHT,
        overflow: 'auto',
        position: 'relative'
      }}
    >
      {loading ? (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      ) : filteredOptions.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', color: '#999' }}>
          {searchValue ? 'No matching statuses' : 'No statuses available'}
        </div>
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const option = filteredOptions[virtualRow.index];
            if (!option) return null;
            
            return (
              <div
                key={option.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${ITEM_HEIGHT}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    backgroundColor: value === option.id ? '#e6f7ff' : 'transparent',
                    height: '100%',
                    boxSizing: 'border-box',
                    borderRadius: '4px',
                    margin: '2px 4px'
                  }}
                  onClick={() => onChange(option.id)}
                >
                  <Tag
                    color={option.color}
                    style={{
                      margin: 0,
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      minWidth: '60px',
                      textAlign: 'center'
                    }}
                  >
                    {option.name}
                  </Tag>
                  {option.category && (
                    <span style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>
                      {option.category}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Select
      value={value}
      onChange={onChange}
      onSearch={handleSearch}
      showSearch
      loading={loading}
      placeholder={placeholder || t('Select Status')}
      style={{
        width: '100%',
        minWidth: '120px',
        ...style
      }}
      dropdownStyle={{
        ...dropdownStyle,
        padding: 0,
        borderRadius: '8px'
      }}
      disabled={disabled}
      dropdownRender={dropdownRender}
      filterOption={false}
      notFoundContent={loading ? <Spin size="small" /> : null}
      getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
      listHeight={WINDOW_HEIGHT}
    >
      {filteredOptions.map((option) => (
        <Select.Option key={option.id} value={option.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag
              color={option.color}
              style={{
                margin: 0,
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              {option.name}
            </Tag>
          </div>
        </Select.Option>
      ))}
    </Select>
  );
};

export default StatusDropdown; 