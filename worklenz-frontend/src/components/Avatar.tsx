import React from 'react';

interface AvatarProps {
  name?: string;
  size?: number | 'small' | 'default' | 'large';
  isDarkMode?: boolean;
  className?: string;
  src?: string;
  backgroundColor?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

const Avatar: React.FC<AvatarProps> = ({
  name = '',
  size = 'default',
  isDarkMode = false,
  className = '',
  src,
  backgroundColor,
  onClick,
  style = {},
}) => {
  // Handle both numeric and string sizes
  const getSize = () => {
    if (typeof size === 'number') {
      return { width: size, height: size, fontSize: `${size * 0.4}px` };
    }

    const sizeMap = {
      small: { width: 24, height: 24, fontSize: '10px' },
      default: { width: 32, height: 32, fontSize: '14px' },
      large: { width: 48, height: 48, fontSize: '18px' },
    };

    return sizeMap[size];
  };

  const sizeStyle = getSize();

  const lightColors = [
    '#f56565',
    '#4299e1',
    '#48bb78',
    '#ed8936',
    '#9f7aea',
    '#ed64a6',
    '#667eea',
    '#38b2ac',
    '#f6ad55',
    '#4fd1c7',
  ];

  const darkColors = [
    '#e53e3e',
    '#3182ce',
    '#38a169',
    '#dd6b20',
    '#805ad5',
    '#d53f8c',
    '#5a67d8',
    '#319795',
    '#d69e2e',
    '#319795',
  ];

  const colors = isDarkMode ? darkColors : lightColors;
  const colorIndex = name.charCodeAt(0) % colors.length;
  const defaultBgColor = backgroundColor || colors[colorIndex];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
  };

  const avatarStyle = {
    ...sizeStyle,
    backgroundColor: defaultBgColor,
    ...style,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        onClick={handleClick}
        className={`rounded-full object-cover shadow-sm cursor-pointer ${className}`}
        style={avatarStyle}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`rounded-full flex items-center justify-center text-white font-medium shadow-sm cursor-pointer ${className}`}
      style={avatarStyle}
    >
      {name.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
};

export default Avatar;
