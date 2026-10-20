export type SettingsSectionGroup = 'project' | 'configuration' | 'danger';

export const SETTINGS_GROUP_ORDER: SettingsSectionGroup[] = ['project', 'configuration', 'danger'];

export const PROJECT_GROUP_KEYS = ['general', 'advanced', 'privacy', 'budget'];

/** Sections rendered inside the form; they are submitted together by the Update button. */
export const FORM_SECTION_KEYS = ['general', 'advanced', 'privacy', 'budget', 'phases'];

export interface SettingsSectionItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}
