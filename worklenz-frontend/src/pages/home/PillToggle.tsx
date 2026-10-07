import React from 'react';
import { theme } from '@/shared/antd-imports';

export interface PillToggleOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface PillToggleProps<T extends string> {
  value: T;
  options: PillToggleOption<T>[];
  onChange: (v: T) => void;
  style?: React.CSSProperties;
  /** Give every segment the same width instead of sizing to its label — keeps
   * short/long labels (e.g. "Today" vs "This Week") from making the pill look lopsided. */
  equalWidth?: boolean;
  /** Accessible name for the radiogroup (e.g. "View mode"). Optional — omit
   * when a visible label already precedes the control. */
  ariaLabel?: string;
}

// Mirrors HomeContinueCard's tab bar styling exactly so every toggle on the
// home page reads as one consistent control.
//
// Implements the WAI-ARIA radiogroup pattern (role="radiogroup" / role="radio"
// with a roving tabindex and Left/Right/Home/End keyboard navigation) so this
// behaves like antd's Segmented for screen readers and keyboard users.
function PillToggle<T extends string>({
  value,
  options,
  onChange,
  style,
  equalWidth,
  ariaLabel,
}: PillToggleProps<T>) {
  const { token } = theme.useToken();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
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
    const next = options[nextIdx];
    onChange(next.value);
    // Move focus to the newly-selected pill, matching native radio-group behavior.
    const group = event.currentTarget.parentElement;
    const nextButton = group?.children[nextIdx] as HTMLButtonElement | undefined;
    nextButton?.focus();
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
