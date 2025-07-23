import React, { memo } from 'react';
import { Skeleton } from '@/shared/antd-imports';

// Lightweight loading component with skeleton animation
export const SuspenseFallback = memo(() => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <Skeleton
          active
          paragraph={{ rows: 3, width: ['100%', '80%', '60%'] }}
          title={{ width: '70%' }}
        />
      </div>
    </div>
  );
});

// Lightweight fallback for internal components that doesn't cover the screen
export const InlineSuspenseFallback = memo(() => {
  return (
    <div
      style={{
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '300px' }}>
        <Skeleton active paragraph={{ rows: 2, width: ['100%', '70%'] }} title={{ width: '60%' }} />
      </div>
    </div>
  );
});

SuspenseFallback.displayName = 'SuspenseFallback';
InlineSuspenseFallback.displayName = 'InlineSuspenseFallback';
