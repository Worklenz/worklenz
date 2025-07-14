import React from 'react';

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'text' | 'default' | 'primary' | 'danger';
  size?: 'small' | 'default' | 'large';
  className?: string;
  icon?: React.ReactNode;
  isDarkMode?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  onClick,
  variant = 'default',
  size = 'default',
  className = '',
  icon,
  isDarkMode = false,
  disabled = false,
  type = 'button',
  ...props
}) => {
  const baseClasses = `inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none focus:ring-2 ${isDarkMode ? 'focus:ring-blue-400' : 'focus:ring-blue-500'} focus:ring-offset-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;

  const variantClasses = {
    text: isDarkMode
      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
    default: isDarkMode
      ? 'bg-gray-800 border border-gray-600 text-gray-200 hover:bg-gray-700'
      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    primary: isDarkMode
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-blue-500 text-white hover:bg-blue-600',
    danger: isDarkMode
      ? 'bg-red-600 text-white hover:bg-red-700'
      : 'bg-red-500 text-white hover:bg-red-600',
  };

  const sizeClasses = {
    small: 'px-2 py-1 text-xs rounded-sm',
    default: 'px-3 py-2 text-sm rounded-md',
    large: 'px-4 py-3 text-base rounded-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {icon && <span className={children ? 'mr-1' : ''}>{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
