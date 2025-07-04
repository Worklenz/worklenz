import React from 'react';
import { Tooltip } from 'antd';
import { NumbersColorMap } from '@/shared/constants';

interface CustomNumberLabelProps {
  labelList: string[];
  namesString: string;
  isDarkMode?: boolean;
  color?: string; // Add color prop for label color
}

const CustomNumberLabel: React.FC<CustomNumberLabelProps> = ({
  labelList,
  namesString,
  isDarkMode = false,
  color,
}) => {
  // Use provided color, or fall back to NumbersColorMap based on first digit
  const backgroundColor = color || (() => {
    const firstDigit = namesString.match(/\d/)?.[0] || '0';
    return NumbersColorMap[firstDigit] || NumbersColorMap['0'];
  })();
  
  return (
    <Tooltip title={labelList.join(', ')}>
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white cursor-help"
        style={{ backgroundColor }}
      >
        {namesString}
      </span>
    </Tooltip>
  );
};

export default CustomNumberLabel;
