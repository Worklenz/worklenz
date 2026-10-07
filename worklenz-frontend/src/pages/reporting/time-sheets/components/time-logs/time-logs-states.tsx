import React from 'react';
import { Button, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { formatLoggedDuration } from '@/components/time-entries/time-entries-format';

const { Text } = Typography;

const SECONDS_PER_HOUR = 3600;

interface TimeLogsEmptyStateProps {
  /** The load failed: offer a retry instead of claiming nothing was logged. */
  failed: boolean;
  onRetry: () => void;
  /** Offered when something is narrowing the result. */
  onClearFilters?: () => void;
}

/**
 * What the table and the grouped list show in place of rows. It carries an action, so it gets
 * real text colours (antd would paint a table's own placeholder in the *disabled* colour) —
 * readable in light and dark.
 */
export const TimeLogsEmptyState: React.FC<TimeLogsEmptyStateProps> = ({
  failed,
  onRetry,
  onClearFilters,
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();

  if (failed) {
    return (
      <div
        style={{ padding: '32px 16px', textAlign: 'center', color: token.colorText }}
        role="alert"
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          {t('timeLogsLoadError', { defaultValue: "Couldn't load the time logs" })}
        </div>
        <Button type="primary" size="small" onClick={onRetry}>
          {t('timeLogsRetry', { defaultValue: 'Retry' })}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: token.colorText }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {t('timeLogsEmptyTitle', { defaultValue: 'No time logged for these filters' })}
      </div>
      <p style={{ color: token.colorTextSecondary, fontSize: 12, margin: '0 0 16px' }}>
        {t('timeLogsEmptyHint', {
          defaultValue: 'Try a different date range or clear some filters.',
        })}
      </p>
      {onClearFilters && (
        <Button size="small" onClick={onClearFilters}>
          {t('timeLogsClearFilters', { defaultValue: 'Clear filters' })}
        </Button>
      )}
    </div>
  );
};

interface TimeLogsTotalValueProps {
  totalSeconds: number;
  failed: boolean;
}

/** The total time logged — "12h 30m" with the decimal hours beneath — as the footer shows it. */
export const TimeLogsTotalValue: React.FC<TimeLogsTotalValueProps> = ({ totalSeconds, failed }) => {
  const { t } = useTranslation('time-report');
  const hours = totalSeconds / SECONDS_PER_HOUR;
  return (
    // a live region, so a changed total is announced when the filters change
    <div role="status" aria-live="polite">
      <Text strong style={{ fontSize: 14, display: 'block', lineHeight: 1.3 }}>
        {failed ? '—' : formatLoggedDuration(totalSeconds)}
      </Text>
      {!failed && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          ({t('timeLogsHoursShort', { defaultValue: '{{hours}} h', hours: hours.toFixed(2) })})
        </Text>
      )}
    </div>
  );
};
