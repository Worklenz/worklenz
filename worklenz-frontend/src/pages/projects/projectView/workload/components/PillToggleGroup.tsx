import { theme } from '@/shared/antd-imports';

// Pill-style toggle button group, mirroring GanttToolbar.tsx's PillToggleGroup
// (Roadmap tab). Shared across the workload feature so every toggle here reads
// as one consistent control (view switcher, chart type, etc.).
export interface PillOption<T extends string> {
  label: string;
  value: T;
}

interface PillToggleGroupProps<T extends string> {
  value: T;
  options: PillOption<T>[];
  onChange: (value: T) => void;
}

function PillToggleGroup<T extends string>({ value, options, onChange }: PillToggleGroupProps<T>) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        maxWidth: '100%',
        overflowX: 'auto',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 7,
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

export default PillToggleGroup;
