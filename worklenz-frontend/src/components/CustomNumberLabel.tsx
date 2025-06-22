import React from 'react';
import { Tooltip } from 'antd';

interface CustomNumberLabelProps {
  labelList: string[];
  namesString: string;
  isDarkMode?: boolean;
}

const CustomNumberLabel: React.FC<CustomNumberLabelProps> = ({ 
  labelList, 
  namesString, 
  isDarkMode = false 
}) => {
  return (
    <Tooltip title={labelList.join(', ')}>
      <span
        className={`
          inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
          ${isDarkMode ? 'bg-gray-600 text-gray-100' : 'bg-gray-200 text-gray-700'}
          cursor-help
        `}
      >
        {namesString}
      </span>
    </Tooltip>
  );
};

export default CustomNumberLabel; 