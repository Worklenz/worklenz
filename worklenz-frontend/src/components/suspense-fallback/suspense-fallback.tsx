import React, { memo } from 'react';
import { Spin } from 'antd';

// Lightweight loading component - removed heavy theme calculations
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
      }}
    >
      <Spin size="large" />
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
      <Spin size="large" />
    </div>
  );
});

SuspenseFallback.displayName = 'SuspenseFallback';
InlineSuspenseFallback.displayName = 'InlineSuspenseFallback';
