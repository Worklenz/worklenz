import { Avatar, Flex, Modal, Tag, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { CompanyUser } from '@/api/client-portal/company-users-api';
import PortalStatusTag from '@/components/client-portal/PortalStatusTag';
import { PERMISSION_LEVELS } from '@/lib/client-portal/client-permissions';
import { fromNow } from '@/utils/dateUtils';
import { getClientInitials, getStableColorIndex } from '../clients-list-helpers';
import { getCompanyUserActivity } from './company-users-helpers';

const { Text, Title } = Typography;

interface CompanyUserProfileModalProps {
  user: CompanyUser | null;
  open: boolean;
  onClose: () => void;
}

/** Read-only profile of one company user. Editing happens in the Edit user modal. */
export const CompanyUserProfileModal = ({ user, open, onClose }: CompanyUserProfileModalProps) => {
  const { t } = useTranslation('client-portal-company-users');
  const { token } = theme.useToken();

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

  const renderActivity = (member: CompanyUser) => {
    const activity = getCompanyUserActivity(member);
    if (activity.kind === 'signedIn') return fromNow(activity.at);
    if (activity.kind === 'invited') {
      return t('lastActivityInvited', {
        time: fromNow(activity.at),
        defaultValue: 'Invited {{time}}',
      });
    }
    return t('lastActivityNever', { defaultValue: 'Never signed in' });
  };

  const levelLabel = (levelKey: string) => {
    const definition = PERMISSION_LEVELS.find(level => level.key === levelKey);
    return definition
      ? t(definition.labelKey, { defaultValue: definition.labelDefault })
      : t('permissionLevels.unknown', { defaultValue: 'Unknown level' });
  };

  const detailRows = user
    ? [
        { key: 'email', label: t('profile.email', { defaultValue: 'Email' }), value: user.email },
        { key: 'phone', label: t('profile.phone', { defaultValue: 'Phone' }), value: user.phone },
        {
          key: 'jobTitle',
          label: t('profile.jobTitle', { defaultValue: 'Job title' }),
          value: user.job_title,
        },
        {
          key: 'lastActivity',
          label: t('profile.lastActivity', { defaultValue: 'Last activity' }),
          value: renderActivity(user),
        },
        {
          key: 'signIn',
          label: t('profile.signInMethod', { defaultValue: 'Sign-in method' }),
          value: user.has_login
            ? t('profile.signInPassword', { defaultValue: 'Password' })
            : t('profile.signInNone', { defaultValue: 'Not signed in yet' }),
        },
      ]
    : [];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={520}
      title={t('profile.title', { defaultValue: 'Member profile' })}
    >
      {user && (
        <Flex vertical gap={20}>
          <Flex align="center" gap={14}>
            <Avatar
              size={52}
              style={{
                flexShrink: 0,
                color: token.colorWhite,
                backgroundColor: avatarPalette[getStableColorIndex(user.id, avatarPalette.length)],
              }}
            >
              {getClientInitials(user.name)}
            </Avatar>
            <Flex vertical gap={6} style={{ minWidth: 0 }}>
              <Title level={5} style={{ margin: 0 }}>
                {user.name}
              </Title>
              <Text type="secondary">
                {user.job_title?.trim() ||
                  t('profile.noJobTitle', { defaultValue: 'No job title on file' })}
                {' · '}
                {user.company_name}
              </Text>
              <Flex gap={8} wrap="wrap">
                <Tag color={user.role === 'poc' ? 'blue' : 'default'} style={{ margin: 0 }}>
                  {user.role === 'poc'
                    ? t('role.poc', { defaultValue: 'POC' })
                    : t('role.member', { defaultValue: 'Member' })}
                </Tag>
                <PortalStatusTag
                  showDot
                  status={user.portal_status.status}
                  label={t(`portalStatus.${user.portal_status.status}`, {
                    defaultValue: user.portal_status.label,
                  })}
                />
              </Flex>
            </Flex>
          </Flex>

          <div
            style={{
              padding: '4px 16px',
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {detailRows.map((row, index) => (
              <Flex
                key={row.key}
                justify="space-between"
                gap={16}
                style={{
                  padding: '10px 0',
                  borderTop: index === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text type="secondary">{row.label}</Text>
                <Text style={{ textAlign: 'end', wordBreak: 'break-word' }}>
                  {row.value?.trim() ? row.value : '—'}
                </Text>
              </Flex>
            ))}
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('profile.assignedProjects', {
                count: user.projects.length,
                defaultValue: 'Assigned projects ({{count}})',
              })}
            </Text>
            {user.projects.length === 0 ? (
              <Text type="secondary">
                {t('profile.noProjects', { defaultValue: 'No projects assigned yet.' })}
              </Text>
            ) : (
              <Flex vertical gap={6}>
                {user.projects.map(project => (
                  <Flex key={project.project_id} justify="space-between" align="center" gap={12}>
                    <Text>{project.name}</Text>
                    <Tag color="blue" style={{ margin: 0 }}>
                      {levelLabel(project.level)}
                    </Tag>
                  </Flex>
                ))}
              </Flex>
            )}
          </div>
        </Flex>
      )}
    </Modal>
  );
};
