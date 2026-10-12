import { Avatar, Flex, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type {
  ClientWorkspaceProfile,
  ClientWorkspaceStats,
} from '@/api/client-portal/client-workspace-api';
import PortalStatusTag from '@/components/client-portal/PortalStatusTag';
import { fromNow } from '@/utils/dateUtils';
import { getClientInitials, getStableColorIndex } from '../clients-list-helpers';
import { getClientDisplayName, getWorkspaceActivity } from './workspace-helpers';

const { Text, Title } = Typography;

interface WorkspaceHeaderProps {
  profile: ClientWorkspaceProfile;
  stats: ClientWorkspaceStats | undefined;
  isStatsLoading: boolean;
}

/** Who the client is, and where their portal access stands. Closing and editing live in the
 * modal's own close button and the tab bar's action menu, not here. */
export const WorkspaceHeader = ({ profile, stats, isStatsLoading }: WorkspaceHeaderProps) => {
  const { t } = useTranslation('client-portal-client-workspace');
  const { token } = theme.useToken();

  const name = getClientDisplayName(profile);
  const avatarPalette = [
    token.blue6,
    token.cyan6,
    token.green6,
    token.orange6,
    token.volcano6,
    token.purple6,
    token.magenta6,
    token.geekblue6,
  ];

  const renderActivity = () => {
    if (!stats) return null;

    const activity = getWorkspaceActivity(stats);
    if (activity.kind === 'signedIn') {
      return t('header.lastSignedIn', {
        time: fromNow(activity.at),
        defaultValue: 'Last signed in {{time}}',
      });
    }
    if (activity.kind === 'invited') {
      return t('header.invited', {
        time: fromNow(activity.at),
        defaultValue: 'Invited {{time}}',
      });
    }
    return t('header.neverSignedIn', { defaultValue: 'Never signed in' });
  };

  return (
    <Flex align="center" gap={14} wrap="wrap" style={{ marginBottom: 20, minWidth: 0 }}>
      <Avatar
        size={44}
        style={{
          flexShrink: 0,
          color: token.colorWhite,
          backgroundColor: avatarPalette[getStableColorIndex(profile.id, avatarPalette.length)],
        }}
      >
        {getClientInitials(name)}
      </Avatar>
      <Flex vertical style={{ minWidth: 0 }}>
        <Title level={4} style={{ margin: 0 }} ellipsis>
          {name}
        </Title>
        {isStatsLoading ? (
          <Skeleton.Input active size="small" style={{ width: 180, minWidth: 0 }} />
        ) : (
          stats && (
            <Flex align="center" gap={8} wrap="wrap">
              <PortalStatusTag
                showDot
                status={stats.portalStatus.status}
                label={t(`portalStatus.${stats.portalStatus.status}`, {
                  defaultValue: stats.portalStatus.label,
                })}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {renderActivity()}
              </Text>
            </Flex>
          )
        )}
      </Flex>
    </Flex>
  );
};
