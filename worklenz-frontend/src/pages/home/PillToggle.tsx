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
}

// Mirrors HomeContinueCard's tab bar styling exactly so every toggle on the
// home page reads as one consistent control.
function PillToggle<T extends string>({
  value,
  options,
  onChange,
  style,
  equalWidth,
}: PillToggleProps<T>) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 7,
        overflow: 'hidden',
        ...style,
      }}
    >
      {options.map((opt, idx) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '5px 12px',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            flex: equalWidth ? 1 : undefined,
            textAlign: equalWidth ? 'center' : undefined,
            borderRight: idx < options.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
            background: value === opt.value ? token.colorPrimary : 'transparent',
            color: value === opt.value ? token.colorTextLightSolid : token.colorText,
            transition: 'all .15s',
            whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default PillToggle;
