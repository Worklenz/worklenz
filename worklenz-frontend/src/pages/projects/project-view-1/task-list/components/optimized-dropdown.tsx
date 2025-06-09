import React, { useMemo, useState, useRef } from 'react';
import { Select, Spin } from 'antd';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';
import { useAppSelector } from '@/hooks/useAppSelector';

interface Option {
  id: string;
  name: string;
  color?: string;
}

interface OptimizedDropdownProps {
  options?: Option[];
  value?: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  dropdownStyle?: React.CSSProperties;
  disabled?: boolean;
}

const ITEM_HEIGHT = 32;
const WINDOW_HEIGHT = 300;

const OptimizedDropdown: React.FC<OptimizedDropdownProps> = ({
  options = [],
  value,
  onChange,
  loading = false,
  placeholder,
  style,
  dropdownStyle,
  disabled = false
}) => {
  const priorities = useAppSelector(state => state.priorityReducer.priorities);
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

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
  }, 300);

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
      options={priorities.map(priority => ({
        label: priority.name,
        value: priority.id,
        color_code: priority.color_code,
        key: priority.id,
        color_code_dark: priority.color_code_dark
      }))}
      styles={{
        popup: {
          root: {
            padding: 0
          }
        }
      }}
      popupRender={dropdownRender}
      notFoundContent={loading ? <Spin size="small" /> : null}
      getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
      listHeight={300}
    >
      
    </Select>
  );
};

export default OptimizedDropdown; 