import { memo } from 'react';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';

export const SuspenseFallback = memo(() => (
  <div
    style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100vw', height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      zIndex: 9999,
    }}
  >
    <WorklenzLogoLoader />
  </div>
));

export const InlineSuspenseFallback = memo(() => (
  <div
    style={{
      padding: '40px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '200px',
    }}
  >
    <WorklenzLogoLoader />
  </div>
));

SuspenseFallback.displayName = 'SuspenseFallback';
InlineSuspenseFallback.displayName = 'InlineSuspenseFallback';