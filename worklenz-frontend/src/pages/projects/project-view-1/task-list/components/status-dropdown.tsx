import React, { useMemo, useState, useRef } from 'react';
import { Select, Spin } from 'antd';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';

interface Option {
  id: string;
  name: string;
  color?: string;
}

interface StatusDropdownProps {
  options?: Option[];
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
        <div style={{ padding: '8px', textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      ) : filteredOptions.length === 0 ? (
        <div style={{ padding: '8px', textAlign: 'center', color: '#999' }}>
          {searchValue ? 'No matching options' : 'No options available'}
        </div>
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
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
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    backgroundColor: value === option.id ? '#e6f7ff' : 'transparent',
                    height: '100%',
                    boxSizing: 'border-box'
                  }}
                  onClick={() => onChange(option.id)}
                >
                  {option.color && (
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: option.color,
                        flexShrink: 0
                      }}
                    />
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {option.name}
                  </span>
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
      loading={loading}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      onSearch={handleSearch}
      filterOption={false}
      showSearch
      dropdownRender={dropdownRender}
      notFoundContent={loading ? <Spin size="small" /> : null}
      getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
      listHeight={WINDOW_HEIGHT}
    >
      {selectedStatus && (
        <Select.Option value={selectedStatus.id} key={selectedStatus.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedStatus.color && (
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: selectedStatus.color,
                  flexShrink: 0
                }}
              />
            )}
            <span>{selectedStatus.name}</span>
          </div>
        </Select.Option>
      )}
    </Select>
  );
};

export default StatusDropdown; 