import React from 'react';
import { Tooltip } from 'antd';
import { Label } from '@/types/task-management.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ALPHA_CHANNEL } from '@/shared/constants';

interface CustomColordLabelProps {
  label: Label | ITaskLabel;
  isDarkMode?: boolean;
}

const CustomColordLabel = React.forwardRef<HTMLSpanElement, CustomColordLabelProps>(
  ({ label, isDarkMode = false }, ref) => {
    const truncatedName =
      label.name && label.name.length > 10 ? `${label.name.substring(0, 10)}...` : label.name;

    // Handle different color property names for different types
    const baseColor = (label as Label).color || (label as ITaskLabel).color_code || '#6b7280'; // Default to gray-500 if no color
    
    // Add alpha channel to the base color
    const backgroundColor = baseColor + ALPHA_CHANNEL;
    const textColor = baseColor;

    return (
      <Tooltip title={label.name}>
        <span
          ref={ref}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 max-w-[100px]"
          style={{ 
            backgroundColor,
            color: textColor,
            border: `1px solid ${baseColor}`,
          }}
        >
          <span className="truncate">{truncatedName}</span>
        </span>
      </Tooltip>
    );
  }
);

CustomColordLabel.displayName = 'CustomColordLabel';

export default CustomColordLabel;
