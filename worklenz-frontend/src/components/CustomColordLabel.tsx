import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { Label } from '@/types/task-management.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { getContrastColor } from '@/utils/colorUtils';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface CustomColordLabelProps {
  label: Label | ITaskLabel;
  isDarkMode?: boolean;
}

const CustomColordLabel = React.forwardRef<HTMLSpanElement, CustomColordLabelProps>(
  ({ label, isDarkMode = false }, ref) => {
    // Handle different color property names for different types
    const backgroundColor = (label as Label).color || (label as ITaskLabel).color_code || '#6b7280'; // Default to gray-500 if no color

    const textColor = getContrastColor(backgroundColor);
    const decodedName = decodeHtmlEntities(label.name);

    return (
      <Tooltip title={decodedName}>
        <span
          ref={ref}
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium shrink-0"
          style={{
            backgroundColor,
            color: textColor,
            border: `1px solid ${backgroundColor}`,
            maxWidth: '120px', // Asana-style max-width to prevent long labels from consuming too much space
          }}
        >
          <span 
            className="truncate"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {decodedName}
          </span>
        </span>
      </Tooltip>
    );
  }
);

CustomColordLabel.displayName = 'CustomColordLabel';

export default CustomColordLabel;
