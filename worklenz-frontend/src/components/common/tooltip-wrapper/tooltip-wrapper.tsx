import React from 'react';
import { Tooltip, TooltipProps } from '@/shared/antd-imports';

interface TooltipWrapperProps extends Omit<TooltipProps, 'children'> {
  children: React.ReactElement;
}

/**
 * TooltipWrapper - A wrapper component that helps avoid findDOMNode warnings in React StrictMode
 *
 * This component ensures that the child element can properly receive refs from Ant Design's Tooltip
 * by wrapping it in a div with a ref when necessary.
 */
const TooltipWrapper = React.forwardRef<HTMLDivElement, TooltipWrapperProps>(
  ({ children, ...tooltipProps }, ref) => {
    return (
      <Tooltip {...tooltipProps}>
        <div ref={ref} style={{ display: 'inline-block' }}>
          {children}
        </div>
      </Tooltip>
    );
  }
);

TooltipWrapper.displayName = 'TooltipWrapper';

export default TooltipWrapper;
