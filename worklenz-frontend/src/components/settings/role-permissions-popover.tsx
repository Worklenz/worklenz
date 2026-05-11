import {
  Card,
  Flex,
  Popover,
  QuestionCircleOutlined,
  Tag,
  theme,
  Typography,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { getRoleColor, ROLE_DEFINITIONS, ROLE_NAMES } from '@/types/roles/role.types';

const PERMISSIONS_DEFAULT_VALUES: Record<string, string> = {
  permissionInviteMembers: 'Can invite and update team members',
  permissionManageAllRoles: 'Can manage Admin, Team Lead, and Member roles',
  permissionAssignTeamLeads: 'Can assign or remove Team Lead reporting relationships',
  permissionAccessFinance: 'Can access finance and other admin-only workspace areas',
  permissionManageAdmins: 'Can manage Admin, Team Lead, and Member accounts except the owner',
  permissionManageManagedRoles: 'Can manage Team Lead and Member accounts only',
  permissionViewManagedReports: 'Can view managed-member reporting without admin access',
  permissionNoFinanceAccess: 'Cannot access finance settings or admin-only finance tools',
  permissionViewAssignedWork: 'Can work on assigned projects and tasks',
  permissionNoMemberManagement: 'Cannot invite, deactivate, delete, or reassign team members',
  permissionNoRoleChanges: 'Cannot change roles or Team Lead assignments',
};

const SUMMARY_ROLES = [ROLE_NAMES.ADMIN, ROLE_NAMES.TEAM_LEAD, ROLE_NAMES.MEMBER];

export const RolePermissionsPopover = () => {
  const { t } = useTranslation('settings/team-members');
  const { token } = theme.useToken();

  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      title={t('rolePermissionsTitle', { defaultValue: 'Role Permissions' })}
      content={
        <Flex vertical gap={16} style={{ width: 'min(720px, calc(100vw - 64px))', maxWidth: '100%' }}>
          <Typography.Text type="secondary">
            {t('rolePermissionsDescription', {
              defaultValue:
                'Access levels define who can manage team members, reporting relationships, and admin-only workspace tools.',
            })}
          </Typography.Text>
          <Flex gap={12} wrap="wrap">
            {SUMMARY_ROLES.map(roleName => {
              const roleDefinition = ROLE_DEFINITIONS[roleName];

              return (
                <Card
                  key={roleName}
                  size="small"
                  style={{
                    flex: '1 1 220px',
                    minWidth: 220,
                    borderColor: token.colorBorderSecondary,
                    background: token.colorBgContainer,
                  }}
                >
                  <Flex vertical gap={12}>
                    <Tag color={getRoleColor(roleName)} style={{ margin: 0, width: 'fit-content' }}>
                      {t(roleDefinition.labelKey, {
                        defaultValue: roleDefinition.labelDefaultValue,
                      })}
                    </Tag>
                    <Typography.Text type="secondary">
                      {t(roleDefinition.descriptionKey, {
                        defaultValue: roleDefinition.descriptionDefaultValue,
                      })}
                    </Typography.Text>
                    <Flex vertical gap={6}>
                      {roleDefinition.permissionKeys.map(permissionKey => (
                        <Typography.Text key={permissionKey}>
                          {t(permissionKey, {
                            defaultValue: PERMISSIONS_DEFAULT_VALUES[permissionKey] || permissionKey,
                          })}
                        </Typography.Text>
                      ))}
                    </Flex>
                  </Flex>
                </Card>
              );
            })}
          </Flex>
        </Flex>
      }
    >
      <button
        type="button"
        aria-label={t('rolePermissionsTitle', { defaultValue: 'Role Permissions' })}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: token.colorTextSecondary,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        <QuestionCircleOutlined />
      </button>
    </Popover>
  );
};
