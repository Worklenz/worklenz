import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ClockCircleOutlined,
  FileDoneOutlined,
  MessageOutlined,
  RightOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Alert, Badge, Button, Card, Col, Empty, Flex, Row, Timeline, Typography, theme } from '@/shared/antd-imports';
import { useGetAuditLogQuery } from '@/api/client-portal/portal-workflow-api';
import { StatCard, formatPortalDateTime } from '@/components/client-portal/v2';
import type { ClientWorkspaceOverview, NeedsAttentionItem } from '@/types/client-portal/v2';
import { portalPaths } from '../../portal-paths';
import type { WorkspaceTab } from './workspace-helpers';
import { PortalLoader } from '@/components/client-portal/v2';

interface OverviewTabProps {
  overview: ClientWorkspaceOverview;
  organizationId: string;
  onOpenTab: (tab: WorkspaceTab) => void;
}

const ATTENTION_ICONS: Record<NeedsAttentionItem['kind'], React.ReactNode> = {
  invite_expired: <ClockCircleOutlined />,
  approval_awaiting: <FileDoneOutlined />,
  change_request_review: <SwapOutlined />,
  unread_message: <MessageOutlined />,
};

/** What is waiting on staff for this client, and what happened recently. */
export const OverviewTab = ({ overview, organizationId, onOpenTab }: OverviewTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-clients');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const audit = useGetAuditLogQuery({ organization_id: organizationId, limit: 6 });
  const events = audit.data?.body?.items ?? [];
  const attention = overview.needs_attention;

  const openItem = (item: NeedsAttentionItem) => {
    switch (item.target.type) {
      case 'user':
        onOpenTab('users');
        break;
      case 'approval':
        navigate(portalPaths.approval(item.target.id));
        break;
      case 'change_request':
        navigate(portalPaths.changeRequest(item.target.id));
        break;
      default:
        navigate(portalPaths.discussion(item.target.id));
    }
  };

  const describe = (item: NeedsAttentionItem): { text: string; sub: string | null } => {
    switch (item.kind) {
      case 'invite_expired':
        return {
          text: item.flag
            ? t('overview.attention.inviteExpiredAsked', {
                name: item.label,
                defaultValue: '{{name}}’s invitation expired and they asked for a new link',
              })
            : t('overview.attention.inviteExpired', {
                name: item.label,
                defaultValue: '{{name}}’s invitation expired',
              }),
          sub: null,
        };
      case 'approval_awaiting':
        return {
          text: t('overview.attention.approvalAwaiting', {
            title: item.label,
            approver: item.detail ?? t('overview.attention.theClient', { defaultValue: 'the client' }),
            defaultValue: '“{{title}}” is waiting for {{approver}}',
          }),
          sub: null,
        };
      case 'change_request_review':
        return {
          text: t('overview.attention.changeRequestReview', {
            title: item.label,
            defaultValue: '“{{title}}” needs your review',
          }),
          sub: item.detail,
        };
      default:
        return {
          text: t('overview.attention.unreadMessage', { defaultValue: 'Unread client message' }),
          sub: [item.detail, item.label].filter(Boolean).join(' · ') || null,
        };
    }
  };

  return (
    <Flex vertical gap={16}>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <StatCard
            label={t('overview.stats.portalProjects', { defaultValue: 'Portal projects' })}
            value={overview.stats.portal_projects}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            label={t('overview.stats.awaiting', { defaultValue: 'Awaiting client action' })}
            value={overview.stats.awaiting_client_action}
            tone={overview.stats.awaiting_client_action > 0 ? 'warning' : 'default'}
            sub={t('overview.stats.awaitingSub', { defaultValue: 'Approvals and info requests' })}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            label={t('overview.stats.openChangeRequests', { defaultValue: 'Open change requests' })}
            value={overview.stats.open_change_requests}
          />
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Flex align="center" gap={8}>
            {t('overview.attention.title', { defaultValue: 'Needs attention' })}
            {attention.length > 0 && <Badge count={attention.length} color={token.colorWarning} />}
          </Flex>
        }
      >
        {attention.length === 0 ? (
          <Typography.Text type="secondary">
            {t('overview.attention.empty', {
              name: overview.organization.name,
              defaultValue: 'Nothing is waiting on you for {{name}}.',
            })}
          </Typography.Text>
        ) : (
          attention.map(item => {
            const { text, sub } = describe(item);
            return (
              <Button
                key={`${item.kind}-${item.target.id}`}
                type="text"
                block
                onClick={() => openItem(item)}
                style={{ height: 'auto', padding: '10px 4px', textAlign: 'left', borderRadius: 0 }}
              >
                <Flex align="center" gap={10}>
                  <span style={{ color: token.colorWarning }}>{ATTENTION_ICONS[item.kind]}</span>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'normal' }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{text}</span>
                    {sub && (
                      <span style={{ display: 'block', fontSize: 11.5, color: token.colorTextSecondary }}>
                        {sub}
                      </span>
                    )}
                  </span>
                  <RightOutlined style={{ color: token.colorTextTertiary }} />
                </Flex>
              </Button>
            );
          })
        )}
      </Card>

      <Card size="small" title={t('overview.recent.title', { defaultValue: 'Recent activity' })}>
        {audit.isLoading ? (
          <PortalLoader />
        ) : audit.isError ? (
          <Alert
            type="error"
            showIcon
            message={t('overview.recent.error', { defaultValue: 'Recent activity could not be loaded.' })}
            action={
              <Button size="small" onClick={() => audit.refetch()}>
                {t('retry', { defaultValue: 'Retry' })}
              </Button>
            }
          />
        ) : events.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('overview.recent.empty', { defaultValue: 'No activity yet.' })}
          />
        ) : (
          <Timeline
            items={events.map(event => ({
              key: event.id,
              children: (
                <div>
                  <div style={{ fontSize: 13 }}>
                    <strong>{event.actor}</strong> · {event.event}
                  </div>
                  <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{event.target}</div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                    {formatPortalDateTime(event.at, i18n.language)}
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </Flex>
  );
};

