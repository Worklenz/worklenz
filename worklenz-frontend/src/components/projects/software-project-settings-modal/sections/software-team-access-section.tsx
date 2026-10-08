import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, CrownOutlined, Flex, Form, Switch, Typography, theme } from '@/shared/antd-imports';

import ProjectManagerDropdown from '../../project-manager-dropdown/project-manager-dropdown';
import SettingsCard from '../../project-settings-modal/components/settings-card';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { SectionHeader } from '../components/section-header';

interface SoftwareTeamAccessSectionProps {
  selectedProjectLead: ITeamMemberViewModel | null;
  onProjectLeadChange: (member: ITeamMemberViewModel | null) => void;
  disabled: boolean;
  canAssignLead: boolean;
  canManageVisibility: boolean;
  hasBusinessAccess: boolean;
  isFreePlan: boolean;
  onUpgrade: () => void;
}

export const SoftwareTeamAccessSection = ({
  selectedProjectLead,
  onProjectLeadChange,
  disabled,
  canAssignLead,
  canManageVisibility,
  hasBusinessAccess,
  isFreePlan,
  onUpgrade,
}: SoftwareTeamAccessSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { t: tCommon } = useTranslation('common');

  const upgradeAction = (
    <Button size="small" type="primary" icon={<CrownOutlined />} onClick={onUpgrade}>
      {tCommon('upgrade-plan')}
    </Button>
  );

  return (
    <Flex vertical gap={16}>
      <SectionHeader
        title={t('softwareSettings.teamTitle', { defaultValue: 'Team & access' })}
        description={t('softwareSettings.teamDescription', {
          defaultValue: 'Who leads the project and how members create and see work items.',
        })}
      />

      <SettingsCard title={t('softwareSettings.leadCard', { defaultValue: 'Project lead' })}>
        {isFreePlan && (
          <Alert
            type="info"
            showIcon
            className="mb-3"
            message={t('softwareSettings.leadUpgrade', {
              defaultValue: 'Assigning a project lead is available on paid plans.',
            })}
            action={upgradeAction}
          />
        )}
        <SettingRow
          label={t('softwareSettings.leadLabel', { defaultValue: 'Lead' })}
          description={t('softwareSettings.leadHelp', {
            defaultValue: 'Owns the backlog, runs sprint planning and manages project settings.',
          })}
        >
          <ProjectManagerDropdown
            selectedProjectManager={selectedProjectLead}
            setSelectedProjectManager={onProjectLeadChange}
            disabled={isFreePlan || disabled || !canAssignLead}
          />
        </SettingRow>
        {canAssignLead && selectedProjectLead?.id && (
          <SettingRow
            label={t('financeAccessLabel', { defaultValue: 'Finance access' })}
            description={t('financeAccessHelp', {
              defaultValue:
                'When on, this project manager can view and edit the Finance tab, budget, and rate card.',
            })}
          >
            <Form.Item name="finance_access" valuePropName="checked" noStyle>
              <Switch
                disabled={isFreePlan || disabled}
                aria-label={t('financeAccessLabel', { defaultValue: 'Finance access' })}
              />
            </Form.Item>
          </SettingRow>
        )}
      </SettingsCard>

      <SettingsCard
        title={t('softwareSettings.workItemsCard', { defaultValue: 'Work item rules' })}
      >
        <SettingRow
          label={t('softwareSettings.autoAssignReporter', {
            defaultValue: 'Assign new work items to their creator',
          })}
          description={t('softwareSettings.autoAssignReporterHelp', {
            defaultValue: 'Useful when engineers pick up the issues they log themselves.',
          })}
        >
          <Form.Item name="auto_assign_task_creator" valuePropName="checked" noStyle>
            <Switch
              disabled={disabled}
              aria-label={t('softwareSettings.autoAssignReporter', {
                defaultValue: 'Assign new work items to their creator',
              })}
            />
          </Form.Item>
        </SettingRow>
        <SettingRow
          label={t('softwareSettings.restrictCreation', {
            defaultValue: 'Only Admins and Team Leads can create and assign work items',
          })}
          description={t('softwareSettings.restrictCreationHelp', {
            defaultValue: 'Members can still update the work items assigned to them.',
          })}
          isLast={!canManageVisibility}
        >
          <Form.Item name="restrict_task_creation" valuePropName="checked" noStyle>
            <Switch
              disabled={disabled || !hasBusinessAccess}
              aria-label={t('softwareSettings.restrictCreation', {
                defaultValue: 'Only Admins and Team Leads can create and assign work items',
              })}
            />
          </Form.Item>
        </SettingRow>
        {canManageVisibility && (
          <SettingRow
            label={t('softwareSettings.restrictVisibility', {
              defaultValue: 'Members only see work items assigned to them',
            })}
            description={t('restrictTasksToAssigneeHelper', {
              defaultValue:
                'When enabled, members only see tasks assigned to them. Owners, Admins, Team Leads, Project Managers, and Guests always see all tasks.',
            })}
            isLast
          >
            <Form.Item name="restrict_tasks_to_assignee" valuePropName="checked" noStyle>
              <Switch
                disabled={disabled}
                aria-label={t('softwareSettings.restrictVisibility', {
                  defaultValue: 'Members only see work items assigned to them',
                })}
              />
            </Form.Item>
          </SettingRow>
        )}
        {!hasBusinessAccess && (
          <Alert
            type="info"
            showIcon
            className="mt-3"
            message={t('restrictTaskCreationBusinessPlanDescription', {
              defaultValue:
                'Restricting task creation to Admins and Team Leads is available on Business and Enterprise plans.',
            })}
            action={upgradeAction}
          />
        )}
      </SettingsCard>
    </Flex>
  );
};

interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  isLast?: boolean;
}

const SettingRow = ({ label, description, children, isLast = false }: SettingRowProps) => {
  const { token } = theme.useToken();

  return (
    <Flex
      justify="space-between"
      align="center"
      gap={16}
      wrap="wrap"
      style={{
        padding: '10px 0',
        borderBottom: isLast ? 'none' : `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
        <Typography.Text style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>
          {label}
        </Typography.Text>
        {description && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {description}
          </Typography.Text>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </Flex>
  );
};
