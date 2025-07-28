import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { Label } from '@/types/task-management.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';

interface CustomColordLabelProps {
  label: Label | ITaskLabel;
  isDarkMode?: boolean;
}

const CustomColordLabel = React.forwardRef<HTMLSpanElement, CustomColordLabelProps>(
  ({ label, isDarkMode = false }, ref) => {
    const truncatedName =
      label.name && label.name.length > 10 ? `${label.name.substring(0, 10)}...` : label.name;

    // Handle different color property names for different types
    const backgroundColor = (label as Label).color || (label as ITaskLabel).color_code || '#6b7280'; // Default to gray-500 if no color

    // Function to determine if we should use white or black text based on background color
    const getTextColor = (bgColor: string): string => {
      // Remove # if present
      const color = bgColor.replace('#', '');

      // Convert to RGB
      const r = parseInt(color.substr(0, 2), 16);
      const g = parseInt(color.substr(2, 2), 16);
      const b = parseInt(color.substr(4, 2), 16);

      // Calculate luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Return white for dark backgrounds, black for light backgrounds
      return luminance > 0.5 ? '#000000' : '#ffffff';
    };

    const textColor = getTextColor(backgroundColor);

    return (
      <Tooltip title={label.name}>
        <span
          ref={ref}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 max-w-[100px]"
          style={{
            backgroundColor,
            color: textColor,
            border: `1px solid ${backgroundColor}`,
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
