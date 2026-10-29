import React from 'react';
import { Button } from '@/shared/antd-imports';
import { SaveOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  SaveAnalyticsTemplateModal,
  type SaveAnalyticsTemplateValues,
} from './SaveAnalyticsTemplateModal';

interface AnalyticsTemplateActionsProps {
  /** @deprecated Unused — templates live under Custom reports in the sidebar. */
  templates?: unknown;
  canShare: boolean;
  saveDisabled?: boolean;
  saveOpen: boolean;
  savingTemplate?: boolean;
  onSaveOpenChange: (open: boolean) => void;
  /** @deprecated Unused — templates live under Custom reports in the sidebar. */
  onRefresh?: () => void;
  /** @deprecated Unused — templates live under Custom reports in the sidebar. */
  onApply?: (template: never) => void;
  onSave: (values: SaveAnalyticsTemplateValues) => void;
  namePlaceholder?: string;
}

/** Save as Template control for analytics report pages (list is in the sidebar). */
export const AnalyticsTemplateActions: React.FC<AnalyticsTemplateActionsProps> = ({
  canShare,
  saveDisabled,
  saveOpen,
  savingTemplate,
  onSaveOpenChange,
  onSave,
  namePlaceholder,
}) => {
  const { t } = useTranslation('reporting-analytics');

  return (
    <>
      <Button
        icon={<SaveOutlined />}
        onClick={() => onSaveOpenChange(true)}
        disabled={saveDisabled}
      >
        {t('saveAsTemplate', { defaultValue: 'Save as Template' })}
      </Button>
      <SaveAnalyticsTemplateModal
        open={saveOpen}
        canShare={canShare}
        confirmLoading={savingTemplate}
        namePlaceholder={namePlaceholder}
        onCancel={() => onSaveOpenChange(false)}
        onSave={onSave}
      />
    </>
  );
};
