import { Card, Flex, Typography, theme } from '@/shared/antd-imports';
import React, { useMemo } from 'react';

interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  loading?: boolean;
}

const OverviewStatCard = React.memo(
  ({ icon, title, children, loading = false }: InsightCardProps) => {
    const { token } = theme.useToken();
    // Better dark mode detection using multiple token properties
    const isDarkMode =
      token.colorBgContainer === '#1f1f1f' ||
      token.colorBgBase === '#141414' ||
      token.colorBgElevated === '#1f1f1f' ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.classList.contains('dark');

    // Memoize enhanced card styles with dark mode support
    const cardStyles = useMemo(
      () => ({
        body: {
          padding: '24px',
          background: isDarkMode ? '#1f1f1f !important' : '#ffffff !important',
        },
      }),
      [isDarkMode]
    );

    // Memoize card container styles with dark mode support
    const cardContainerStyle = useMemo(
      () => ({
        width: '100%',
        borderRadius: '0px',
        border: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative' as const,
        cursor: 'default',
        backgroundColor: isDarkMode ? '#1f1f1f !important' : '#ffffff !important',
      }),
      [isDarkMode]
    );

    // Memoize icon container styles with dark mode support
    const iconContainerStyle = useMemo(
      () => ({
        padding: '12px',
        borderRadius: '0px',
        background: isDarkMode ? '#2a2a2a' : '#f8f9ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '64px',
        minHeight: '64px',
        boxShadow: isDarkMode
          ? '0 2px 4px rgba(24, 144, 255, 0.2)'
          : '0 2px 4px rgba(24, 144, 255, 0.1)',
        border: isDarkMode ? '1px solid #404040' : '1px solid rgba(24, 144, 255, 0.1)',
      }),
      [isDarkMode]
    );

    // Memoize title styles with dark mode support
    const titleStyle = useMemo(
      () => ({
        fontSize: '18px',
        fontWeight: 600,
        color: isDarkMode ? '#ffffff !important' : '#262626 !important',
        marginBottom: '8px',
        lineHeight: '1.4',
      }),
      [isDarkMode]
    );

    // Memoize decorative element styles with dark mode support
    const decorativeStyle = useMemo(
      () => ({
        position: 'absolute' as const,
        top: 0,
        right: 0,
        width: '60px',
        height: '60px',
        background: isDarkMode
          ? 'linear-gradient(135deg, rgba(24, 144, 255, 0.15) 0%, rgba(24, 144, 255, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(24, 144, 255, 0.05) 0%, rgba(24, 144, 255, 0.02) 100%)',
        opacity: isDarkMode ? 0.8 : 0.6,
        clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)',
      }),
      [isDarkMode]
    );

    return (
      <div
        className={`overview-stat-card ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
        style={{
          backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
          border: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0',
          borderRadius: '0px',
          boxShadow: isDarkMode ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          position: 'relative',
          cursor: 'default',
          width: '100%',
        }}
      >
        <Card
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '0px',
          }}
          styles={{
            body: {
              padding: '24px',
              backgroundColor: 'transparent',
            },
          }}
          loading={loading}
        >
          <Flex gap={20} align="flex-start">
            <div style={iconContainerStyle}>{icon}</div>

            <Flex vertical gap={8} style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text style={titleStyle}>{title}</Typography.Text>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '4px',
                }}
              >
                {children}
              </div>
            </Flex>
          </Flex>

          {/* Decorative element */}
          <div style={decorativeStyle} />
        </Card>
      </div>
    );
  }
);

OverviewStatCard.displayName = 'OverviewStatCard';

export default OverviewStatCard;
