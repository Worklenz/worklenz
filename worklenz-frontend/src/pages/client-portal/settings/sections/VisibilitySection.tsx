import React from 'react';
import { useTranslation } from 'react-i18next';
import { IClientPortalSettings } from '@/types/settings/client-portal-settings.types';
import { SectionCard } from './SectionCard';
import { SettingsToggleRow } from './SettingsToggleRow';

interface VisibilitySectionProps {
  settings: IClientPortalSettings;
  onChange: (patch: Partial<IClientPortalSettings>) => void;
}

/** Field key + label/description i18n keys — enforced ones are noted in the description since
 * only Invoices/Chat/Project Plan currently gate anything in the live client portal (the rest
 * persist correctly but have no visible effect yet, no client-facing feature exists for them). */
const ROWS: {
  field: keyof IClientPortalSettings;
  labelKey: string;
  labelDefault: string;
  descKey: string;
  descDefault: string;
}[] = [
  {
    field: 'visible_project_plan',
    labelKey: 'visibility.projectPlan.label',
    labelDefault: 'Project Plan (Tasks)',
    descKey: 'visibility.projectPlan.description',
    descDefault: 'Shows the Projects section in the client portal.',
  },
  {
    field: 'visible_gantt_timeline',
    labelKey: 'visibility.ganttTimeline.label',
    labelDefault: 'Gantt / Timeline',
    descKey: 'visibility.ganttTimeline.description',
    descDefault: 'Saved for when a Gantt/Timeline view ships in the client portal — no effect yet.',
  },
  {
    field: 'visible_files_documents',
    labelKey: 'visibility.filesDocuments.label',
    labelDefault: 'Files & Documents',
    descKey: 'visibility.filesDocuments.description',
    descDefault: 'Saved for when a standalone Files section ships in the client portal — no effect yet.',
  },
  {
    field: 'visible_invoices',
    labelKey: 'visibility.invoices.label',
    labelDefault: 'Invoices',
    descKey: 'visibility.invoices.description',
    descDefault: 'Shows the Invoices section in the client portal.',
  },
  {
    field: 'visible_feedback_forms',
    labelKey: 'visibility.feedbackForms.label',
    labelDefault: 'Feedback Forms',
    descKey: 'visibility.feedbackForms.description',
    descDefault: 'Saved for when Feedback Forms ship in the client portal — no effect yet.',
  },
  {
    field: 'visible_team_members',
    labelKey: 'visibility.teamMembers.label',
    labelDefault: 'Team Members',
    descKey: 'visibility.teamMembers.description',
    descDefault: 'Saved for when a client-facing Team Members page ships — no effect yet.',
  },
  {
    field: 'visible_project_updates',
    labelKey: 'visibility.projectUpdates.label',
    labelDefault: 'Project Updates',
    descKey: 'visibility.projectUpdates.description',
    descDefault: 'Saved for when Project Updates ship in the client portal — no effect yet.',
  },
  {
    field: 'visible_chat',
    labelKey: 'visibility.chat.label',
    labelDefault: 'Chat',
    descKey: 'visibility.chat.description',
    descDefault: 'Shows the Chats section in the client portal.',
  },
];

export const VisibilitySection: React.FC<VisibilitySectionProps> = ({ settings, onChange }) => {
  const { t } = useTranslation('client-portal-settings');

  return (
    <SectionCard
      title={t('visibilityTitle', { defaultValue: 'Client Visible Selection' })}
      description={t('visibilityDescription', { defaultValue: 'Choose which sections appear in the client portal.' })}
    >
      {ROWS.map((row, index) => (
        <SettingsToggleRow
          key={row.field}
          label={t(row.labelKey, { defaultValue: row.labelDefault })}
          description={t(row.descKey, { defaultValue: row.descDefault })}
          checked={Boolean(settings[row.field])}
          onChange={checked => onChange({ [row.field]: checked } as Partial<IClientPortalSettings>)}
          isLast={index === ROWS.length - 1}
        />
      ))}
    </SectionCard>
  );
};

export default VisibilitySection;
