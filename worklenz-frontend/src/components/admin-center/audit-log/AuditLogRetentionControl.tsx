import React from 'react';
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Flex,
  Modal,
  Select,
  Skeleton,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { CaretDownFilled, CheckOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  useGetAuditLogRetentionQuery,
  useUpdateAuditLogRetentionMutation,
} from '@/api/admin-center/audit-log.api.service';
import { AUDIT_LOG_I18N_NAMESPACE } from '@/shared/audit-log-constants';
import { IAuditLogRetention } from '@/types/admin-center/audit-log.types';
import logger from '@/utils/errorLogger';
import { formatRetentionMonths } from './audit-log-display';

interface AuditLogRetentionControlProps {
  /** `pill` sits in the Audit Log header (mockup); `card` lives in workspace settings. */
  variant: 'pill' | 'card';
}

export const AuditLogRetentionControl: React.FC<AuditLogRetentionControlProps> = ({ variant }) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);
  const { data: retention, isLoading, isError, refetch } = useGetAuditLogRetentionQuery();
  const handleChange = useRetentionChange(t, retention);

  if (isLoading) {
    return variant === 'pill' ? (
      <Skeleton.Button active size="small" style={{ width: 170 }} />
    ) : (
      <Card>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  if (isError || !retention) {
    const errorContent = (
      <Flex align="center" gap={8}>
        <Typography.Text type="danger">
          {t('retentionLoadError', { defaultValue: "Couldn't load the retention setting" })}
        </Typography.Text>
        <Button size="small" onClick={() => refetch()}>
          {t('retry', { defaultValue: 'Retry' })}
        </Button>
      </Flex>
    );
    return variant === 'pill' ? errorContent : <Card>{errorContent}</Card>;
  }

  return variant === 'pill' ? (
    <RetentionPill t={t} retention={retention} onChange={handleChange} />
  ) : (
    <RetentionCard t={t} retention={retention} onChange={handleChange} />
  );
};

interface RetentionViewProps {
  t: TFunction;
  retention: IAuditLogRetention;
  onChange: (months: number) => void;
}

const RetentionPill: React.FC<RetentionViewProps> = ({ t, retention, onChange }) => {
  const { token } = theme.useToken();
  const [open, setOpen] = React.useState(false);
  const label = (
    <>
      <span style={{ color: token.colorTextSecondary, fontWeight: 400 }}>
        {t('retentionLabel', { defaultValue: 'Retention:' })}
      </span>{' '}
      {formatRetentionMonths(t, retention.retention_months)}
    </>
  );

  if (!retention.can_edit) {
    return (
      <Tooltip title={t('retentionOwnerOnly', { defaultValue: 'Only the workspace owner can change retention.' })}>
        <Button icon={<LockOutlined />} aria-disabled="true">
          {label}
        </Button>
      </Tooltip>
    );
  }

  const menuItems = retention.options.map(months => ({
    key: String(months),
    label: (
      <Flex justify="space-between" align="center" gap={12}>
        <span>
          {formatRetentionMonths(t, months)}
          {months === retention.default_months && (
            <Typography.Text type="secondary" style={{ fontSize: 12, marginInlineStart: 6 }}>
              {t('retentionDefaultSuffix', { defaultValue: '(default)' })}
            </Typography.Text>
          )}
        </span>
        {months === retention.retention_months && <CheckOutlined style={{ color: token.colorPrimary }} />}
      </Flex>
    ),
  }));

  return (
    <Dropdown
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      menu={{
        items: menuItems,
        selectable: true,
        selectedKeys: [String(retention.retention_months)],
        onClick: ({ key }) => {
          setOpen(false);
          onChange(Number(key));
        },
      }}
      popupRender={menu => (
        <div
          style={{
            width: 260,
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
          }}
        >
          {React.cloneElement(menu as React.ReactElement<{ style?: React.CSSProperties }>, {
            style: { boxShadow: 'none' },
          })}
          <Typography.Paragraph
            type="secondary"
            style={{
              fontSize: 11,
              margin: 0,
              padding: '8px 12px 10px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              lineHeight: 1.4,
            }}
          >
            {t('retentionHint', {
              defaultValue:
                'PCI DSS minimum is {{pciMonths}} months, with the most recent 3 months immediately accessible. Entries are purged by age only — never manually deletable.',
              pciMonths: retention.pci_min_months,
            })}
          </Typography.Paragraph>
        </div>
      )}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </Button>
    </Dropdown>
  );
};

const RetentionCard: React.FC<RetentionViewProps> = ({ t, retention, onChange }) => (
  <Card>
    <Typography.Title level={5} style={{ margin: 0 }}>
      {t('retentionCardTitle', { defaultValue: 'Audit log retention' })}
    </Typography.Title>
    <Typography.Paragraph type="secondary" style={{ margin: '4px 0 16px' }}>
      {t('retentionCardDescription', {
        defaultValue:
          'How long entries in Admin Center > Security > Audit Log are kept. Older entries are purged automatically by age; they can never be edited or deleted by hand.',
      })}
    </Typography.Paragraph>
    <Flex vertical gap={12} style={{ maxWidth: 420 }}>
      <Select
        value={retention.retention_months}
        onChange={onChange}
        aria-label={t('retentionCardTitle', { defaultValue: 'Audit log retention' })}
        options={retention.options.map(months => ({
          value: months,
          label:
            months === retention.default_months
              ? `${formatRetentionMonths(t, months)} ${t('retentionDefaultSuffix', { defaultValue: '(default)' })}`
              : formatRetentionMonths(t, months),
        }))}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('retentionDefaultNote', {
          defaultValue: 'Default: {{months}}. PCI DSS requires at least {{pciMonths}} months.',
          months: formatRetentionMonths(t, retention.default_months),
          pciMonths: retention.pci_min_months,
        })}
      </Typography.Text>
      {retention.retention_months < retention.pci_min_months && (
        <Alert
          type="warning"
          showIcon
          message={t('retentionBelowPciWarning', {
            defaultValue: 'This is shorter than the PCI DSS minimum of {{pciMonths}} months.',
            pciMonths: retention.pci_min_months,
          })}
        />
      )}
    </Flex>
  </Card>
);

/** Saves a new retention window, confirming first when it would purge existing entries sooner. */
const useRetentionChange = (t: TFunction, retention: IAuditLogRetention | undefined) => {
  const [updateRetention] = useUpdateAuditLogRetentionMutation();

  const save = async (months: number) => {
    try {
      await updateRetention(months).unwrap();
      message.success(
        t('retentionUpdated', {
          defaultValue: 'Retention window updated to {{months}}. Entries older than this will be purged on the next cycle.',
          months: formatRetentionMonths(t, months),
        })
      );
    } catch (error) {
      logger.error('Error updating audit log retention', error);
      message.error(t('retentionUpdateError', { defaultValue: "Couldn't update the retention window. Please try again." }));
    }
  };

  return (months: number) => {
    if (!retention || months === retention.retention_months) return;

    if (months > retention.retention_months) {
      void save(months);
      return;
    }

    Modal.confirm({
      title: t('retentionShortenTitle', { defaultValue: 'Shorten audit log retention?' }),
      content: t('retentionShortenContent', {
        defaultValue:
          'Entries older than {{months}} will be permanently purged on the next retention cycle. This cannot be undone.',
        months: formatRetentionMonths(t, months),
      }),
      okText: t('retentionShortenConfirm', { defaultValue: 'Shorten retention' }),
      okButtonProps: { danger: true },
      cancelText: t('cancel', { defaultValue: 'Cancel' }),
      onOk: () => save(months),
    });
  };
};
