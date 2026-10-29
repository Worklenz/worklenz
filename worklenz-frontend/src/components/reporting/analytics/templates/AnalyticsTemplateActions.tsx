import React from 'react';
import { Button, Space } from '@/shared/antd-imports';
import { SaveOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import { AnalyticsTemplatesMenu } from './AnalyticsTemplatesMenu';
import {
  SaveAnalyticsTemplateModal,
  type SaveAnalyticsTemplateValues,
} from './SaveAnalyticsTemplateModal';

interface AnalyticsTemplateActionsProps {
  templates: AnalyticsReportTemplate[];
  canShare: boolean;
  saveDisabled?: boolean;
  saveOpen: boolean;
  savingTemplate?: boolean;
  onSaveOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  onApply: (template: AnalyticsReportTemplate) => void;
  onSave: (values: SaveAnalyticsTemplateValues) => void;
  namePlaceholder?: string;
}

/** My Templates + Save as Template controls for analytics report pages. */
export const AnalyticsTemplateActions: React.FC<AnalyticsTemplateActionsProps> = ({
  templates,
  canShare,
  saveDisabled,
  saveOpen,
  savingTemplate,
  onSaveOpenChange,
  onRefresh,
  onApply,
  onSave,
  namePlaceholder,
}) => {
  const { t } = useTranslation('reporting-analytics');

  return (
    <>
      <Space wrap>
        <AnalyticsTemplatesMenu
          templates={templates}
          canShare={canShare}
          onRefresh={onRefresh}
          onApply={onApply}
        />
        <Button
          icon={<SaveOutlined />}
          onClick={() => onSaveOpenChange(true)}
          disabled={saveDisabled}
        >
          {t('saveAsTemplate', { defaultValue: 'Save as Template' })}
        </Button>
      </Space>
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
