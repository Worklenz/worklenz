import React from 'react';

interface TagProps {
  children: React.ReactNode;
  color?: string;
  backgroundColor?: string;
  className?: string;
  size?: 'small' | 'default';
  variant?: 'default' | 'outlined';
  isDarkMode?: boolean;
}

const Tag: React.FC<TagProps> = ({
  children,
  color = 'white',
  backgroundColor = '#1890ff',
  className = '',
  size = 'default',
  variant = 'default',
  isDarkMode = false,
}) => {
  const sizeClasses = {
    small: 'px-1 py-0.5 text-xs',
    default: 'px-2 py-1 text-xs',
  };

  const baseClasses = `inline-flex items-center font-medium rounded-sm ${sizeClasses[size]}`;

  if (variant === 'outlined') {
    return (
      <span
        className={`${baseClasses} border ${className}`}
        style={{
          borderColor: backgroundColor,
          color: backgroundColor,
          backgroundColor: 'transparent',
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span className={`${baseClasses} ${className}`} style={{ backgroundColor, color }}>
      {children}
    </span>
  );
};

export default Tag;
