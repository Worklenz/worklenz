import React from 'react';
import { Button, Card, theme, type MenuProps } from '@/shared/antd-imports';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { useTranslation } from 'react-i18next';
import { HomeWidgetMenuButton } from './HomeWidgetMenuButton';
import './home-widgets.css';

// Shared chrome for the widgets a user can add to the Home overview: the same card, title and
// loading / empty / error states, so they look alike and each widget only supplies its content.

/** Room for the loader, so a widget doesn't jump in height once its data arrives. */
const LOADING_MIN_HEIGHT = 160;

interface HomeWidgetCardProps {
  title: string;
  /** Controls shown in the header, just before the "..." menu. */
  extra?: React.ReactNode;
  /** Entries of the widget's own for its "..." menu, listed above the ones every widget has. */
  menuItems?: MenuProps['items'];
  children: React.ReactNode;
}

export const HomeWidgetCard: React.FC<HomeWidgetCardProps> = ({ title, extra, menuItems, children }) => {
  const { token } = theme.useToken();
  return (
    <Card
      style={{ borderRadius: 10, border: `1px solid ${token.colorBorderSecondary}` }}
      styles={{ body: { padding: 20 } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {extra}
        <HomeWidgetMenuButton extraItems={menuItems} />
      </div>
      {children}
    </Card>
  );
};

/** The Worklenz logo loader, the same one Today's Priorities shows while its data loads. */
export const WidgetLoading: React.FC = () => (
  <div data-widget-data style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: LOADING_MIN_HEIGHT }}>
    <WorklenzLogoLoader />
  </div>
);

interface WidgetMessageProps {
  text: string;
  action?: React.ReactNode;
}

/** An empty list: say so plainly, and offer the next step if there is one. */
export const WidgetEmpty: React.FC<WidgetMessageProps> = ({ text, action }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0 4px' }}>
      <div style={{ fontSize: 13, textAlign: 'center', color: token.colorTextSecondary }}>{text}</div>
      {action}
    </div>
  );
};

/** The widget could not load: explain, and let the user try again. */
export const WidgetError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const { t } = useTranslation('home');
  return (
    <WidgetEmpty
      text={t('widgets.state.error', { defaultValue: "Couldn't load this widget." })}
      action={
        <Button size="small" onClick={onRetry}>
          {t('widgets.state.retry', { defaultValue: 'Retry' })}
        </Button>
      }
    />
  );
};
