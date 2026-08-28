import { ReactNode } from 'react';
import { theme, Typography } from '@/shared/antd-imports';

interface SettingsCardProps {
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}

/**
 * Flat bordered card matching the app's modern design language (see
 * HomeStatCards / HomeContinueCard): token-driven colors, ~10px radius,
 * border instead of shadow, dense spacing. Used to group related settings
 * fields instead of stacking them under bare Dividers.
 */
const SettingsCard = ({ title, description, extra, children, style }: SettingsCardProps) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        padding: 16,
        background: token.colorBgContainer,
        ...style,
      }}
    >
      {(title || extra) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: description ? 4 : 12,
          }}
        >
          {title && (
            <Typography.Text style={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography.Text>
          )}
          {extra}
        </div>
      )}
      {description && (
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12, display: 'block', marginBottom: 12 }}
        >
          {description}
        </Typography.Text>
      )}
      {children}
    </div>
  );
};

export default SettingsCard;
