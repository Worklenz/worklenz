import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Tag, theme } from '@/shared/antd-imports';
import { InfoCircleOutlined } from '@ant-design/icons';
import { PERMISSION_TEMPLATES, getPermissionLevel } from '@/lib/client-portal/client-permissions';
import { SectionCard } from './SectionCard';

/** Read-only: sourced from the same PERMISSION_TEMPLATES/PERMISSION_LEVELS list the Add Client
 * wizard and Assign Projects (Clients page) already use, so this is always exactly in sync with
 * them — there is nothing here to create or edit in this phase. */
export const PermissionTemplatesSection: React.FC = () => {
  const { t } = useTranslation('client-portal-settings');
  // permissionLevels/permissionTemplates keys live in this namespace already — the same one
  // Assign Projects/Add Client wizard resolve them in — so translations here stay in sync too.
  const { t: tPermissions } = useTranslation('client-portal-company-users');
  const { token } = theme.useToken();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message={t('permissionTemplates.bannerTitle', { defaultValue: 'Read-only' })}
        description={t('permissionTemplates.bannerDescription', {
          defaultValue:
            "Picking a template sets that permission level on every one of the company's current projects in one click — admins can still fine-tune access project by project afterward. Available when adding a company user or from Assign Projects on any existing user.",
        })}
      />

      {PERMISSION_TEMPLATES.map(template => {
        const level = getPermissionLevel(template.level);
        return (
          <SectionCard key={template.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {tPermissions(template.nameKey, { defaultValue: template.nameDefault })}
                </div>
                <div style={{ fontSize: 12.5, color: token.colorTextSecondary, marginTop: 4 }}>
                  {tPermissions(template.descriptionKey, { defaultValue: template.descriptionDefault })}
                </div>
              </div>
              <Tag color="blue" style={{ whiteSpace: 'nowrap' }}>
                {level ? tPermissions(level.labelKey, { defaultValue: level.labelDefault }) : template.level}
              </Tag>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
};

export default PermissionTemplatesSection;
