import React, { useState, useCallback, Suspense } from 'react';
import { CalendarOutlined } from '@ant-design/icons';
import { formatDate } from '@/utils/date-time';

// Lazy load the DatePicker component only when needed
const LazyDatePicker = React.lazy(() => 
  import('antd/es/date-picker').then(module => ({ default: module.default }))
);

interface LazyDatePickerProps {
  value?: string | null;
  onChange?: (date: string | null) => void;
  placeholder?: string;
  isDarkMode?: boolean;
  className?: string;
}

// Lightweight loading placeholder
const DateLoadingPlaceholder: React.FC<{ isDarkMode: boolean; value?: string | null; placeholder?: string }> = ({ 
  isDarkMode, 
  value, 
  placeholder 
}) => (
  <div
    className={`
      flex items-center gap-1 px-2 py-1 text-xs rounded border cursor-pointer
      transition-colors duration-200 animate-pulse min-w-[80px]
      ${isDarkMode 
        ? 'border-gray-600 bg-gray-800 text-gray-400' 
        : 'border-gray-300 bg-gray-100 text-gray-600'
      }
    `}
  >
    <CalendarOutlined className="text-xs" />
    <span>{value ? formatDate(value) : (placeholder || 'Select date')}</span>
  </div>
);

const LazyDatePickerWrapper: React.FC<LazyDatePickerProps> = ({ 
  value,
  onChange,
  placeholder = 'Select date',
  isDarkMode = false,
  className = ''
}) => {
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const handleInteraction = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!hasLoadedOnce) {
      setHasLoadedOnce(true);
    }
  }, [hasLoadedOnce]);

  // If not loaded yet, show a simple placeholder
  if (!hasLoadedOnce) {
    return (
      <div
        onClick={handleInteraction}
        onMouseEnter={handleInteraction} // Preload on hover
        className={`
          flex items-center gap-1 px-2 py-1 text-xs rounded border cursor-pointer
          transition-colors duration-200 min-w-[80px] ${className}
          ${isDarkMode 
            ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800 text-gray-400' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-600'
          }
        `}
        title="Select date"
      >
        <CalendarOutlined className="text-xs" />
        <span>{value ? formatDate(value) : placeholder}</span>
      </div>
    );
  }

  // Once loaded, show the full DatePicker
  return (
    <Suspense 
      fallback={
        <DateLoadingPlaceholder 
          isDarkMode={isDarkMode} 
          value={value}
          placeholder={placeholder}
        />
      }
    >
      <LazyDatePicker
        value={value ? new Date(value) : null}
        onChange={(date) => onChange?.(date ? date.toISOString() : null)}
        placeholder={placeholder}
        className={className}
        size="small"
      />
    </Suspense>
  );
};

export default LazyDatePickerWrapper; 