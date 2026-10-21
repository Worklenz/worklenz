import { Button, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

interface ProjectSettingsFooterProps {
  editMode: boolean;
  isFormSectionActive: boolean;
  canSave: boolean;
  isSaving: boolean;
  saveDisabled: boolean;
  onClose: () => void;
  onSave: () => void;
}

const ProjectSettingsFooter = ({
  editMode,
  isFormSectionActive,
  canSave,
  isSaving,
  saveDisabled,
  onClose,
  onSave,
}: ProjectSettingsFooterProps) => {
  const { t } = useTranslation('project-drawer');

  return (
    <Flex justify={editMode ? 'space-between' : 'end'} align="center" gap={12} wrap="wrap">
      {editMode && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {isFormSectionActive
            ? t('generalSettings.formFooterHint', {
                defaultValue: 'Changes in this section are saved when you click Update.',
              })
            : t('softwareSettings.autoSaveFooterHint', {
                defaultValue: 'Changes in this section save automatically.',
              })}
        </Typography.Text>
      )}
      <Flex gap={8}>
        {editMode && (
          <Button onClick={onClose}>
            {t('softwareSettings.close', { defaultValue: 'Close' })}
          </Button>
        )}
        {canSave && (
          <Button type="primary" onClick={onSave} loading={isSaving} disabled={saveDisabled}>
            {editMode ? t('update') : t('create')}
          </Button>
        )}
      </Flex>
    </Flex>
  );
};

export default ProjectSettingsFooter;
