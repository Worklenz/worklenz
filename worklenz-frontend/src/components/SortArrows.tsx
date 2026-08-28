import React from 'react';
import { CaretUpOutlined, CaretDownOutlined, theme } from '@/shared/antd-imports';

interface SortArrowsProps {
  active: 'asc' | 'desc' | null;
}

// Compact stacked up/down carets — clicking the header cycles the sort
// direction for that column; the active arrow is highlighted in the theme's
// primary color. Shared between home page task tables so sortable columns
// look identical everywhere.
const SortArrows: React.FC<SortArrowsProps> = ({ active }) => {
  const { token } = theme.useToken();
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        marginLeft: 4,
        lineHeight: 0,
      }}
    >
      <CaretUpOutlined
        style={{ fontSize: 9, color: active === 'asc' ? token.colorPrimary : token.colorTextQuaternary }}
      />
      <CaretDownOutlined
        style={{
          fontSize: 9,
          marginTop: -2,
          color: active === 'desc' ? token.colorPrimary : token.colorTextQuaternary,
        }}
      />
    </span>
  );
};

export default SortArrows;
