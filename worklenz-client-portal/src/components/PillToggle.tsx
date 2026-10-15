import React from 'react';
import { theme } from '@/shared/antd-imports';

export interface PillToggleOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface PillToggleProps<T extends string> {
  value: T;
  options: PillToggleOption<T>[];
  onChange: (value: T) => void;
  style?: React.CSSProperties;
  /** Give every segment the same width instead of sizing to its label. */
  equalWidth?: boolean;
  /** Accessible name for the radiogroup. */
  ariaLabel?: string;
}

/**
 * Segmented pill toggle, the same control as the admin app's PillToggle. The selected segment uses the
 * theme's primary colour, which carries the operator's branding. Implements the WAI-ARIA radiogroup pattern
 * (roving tabindex, Left/Right/Up/Down/Home/End).
 */
function PillToggle<T extends string>({ value, options, onChange, style, equalWidth, ariaLabel }: PillToggleProps<T>) {
  const { token } = theme.useToken();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIdx = (idx + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIdx = (idx - 1 + options.length) % options.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(options[nextIdx].value);
    (event.currentTarget.parentElement?.children[nextIdx] as HTMLButtonElement | undefined)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 7,
        overflow: 'hidden',
        ...style,
      }}
    >
      {options.map((opt, idx) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={event => handleKeyDown(event, idx)}
            style={{
              padding: '5px 12px',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              flex: equalWidth ? 1 : undefined,
              textAlign: equalWidth ? 'center' : undefined,
              borderRight: idx < options.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
              background: selected ? token.colorPrimary : 'transparent',
              color: selected ? token.colorTextLightSolid : token.colorText,
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default PillToggle;
