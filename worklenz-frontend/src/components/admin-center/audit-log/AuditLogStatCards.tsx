import React from 'react';
import { Card, Col, Row, Statistic, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { AUDIT_LOG_I18N_NAMESPACE } from '@/shared/audit-log-constants';
import { IAuditLogSummary } from '@/types/admin-center/audit-log.types';

interface AuditLogStatCardsProps {
  summary: IAuditLogSummary | undefined;
  loading: boolean;
  /** Label of the active date filter, e.g. "Last 30 Days". */
  dateLabel: string;
  /** Already-formatted retention window, e.g. "12 months"; undefined while it loads. */
  retentionLabel: string | undefined;
}

export const AuditLogStatCards: React.FC<AuditLogStatCardsProps> = ({
  summary,
  loading,
  dateLabel,
  retentionLabel,
}) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);
  const { token } = theme.useToken();

  const cards = [
    {
      key: 'events',
      title: t('statEvents', { defaultValue: 'Events ({{range}})', range: dateLabel }),
      value: summary?.total ?? 0,
      color: token.colorText,
      loading,
    },
    {
      key: 'failed',
      title: t('statFailedLogins', { defaultValue: 'Failed logins' }),
      value: summary?.failed_logins ?? 0,
      color: token.colorError,
      loading,
    },
    {
      key: 'permission',
      title: t('statPermissionChanges', { defaultValue: 'Permission changes' }),
      value: summary?.by_category.permission ?? 0,
      color: token.colorWarning,
      loading,
    },
    {
      key: 'retention',
      title: t('statRetention', { defaultValue: 'Retention window' }),
      value: retentionLabel ?? '—',
      color: token.colorPrimary,
      loading: retentionLabel === undefined,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map(card => (
        <Col key={card.key} xs={12} lg={6}>
          <Card size="small" style={{ height: '100%' }} styles={{ body: { padding: '14px 18px' } }}>
            <Statistic
              title={card.title}
              value={card.value}
              loading={card.loading}
              valueStyle={{ color: card.color, fontSize: typeof card.value === 'string' ? 18 : 24, fontWeight: 700 }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};
