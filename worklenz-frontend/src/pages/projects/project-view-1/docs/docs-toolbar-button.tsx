import { Tooltip } from '@/shared/antd-imports';
import { forwardRef, ReactNode } from 'react';

interface ToolbarButtonProps {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ label, active, disabled = false, onClick, children, ...props }, ref) => (
    <Tooltip title={label} placement="bottom">
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
