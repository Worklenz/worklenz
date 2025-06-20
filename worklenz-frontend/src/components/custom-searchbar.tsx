import React, { useMemo, useCallback } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import Input from 'antd/es/input';

interface CustomSearchbarProps {
  placeholderText: string;
  searchQuery: string;
  setSearchQuery: (searchText: string) => void;
}

const CustomSearchbar: React.FC<CustomSearchbarProps> = React.memo(({
  placeholderText,
  searchQuery,
  setSearchQuery,
}) => {
  // Memoize styles to prevent recreation
  const containerStyles = useMemo(() => ({
    position: 'relative' as const,
    width: 240,
  }), []);

  const inputStyles = useMemo(() => ({
    padding: '4px 24px 4px 11px',
  }), []);

  const iconContainerStyles = useMemo(() => ({
    position: 'absolute' as const,
    top: '50%',
    right: 6,
    transform: 'translateY(-50%)',
  }), []);

  const iconStyles = useMemo(() => ({
    fontSize: 14,
  }), []);

  // Memoize the change handler
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.currentTarget.value);
  }, [setSearchQuery]);

  return (
    <div style={containerStyles}>
      <Input
        placeholder={placeholderText}
        value={searchQuery}
        onChange={handleChange}
        style={inputStyles}
      />
      <span style={iconContainerStyles}>
        <SearchOutlined style={iconStyles} />
      </span>
    </div>
  );
});

CustomSearchbar.displayName = 'CustomSearchbar';

export default CustomSearchbar;
