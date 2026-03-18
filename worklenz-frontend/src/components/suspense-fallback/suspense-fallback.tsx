import { memo } from 'react';

// Keyframes for shimmer animation (left to right like Ant Design Skeleton)
const pulseKeyframes = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    20% { opacity: 0.2; }
  }
`;

// Custom angled lines loader component
const WorklenzLogoLoader = memo(() => {
  return (
    <>
      <style>{pulseKeyframes}</style>
      <div
        role="status"
        style={{
          display: 'flex',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          marginLeft: '-36px', // -space-x-19.5 equivalent (19.5 * 4 = 78px)
        }}
      >
        {/* First 45-degree angled line */}
        <div
          style={{
            zIndex: 0,
            height: '16px', // h-7.5 = 7.5 * 4 = 16px
            width: '64px', // w-32 = 32 * 4 = 64px
            transform: 'rotate(65deg)',
            borderRadius: '9999px',
            backgroundColor: '#9ca3af', // gray-400
          }}
        />
        {/* Second parallel 45-degree angled line */}
        <div
          style={{
            zIndex: 2,
            height: '16px',
            width: '64px',
            transform: 'rotate(65deg)',
            borderRadius: '9999px',
            backgroundColor: '#9ca3af', // gray-400
            marginLeft: '-37px',
          }}
        />
        {/* Third angled line */}
        <div
          style={{
            zIndex: 1,
            height: '16px',
            width: '64px',
            transform: 'rotate(-65deg)',
            borderRadius: '9999px',
            backgroundColor: '#93c5fd', // blue-300
            marginLeft: '-43px',
          }}
        />
        <span
          className="sr-only"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        >
          Loading...
        </span>
      </div>
    </>
  );
});

WorklenzLogoLoader.displayName = 'WorklenzLogoLoader';

// Lightweight loading component with custom angled lines animation
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
      <WorklenzLogoLoader />
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
      <WorklenzLogoLoader />
    </div>
  );
});

SuspenseFallback.displayName = 'SuspenseFallback';
InlineSuspenseFallback.displayName = 'InlineSuspenseFallback';
