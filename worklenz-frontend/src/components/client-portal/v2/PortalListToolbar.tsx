import React from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { Flex, Input } from '@/shared/antd-imports';

interface PortalListToolbarProps {
  /** Left-aligned content, such as a primary action or a view toggle. */
  lead?: React.ReactNode;
  /** The Filter and Fields buttons. */
  controls?: React.ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
}

/** The toolbar every v2 list shares: any lead content on the left, then the search box, Filter and Fields at the right edge. */
export const PortalListToolbar = ({
  lead,
  controls,
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
}: PortalListToolbarProps) => (
  <Flex gap={10} wrap="wrap" align="center" style={{ marginBottom: 14 }}>
    {lead}
    <Flex gap={8} wrap="wrap" align="center" justify="flex-end" style={{ marginLeft: 'auto' }}>
      <Input
        allowClear
        style={{ width: 300, maxWidth: '100%' }}
        prefix={<SearchOutlined />}
        value={search}
        onChange={event => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchLabel}
      />
      {controls}
    </Flex>
  </Flex>
);
