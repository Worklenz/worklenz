import { Button, Flex, Form, FormInstance, Switch, Tooltip, theme } from '@/shared/antd-imports';
import { CrownOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import ProjectManagerDropdown from '../../project-manager-dropdown/project-manager-dropdown';
import ProjectClientSection from '../../project-drawer/project-client-section/project-client-section';
import SettingsCard from '../components/settings-card';

interface ClientManagerCardProps {
  form: FormInstance;
  project: IProjectViewModel | null;
  disabled: boolean;
  isFree: boolean;
  canAssignPm: boolean;
  selectedProjectManager: ITeamMemberViewModel | null;
  setSelectedProjectManager: (manager: ITeamMemberViewModel | null) => void;
  onUpgradeClick: () => void;
}

const ClientManagerCard = ({
  form,
  project,
  disabled,
  isFree,
  canAssignPm,
  selectedProjectManager,
  setSelectedProjectManager,
  onUpgradeClick,
}: ClientManagerCardProps) => {
  const { t } = useTranslation('project-drawer');
  const { t: tCommon } = useTranslation('common');
  const { token } = theme.useToken();
  const { clients, loading: loadingClients } = useAppSelector(state => state.clientReducer);

  return (
    <SettingsCard title={t('clientAndManagerCardTitle', { defaultValue: 'Client & Manager' })}>
      <ProjectClientSection
        clients={clients}
        form={form}
        t={t}
        project={project}
        loadingClients={loadingClients}
        disabled={disabled}
      />

      <Form.Item
        name="project_manager"
        label={
          <Flex align="center" gap={4}>
            <span>{t('projectManager')}</span>
            {isFree && (
              <Tooltip title={tCommon('upgrade-plan')} placement="top">
                <Button
                  type="text"
                  size="small"
                  icon={<CrownOutlined style={{ fontSize: '14px', color: token.colorWarning }} />}
                  onClick={onUpgradeClick}
                  aria-label={tCommon('upgrade-plan')}
                />
              </Tooltip>
            )}
          </Flex>
        }
        layout="horizontal"
      >
        <ProjectManagerDropdown
          selectedProjectManager={selectedProjectManager}
          setSelectedProjectManager={setSelectedProjectManager}
          disabled={isFree || disabled || !canAssignPm}
        />
      </Form.Item>
      {canAssignPm && selectedProjectManager?.id && (
        <Form.Item
          name="finance_access"
          label={t('financeAccessLabel', {
            defaultValue: 'Finance access',
          })}
          valuePropName="checked"
          extra={t('financeAccessHelp', {
            defaultValue:
              'When on, this project manager can view and edit the Finance tab, budget, and rate card.',
          })}
        >
          <Switch
            disabled={isFree || disabled}
            aria-label={t('financeAccessLabel', {
              defaultValue: 'Finance access',
            })}
          />
        </Form.Item>
      )}
    </SettingsCard>
  );
};

export default ClientManagerCard;
