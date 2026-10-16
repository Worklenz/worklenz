import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Empty, Skeleton, theme } from '@/shared/antd-imports';
import { StatCard, type StatTone } from '@/components/client-portal/v2/StatCard';
import type { OverviewWidgetKey, OverviewWidgetResult } from '@/types/client-portal/v2/overview';

export const OVERVIEW_NS = 'client-portal-v2-overview';

/** What every widget component receives from the grid. */
export interface WidgetProps<K extends OverviewWidgetKey> {
  result: OverviewWidgetResult<K> | undefined;
  loading: boolean;
  onRetry: () => void;
}

type Status<D> = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'data'; data: D };

export const resolveStatus = <D,>(
  result: { data: D } | { error: string } | undefined,
  loading: boolean
): Status<D> => {
  if (result && 'data' in result) return { kind: 'data', data: result.data };
  if (result && 'error' in result) return { kind: 'error', message: result.error };
  // No block at all: still loading, or the whole request failed (the page shows its own error).
  return loading ? { kind: 'loading' } : { kind: 'error', message: '' };
};

const ErrorState = ({ onRetry, message }: { onRetry: () => void; message: string }) => {
  const { t } = useTranslation(OVERVIEW_NS);
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={message || t('widget.error', { defaultValue: 'This widget could not be loaded.' })}
    >
      <Button size="small" onClick={onRetry}>
        {t('widget.retry', { defaultValue: 'Retry' })}
      </Button>
    </Empty>
  );
};

interface WidgetFrameProps<D> {
  title: string;
  viewAllTo?: string;
  status: Status<D>;
  onRetry: () => void;
  /** True when there is nothing to list; renders `emptyText` instead of `children`. */
  isEmpty?: (data: D) => boolean;
  emptyText?: string;
  children: (data: D) => React.ReactNode;
}

/** Shared chrome of the list and chart widgets: title, "View all" link, loading / error / empty states. */
export function WidgetFrame<D>({
  title,
  viewAllTo,
  status,
  onRetry,
  isEmpty,
  emptyText,
  children,
}: WidgetFrameProps<D>) {
  const { t } = useTranslation(OVERVIEW_NS);

  return (
    <Card
      size="small"
      title={title}
      extra={
        viewAllTo ? <Link to={viewAllTo}>{t('widget.viewAll', { defaultValue: 'View all' })}</Link> : null
      }
      styles={{ body: { padding: 12, flex: 1, minHeight: 0, overflow: 'auto' } }}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {status.kind === 'loading' && <Skeleton active paragraph={{ rows: 3 }} title={false} />}
      {status.kind === 'error' && <ErrorState onRetry={onRetry} message={status.message} />}
      {status.kind === 'data' &&
        (isEmpty?.(status.data) ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
        ) : (
          children(status.data)
        ))}
    </Card>
  );
}

interface WidgetRowProps {
  to: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  unread?: boolean;
}

/** One clickable row of a list widget. */
export const WidgetRow = ({ to, title, subtitle, right, unread }: WidgetRowProps) => {
  const { token } = theme.useToken();
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 4px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        color: token.colorText,
        borderRadius: token.borderRadius,
      }}
    >
      {unread !== undefined && (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            flex: 'none',
            borderRadius: '50%',
            background: unread ? token.colorPrimary : 'transparent',
          }}
        />
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontWeight: unread ? 600 : 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {subtitle != null && (
          <span
            style={{
              display: 'block',
              fontSize: 12,
              color: token.colorTextSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
      {right != null && <span style={{ flex: 'none', fontSize: 12 }}>{right}</span>}
    </Link>
  );
};

interface KpiFrameProps<D> {
  label: string;
  status: Status<D>;
  onRetry: () => void;
  to: string;
  onNavigate: (to: string) => void;
  render: (data: D) => { value: React.ReactNode; sub?: React.ReactNode; tone?: StatTone };
}

/** A stat-card widget: the shared StatCard, or a same-sized loading / error card. */
export function KpiFrame<D>({ label, status, onRetry, to, onNavigate, render }: KpiFrameProps<D>) {
  const { t } = useTranslation(OVERVIEW_NS);

  if (status.kind === 'data') {
    const { value, sub, tone } = render(status.data);
    return <StatCard label={label} value={value} sub={sub} tone={tone} onClick={() => onNavigate(to)} />;
  }

  return (
    <Card size="small" styles={{ body: { padding: 16 } }} style={{ height: '100%' }}>
      <div style={{ fontSize: 12 }}>{label}</div>
      {status.kind === 'loading' ? (
        <Skeleton.Input active size="small" style={{ marginTop: 6 }} />
      ) : (
        <Button type="link" size="small" onClick={onRetry} style={{ padding: 0 }}>
          {t('widget.retry', { defaultValue: 'Retry' })}
        </Button>
      )}
    </Card>
  );
}
