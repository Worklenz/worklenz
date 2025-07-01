import React from 'react';
import { Tooltip } from 'antd';
import { Label } from '@/types/task-management.types';

interface CustomColordLabelProps {
  label: Label;
  isDarkMode?: boolean;
}

const CustomColordLabel: React.FC<CustomColordLabelProps> = ({ 
  label, 
  isDarkMode = false 
}) => {
  const truncatedName = label.name && label.name.length > 10 
    ? `${label.name.substring(0, 10)}...` 
    : label.name;

  return (
    <Tooltip title={label.name}>
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium text-white shrink-0 max-w-[120px]"
        style={{ backgroundColor: label.color }}
      >
        <span className="truncate">{truncatedName}</span>
      </span>
    </Tooltip>
  );
};

export default CustomColordLabel; 