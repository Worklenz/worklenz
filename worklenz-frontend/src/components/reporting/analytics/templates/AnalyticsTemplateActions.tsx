import React from 'react';
import { Button, Space } from '@/shared/antd-imports';
import { CrownOutlined, SaveOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { canUseFeature } from '@/utils/subscription-utils';
import {
  SaveAnalyticsTemplateModal,
  type SaveAnalyticsTemplateValues,
} from './SaveAnalyticsTemplateModal';

interface AnalyticsTemplateActionsProps {
  /** @deprecated Unused ? templates live under Custom reports in the sidebar. */
  templates?: unknown;
  canShare: boolean;
  saveDisabled?: boolean;
  saveOpen: boolean;
  savingTemplate?: boolean;
  onSaveOpenChange: (open: boolean) => void;
  /** @deprecated Unused ? templates live under Custom reports in the sidebar. */
  onRefresh?: () => void;
  /** @deprecated Unused ? templates live under Custom reports in the sidebar. */
  onApply?: (template: never) => void;
  onSave: (values: SaveAnalyticsTemplateValues) => void;
  namePlaceholder?: string;
}

/** Save as Template ? Business plan only; Free/Pro show crown and open upgrade. */
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
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const canSaveTemplate = canUseFeature(session, 'advanced_reporting');

  const handleClick = () => {
    if (!canSaveTemplate) {
      dispatch(openUpgradeModal('default'));
      return;
    }
    onSaveOpenChange(true);
  };

  return (
    <>
      <Button
        icon={<SaveOutlined />}
        onClick={handleClick}
        disabled={canSaveTemplate ? saveDisabled : false}
        aria-label={
          canSaveTemplate
            ? t('saveAsTemplate', { defaultValue: 'Save as Template' })
            : t('saveAsTemplateUpgradeAria', {
                defaultValue: 'Save as Template ? Business plan required',
              })
        }
      >
        <Space size={6}>
          <span>{t('saveAsTemplate', { defaultValue: 'Save as Template' })}</span>
          {!canSaveTemplate && (
            <CrownOutlined
              style={{ fontSize: 14, color: '#faad14' }}
              aria-hidden
            />
          )}
        </Space>
      </Button>
      {canSaveTemplate && (
        <SaveAnalyticsTemplateModal
          open={saveOpen}
          canShare={canShare}
          confirmLoading={savingTemplate}
          namePlaceholder={namePlaceholder}
          onCancel={() => onSaveOpenChange(false)}
          onSave={onSave}
        />
      )}
    </>
  );
};
