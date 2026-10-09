import React from 'react';
import { Switch, theme } from '@/shared/antd-imports';

interface SettingsToggleRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isLast?: boolean;
}

/** Label + description on the left, a `Switch` on the right, divider between rows. */
export const SettingsToggleRow: React.FC<SettingsToggleRowProps> = ({
  label,
  description,
  checked,
  onChange,
  isLast = false,
}) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: isLast ? 'none' : `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
};

export default SettingsToggleRow;
