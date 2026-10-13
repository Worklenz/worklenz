import { Card, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { ViewLargerButton, WidgetViewLargerModal } from '@/components/dashboard-grid';

interface InsightCardProps {
  /** Short, meaningful label for the card. Truncates with an ellipsis; use `tooltip` for the full text. */
  title: string;
  /** Text shown on hover over the title. Falls back to `title` when omitted. */
  tooltip?: React.ReactNode;
  /** The big stat number/value shown below the title. */
  value?: React.ReactNode;
  /** Overrides the value's color (e.g. to flag a non-zero overdue count in red). */
  valueColor?: string;
  children?: React.ReactNode;
  loading?: boolean;
}

const OverviewStatCard = React.memo(
  ({ title, tooltip, value, valueColor, children, loading = false }: InsightCardProps) => {
    const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
    const [viewLarger, setViewLarger] = useState(false);

    const titleStyle = {
      fontSize: '12px',
      fontWeight: 600,
      color: isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
      lineHeight: '1.3',
    };

    const valueStyle = {
      fontSize: '20px',
      fontWeight: 600,
      color: valueColor ?? (isDarkMode ? '#ffffff' : '#262626'),
      lineHeight: '1.2',
    };

    const body = loading ? (
      <Flex align="center" justify="center" style={{ minHeight: 56 }}>
        <WorklenzLogoLoader scale={0.4} />
      </Flex>
    ) : (
      <Flex vertical gap={2}>
        <Tooltip title={tooltip ?? title}>
          <Typography.Text style={titleStyle} ellipsis>
            {title}
          </Typography.Text>
        </Tooltip>

        {value !== undefined && <Typography.Text style={valueStyle}>{value}</Typography.Text>}

        {children && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>{children}</div>
        )}
      </Flex>
    );

    return (
      <div
        className={`overview-stat-card ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
        style={{
          backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
          borderRadius: '8px',
          transition: 'box-shadow 0.2s ease',
          overflow: 'hidden',
          position: 'relative',
          cursor: 'default',
          width: '100%',
          height: '100%',
        }}
      >
        <ViewLargerButton
          title={title}
          i18nNamespace="reporting-overview"
          onClick={() => setViewLarger(true)}
          className="overview-stat-card-view-larger"
        />
        <Card
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            height: '100%',
          }}
          styles={{
            body: {
              padding: '8px 16px',
              backgroundColor: 'transparent',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            },
          }}
        >
          {body}
        </Card>
        <WidgetViewLargerModal title={title} open={viewLarger} onClose={() => setViewLarger(false)}>
          <Flex align="center" justify="center" style={{ height: '100%' }}>
            <Flex vertical align="center" gap={8}>
              <Typography.Text style={{ ...titleStyle, fontSize: 16 }}>{title}</Typography.Text>
              {value !== undefined && <Typography.Text style={{ ...valueStyle, fontSize: 56 }}>{value}</Typography.Text>}
            </Flex>
          </Flex>
        </WidgetViewLargerModal>
      </div>
    );
  }
);

OverviewStatCard.displayName = 'OverviewStatCard';

export default OverviewStatCard;
