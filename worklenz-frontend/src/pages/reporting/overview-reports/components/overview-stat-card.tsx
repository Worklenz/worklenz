import { Card, Flex, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';

interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  loading?: boolean;
}

const OverviewStatCard = React.memo(
  ({ icon, title, children, loading = false }: InsightCardProps) => {
    const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');

    const iconContainerStyle = {
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
    };

    const titleStyle = {
      fontSize: '18px',
      fontWeight: 600,
      color: isDarkMode ? '#ffffff' : '#262626',
      marginBottom: '8px',
      lineHeight: '1.4',
    };

    const decorativeStyle = {
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
    };

    return (
      <div
        className={`overview-stat-card ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
        style={{
          backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
          borderRadius: '0px',
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
