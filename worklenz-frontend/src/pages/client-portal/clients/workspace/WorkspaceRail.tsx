import type { ReactNode } from 'react';
import { CheckSquareOutlined, FileTextOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type {
  ClientWorkspaceProfile,
  ClientWorkspaceStats,
} from '@/api/client-portal/client-workspace-api';
import { fromNow } from '@/utils/dateUtils';
import { WorkspaceTab, getClientDisplayName } from './workspace-helpers';

const { Text } = Typography;

interface WorkspaceRailProps {
  profile: ClientWorkspaceProfile;
  stats: ClientWorkspaceStats | undefined;
  isStatsLoading: boolean;
  onOpenTab: (tab: WorkspaceTab) => void;
}

interface RailRow {
  key: string;
  label: string;
  value: ReactNode;
}

/** The left column: who the client is, how their portal is doing, and the common next steps. */
export const WorkspaceRail = ({
  profile,
  stats,
  isStatsLoading,
  onOpenTab,
}: WorkspaceRailProps) => {
  const { t } = useTranslation('client-portal-client-workspace');
  const { token } = theme.useToken();

  const contactRows: RailRow[] = [
    {
      key: 'email',
      label: t('rail.email', { defaultValue: 'Email' }),
      value: profile.email?.trim() || '—',
    },
    {
      key: 'company',
      label: t('rail.company', { defaultValue: 'Company' }),
      value: getClientDisplayName(profile),
    },
    {
      key: 'projects',
      label: t('rail.projects', { defaultValue: 'Projects' }),
      value: profile.assigned_projects_count,
    },
  ];

  const healthRows: RailRow[] = [
    {
      key: 'signIn',
      label: t('rail.signInMethod', { defaultValue: 'Sign-in method' }),
      value: isStatsLoading ? (
        <Skeleton.Input active size="small" style={{ width: 80, minWidth: 0 }} />
      ) : stats?.hasSignedIn ? (
        t('rail.signInPassword', { defaultValue: 'Password' })
      ) : (
        t('rail.signInNone', { defaultValue: 'Not signed in yet' })
      ),
    },
    {
      key: 'lastSignIn',
      label: t('rail.lastSignIn', { defaultValue: 'Last sign-in' }),
      value: isStatsLoading ? (
        <Skeleton.Input active size="small" style={{ width: 80, minWidth: 0 }} />
      ) : stats?.lastLoginAt ? (
        fromNow(stats.lastLoginAt)
      ) : (
        t('rail.never', { defaultValue: 'Never' })
      ),
    },
  ];

  const renderRows = (rows: RailRow[]) =>
    rows.map(row => (
      <Flex
        key={row.key}
        justify="space-between"
        gap={12}
        style={{ padding: '5px 0', fontSize: 12.5 }}
      >
        <Text type="secondary">{row.label}</Text>
        <Text strong style={{ textAlign: 'end', wordBreak: 'break-word' }}>
          {row.value}
        </Text>
      </Flex>
    ));

  const sectionTitle = (title: string) => (
    <Text
      type="secondary"
      strong
      style={{
        display: 'block',
        marginBottom: 6,
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}
    >
      {title}
    </Text>
  );

  const quickActions: Array<{ key: string; icon: ReactNode; label: string; tab: WorkspaceTab }> = [
    {
      key: 'message',
      icon: <MessageOutlined />,
      label: t('rail.sendMessage', { defaultValue: 'Send message' }),
      tab: 'messages',
    },
    {
      key: 'invoice',
      icon: <FileTextOutlined />,
      label: t('rail.createInvoice', { defaultValue: 'Create invoice' }),
      tab: 'billing',
    },
    {
      key: 'task',
      icon: <CheckSquareOutlined />,
      label: t('rail.assignTask', { defaultValue: 'Assign task' }),
      tab: 'projects',
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Card size="small" style={{ borderRadius: 8 }}>
        {sectionTitle(t('rail.contact', { defaultValue: 'Contact' }))}
        {renderRows(contactRows)}
      </Card>

      <Card size="small" style={{ borderRadius: 8 }}>
        {sectionTitle(t('rail.portalHealth', { defaultValue: 'Portal health' }))}
        {renderRows(healthRows)}
      </Card>

      <Card size="small" style={{ borderRadius: 8 }}>
        {sectionTitle(t('rail.quickActions', { defaultValue: 'Quick actions' }))}
        <Flex vertical gap={4}>
          {quickActions.map(action => (
            <Button
              key={action.key}
              type="text"
              icon={action.icon}
              onClick={() => onOpenTab(action.tab)}
              style={{ justifyContent: 'flex-start', color: token.colorText }}
            >
              {action.label}
            </Button>
          ))}
        </Flex>
      </Card>
    </Flex>
  );
};
