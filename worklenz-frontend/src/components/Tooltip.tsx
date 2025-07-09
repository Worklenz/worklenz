import React from 'react';

interface TooltipProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  isDarkMode?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  title,
  children,
  isDarkMode = false,
  placement = 'top',
  className = '',
}) => {
  const placementClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      <div
        className={`absolute ${placementClasses[placement]} px-2 py-1 text-xs text-white ${isDarkMode ? 'bg-gray-700' : 'bg-gray-900'} rounded-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none min-w-max`}
      >
        {title}
      </div>
    </div>
  );
};

export default Tooltip;
