import React from 'react';
import { theme } from '@/shared/antd-imports';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';

interface PortalLoaderProps {
  /** Minimum height of the centered block, so the page doesn't collapse while loading. */
  minHeight?: number;
}

/** Block-level loading state: the same Worklenz logo loader the Home overview cards use. */
export const PortalLoader = ({ minHeight = 200 }: PortalLoaderProps) => (
  <div style={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <WorklenzLogoLoader />
  </div>
);

interface PortalLoadingOverlayProps {
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * Wraps a table/list and covers it with the Worklenz logo loader while `loading` is true.
 * antd's own `loading` prop mis-centers a large custom indicator, so we overlay it ourselves
 * (same approach as the Home recent-projects list).
 */
export const PortalLoadingOverlay = ({ loading, children }: PortalLoadingOverlayProps) => {
  const { token } = theme.useToken();
  return (
    <div style={{ position: 'relative' }}>
      {children}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: token.colorBgContainer,
            opacity: 0.85,
            zIndex: 5,
          }}
        >
          <WorklenzLogoLoader />
        </div>
      )}
    </div>
  );
};
