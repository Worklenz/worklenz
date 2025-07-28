import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { NumbersColorMap } from '@/shared/constants';

interface CustomNumberLabelProps {
  labelList: string[];
  namesString: string;
  isDarkMode?: boolean;
  color?: string; // Add color prop for label color
}

const CustomNumberLabel = React.forwardRef<HTMLSpanElement, CustomNumberLabelProps>(
  ({ labelList, namesString, isDarkMode = false, color }, ref) => {
    // Use provided color, or fall back to NumbersColorMap based on first digit
    const backgroundColor =
      color ||
      (() => {
        const firstDigit = namesString.match(/\d/)?.[0] || '0';
        return NumbersColorMap[firstDigit] || NumbersColorMap['0'];
      })();

    return (
      <Tooltip title={labelList.join(', ')}>
        <span
          ref={ref}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium cursor-help"
          style={{ backgroundColor, color: 'white' }}
        >
          {namesString}
        </span>
      </Tooltip>
    );
  }
);

CustomNumberLabel.displayName = 'CustomNumberLabel';

export default CustomNumberLabel;
