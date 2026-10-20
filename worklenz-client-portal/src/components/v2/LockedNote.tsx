import type { ReactNode } from 'react';
import { Typography, theme } from '@/shared/antd-imports';
import { LockOutlined } from '@/shared/antd-imports';

/**
 * A short note shown where a control the user's role cannot use would be, e.g.
 * "Client Viewers can't comment." The control is explained, never silently removed.
 */
export const LockedNote = ({ children }: { children: ReactNode }) => {
  const { token } = theme.useToken();
  return (
    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} role="note">
      <LockOutlined aria-hidden style={{ marginRight: token.marginXXS }} />
      {children}
    </Typography.Text>
  );
};
