import React from 'react';
import { theme, CaretUpOutlined, CaretDownOutlined } from '@/shared/antd-imports';

// Mirrors the sort-arrow affordance used by the Overview page's priority table
// and Home > Log Time's Recently Logged table (TasksList.tsx / HomeLogTime.tsx)
// so every sortable table in the app reads the same way.
export const SortArrows: React.FC<{ active: 'asc' | 'desc' | null }> = ({ active }) => {
  const { token } = theme.useToken();
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: 4, lineHeight: 0 }}>
      <CaretUpOutlined
        style={{
          fontSize: 9,
          color: active === 'asc' ? token.colorPrimary : token.colorTextQuaternary,
        }}
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
