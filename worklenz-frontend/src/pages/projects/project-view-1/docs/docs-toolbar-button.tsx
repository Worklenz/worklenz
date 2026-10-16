import { Tooltip } from '@/shared/antd-imports';
import { forwardRef, ReactNode } from 'react';

interface ToolbarButtonProps {
  label: string;
  active: boolean;
  disabled?: boolean;
  tooltipOpen?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ label, active, disabled = false, tooltipOpen, onClick, children, ...props }, ref) => (
    <Tooltip title={label} placement="bottom" open={tooltipOpen}>
      <button
        {...props}
        ref={ref}
        type="button"
        className={['docs-tool-btn', active ? 'is-active' : ''].filter(Boolean).join(' ')}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  )
);

ToolbarButton.displayName = 'ToolbarButton';

export const ToolbarDivider = () => <span className="docs-tool-sep" aria-hidden="true" />;
