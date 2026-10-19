import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, MenuProps, theme } from '@/shared/antd-imports';

import {
  PROJECT_GROUP_KEYS,
  SETTINGS_GROUP_ORDER,
  SettingsSectionGroup,
  SettingsSectionItem,
} from '../project-settings.constants';

interface ProjectSettingsNavProps {
  sections: SettingsSectionItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}

const groupOf = (key: string): SettingsSectionGroup =>
  PROJECT_GROUP_KEYS.includes(key) ? 'project' : key === 'dangerZone' ? 'danger' : 'configuration';

/** Sticky sidebar on desktop, grouped like the software project settings modal. */
export const ProjectSettingsNav = ({ sections, activeKey, onSelect }: ProjectSettingsNavProps) => {
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();

  const menuItems = useMemo<MenuProps['items']>(() => {
    const groupLabels: Record<SettingsSectionGroup, string | null> = {
      project: t('softwareSettings.groupProject', { defaultValue: 'Project' }),
      configuration: t('softwareSettings.groupConfiguration', { defaultValue: 'Configuration' }),
      danger: null,
    };

    return SETTINGS_GROUP_ORDER.flatMap<NonNullable<MenuProps['items']>[number]>(group => {
      const children = sections
        .filter(section => groupOf(section.key) === group)
        .map(section => ({ key: section.key, icon: section.icon, label: section.label }));
      if (!children.length) return [];
      const label = groupLabels[group];
      return label
        ? [{ type: 'group' as const, key: `group-${group}`, label, children }]
        : [{ type: 'divider' as const, key: `divider-${group}` }, ...children];
    });
  }, [sections, t]);

  return (
    <nav
      aria-label={t('projectSettings', { defaultValue: 'Project Settings' })}
      className="hidden shrink-0 sm:block"
      style={{
        width: 232,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
      }}
    >
      <div
        // Sticky so the nav stays in view while the settings content scrolls underneath it
        // inside the height-capped modal body.
        style={{
          position: 'sticky',
          top: 0,
          padding: '12px 8px',
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={({ key }) => onSelect(key)}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>
    </nav>
  );
};

export const ProjectSettingsMobileNav = ({
  sections,
  activeKey,
  onSelect,
}: ProjectSettingsNavProps) => (
  <div className="mb-4 sm:hidden">
    <Menu
      mode="horizontal"
      selectedKeys={[activeKey]}
      items={sections.map(section => ({ key: section.key, label: section.label }))}
      onClick={({ key }) => onSelect(key)}
    />
  </div>
);
