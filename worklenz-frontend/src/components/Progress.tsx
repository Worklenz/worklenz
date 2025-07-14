import React from 'react';

interface ProgressProps {
  percent: number;
  type?: 'line' | 'circle';
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
  showInfo?: boolean;
  isDarkMode?: boolean;
  className?: string;
}

const Progress: React.FC<ProgressProps> = ({
  percent,
  type = 'line',
  size = 24,
  strokeColor = '#1890ff',
  strokeWidth = 2,
  showInfo = true,
  isDarkMode = false,
  className = '',
}) => {
  // Ensure percent is between 0 and 100
  const normalizedPercent = Math.min(Math.max(percent, 0), 100);

  if (type === 'circle') {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (normalizedPercent / 100) * circumference;

    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isDarkMode ? '#4b5563' : '#e5e7eb'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={normalizedPercent === 100 ? '#52c41a' : strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        {showInfo && (
          <span
            className={`absolute text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            {normalizedPercent}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-full h-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} ${className}`}
    >
      <div
        className="h-2 rounded-full transition-all duration-300"
        style={{
          width: `${normalizedPercent}%`,
          backgroundColor: normalizedPercent === 100 ? '#52c41a' : strokeColor,
        }}
      />
      {showInfo && (
        <div className={`mt-1 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {normalizedPercent}%
        </div>
      )}
    </div>
  );
};

export default Progress;
