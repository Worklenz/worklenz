import type { ReactNode } from 'react';
import { Flex, Input, SearchOutlined, theme } from '@/shared/antd-imports';
import type { ColumnField } from './ColumnFields';
import { FieldsButton } from './ColumnFields';
import type { FilterGroup } from './FilterButton';
import { FilterButton } from './FilterButton';

interface ListToolbarProps {
  searchText: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  filterGroups: FilterGroup[];
  onClearFilters: () => void;
  fields: ColumnField[];
  hiddenFields: string[];
  onToggleField: (key: string) => void;
  /** A primary action shown at the start of the row (e.g. "New change request"). */
  leading?: ReactNode;
}

/** The toolbar every portal table shares: search, Filter and the eye "Fields" button, right-aligned. */
export const ListToolbar = ({
  searchText,
  onSearch,
  searchPlaceholder,
  filterGroups,
  onClearFilters,
  fields,
  hiddenFields,
  onToggleField,
  leading,
}: ListToolbarProps) => {
  const { token } = theme.useToken();
  return (
    <Flex justify={leading ? 'space-between' : 'flex-end'} align="center" wrap="wrap" gap={8} style={{ marginBottom: token.marginSM }}>
      {leading}
      <Flex align="center" wrap="wrap" gap={8} style={{ marginInlineStart: 'auto' }}>
        <Input
          allowClear
          value={searchText}
          onChange={event => onSearch(event.target.value)}
          prefix={<SearchOutlined />}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          style={{ width: 320, maxWidth: '100%' }}
        />
        {filterGroups.length > 0 && <FilterButton groups={filterGroups} onClear={onClearFilters} />}
        <FieldsButton fields={fields} hidden={hiddenFields} onToggle={onToggleField} />
      </Flex>
    </Flex>
  );
};
