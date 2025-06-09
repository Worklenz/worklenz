import React, { useMemo, useState, useRef } from 'react';
import { Select, Spin, Badge } from 'antd';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';
import { FlagOutlined } from '@ant-design/icons';

interface PriorityOption {
  id: string;
  name: string;
  color?: string;
  value?: number;
}

interface PriorityDropdownProps {
  options?: PriorityOption[];
  value?: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  dropdownStyle?: React.CSSProperties;
  disabled?: boolean;
}

const ITEM_HEIGHT = 40;
const WINDOW_HEIGHT = 260;

const PriorityDropdown: React.FC<PriorityDropdownProps> = ({
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

  // Find selected priority for display
  const selectedPriority = useMemo(() => {
    return options.find(option => option.id === value);
  }, [options, value]);

  // Sort priorities by value (higher value = higher priority)
  const sortedOptions = useMemo(() => {
    if (!options || !Array.isArray(options)) return [];
    return [...options].sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [options]);

  // Memoize filtered options with null check
  const filteredOptions = useMemo(() => {
    if (!searchValue) return sortedOptions;
    return sortedOptions.filter(option => 
      option?.name?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [sortedOptions, searchValue]);

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

  // Get priority icon based on value
  const getPriorityIcon = (priorityValue?: number) => {
    if (!priorityValue) return null;
    if (priorityValue >= 3) return '🔥'; // High priority
    if (priorityValue >= 2) return '⚡'; // Medium priority
    return '📌'; // Low priority
  };

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
          {searchValue ? 'No matching priorities' : 'No priorities available'}
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
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    backgroundColor: value === option.id ? '#fff2e8' : 'transparent',
                    height: '100%',
                    boxSizing: 'border-box',
                    borderRadius: '6px',
                    margin: '2px 4px',
                    border: value === option.id ? '1px solid #ff7a00' : '1px solid transparent'
                  }}
                  onClick={() => onChange(option.id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1
                    }}
                  >
                    <Badge
                      color={option.color}
                      style={{
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                        width: '12px',
                        height: '12px'
                      }}
                    />
                    <FlagOutlined 
                      style={{ 
                        color: option.color,
                        fontSize: '14px'
                      }} 
                    />
                    <span style={{
                      fontWeight: 500,
                      fontSize: '13px',
                      color: '#262626'
                    }}>
                      {option.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '14px' }}>
                      {getPriorityIcon(option.value)}
                    </span>
                    {option.value && (
                      <span style={{ 
                        fontSize: '11px', 
                        color: '#8c8c8c',
                        fontWeight: 500
                      }}>
                        P{option.value}
                      </span>
                    )}
                  </div>
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
      placeholder={placeholder || t('Select Priority')}
      style={{
        width: '100%',
        minWidth: '140px',
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
            <Badge
              color={option.color}
              style={{
                boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                width: '10px',
                height: '10px'
              }}
            />
            <FlagOutlined style={{ color: option.color, fontSize: '12px' }} />
            <span style={{ fontWeight: 500, fontSize: '13px' }}>
              {option.name}
            </span>
          </div>
        </Select.Option>
      ))}
    </Select>
  );
};

export default PriorityDropdown; 