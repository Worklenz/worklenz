import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = rect.top + scrollY - 4;
        left = rect.left + scrollX + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + scrollY + 4;
        left = rect.left + scrollX + rect.width / 2;
        break;
      case 'left':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.left + scrollX - 4;
        break;
      case 'right':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.right + scrollX + 4;
        break;
    }

    setCoords({ top, left });
  }, [placement]);

  const handleMouseEnter = useCallback(() => {
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  const transformMap = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible &&
        title &&
        createPortal(
          <div
            className={`fixed px-2 py-1 text-xs text-white rounded-sm shadow-lg pointer-events-none whitespace-nowrap ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-900'
            }`}
            style={{
              top: coords.top,
              left: coords.left,
              transform: transformMap[placement],
              zIndex: 99999,
            }}
          >
            {title}
          </div>,
          document.body
        )}
    </div>
  );
};

export default Tooltip;
