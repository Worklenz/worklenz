import React from 'react';

interface Props {
  /** Whether the gated feature is available for the current edition/plan. */
  enabled: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Edition-neutral gate: renders children when enabled, otherwise the fallback. The same
 * implementation is used in CE and EE — only the `enabled` value (from useBusinessFeatures)
 * differs between editions.
 */
const UpgradeGate: React.FC<Props> = ({ enabled, fallback = null, children }) =>
  enabled ? <>{children}</> : <>{fallback}</>;

export default UpgradeGate;
