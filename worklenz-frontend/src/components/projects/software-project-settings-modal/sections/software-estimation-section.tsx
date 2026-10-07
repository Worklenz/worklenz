import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CheckOutlined, Flex, Input, Tag, Typography, message, theme } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { storyPointsApiService } from '@/api/story-points/story-points.api.service';
import { mergeProject } from '@/features/project/project.slice';
import {
  DEFAULT_STORY_POINT_SCALE,
  formatStoryPoints,
  parseStoryPointScale,
} from '@/lib/project/story-points';
import logger from '@/utils/errorLogger';
import SettingsCard from '../../project-settings-modal/components/settings-card';
import { SectionHeader } from '../components/section-header';

interface SoftwareEstimationSectionProps {
  projectId: string;
  initialScale?: number[] | null;
  disabled: boolean;
}

export const SoftwareEstimationSection = ({
  projectId,
  initialScale,
  disabled,
}: SoftwareEstimationSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const activeProjectId = useAppSelector(state => state.projectReducer.projectId);

  const [savedScale, setSavedScale] = useState<number[]>(
    initialScale?.length ? initialScale : [...DEFAULT_STORY_POINT_SCALE]
  );
  const [scaleInput, setScaleInput] = useState<string>(formatScale(savedScale));
  const [isSaving, setIsSaving] = useState(false);

  const parsedScale = useMemo(() => parseStoryPointScale(scaleInput), [scaleInput]);
  const hasChanges = parsedScale !== null && formatScale(parsedScale) !== formatScale(savedScale);
  const isInvalid = scaleInput.trim().length > 0 && parsedScale === null;

  const presets = useMemo(
    () =>
      SCALE_PRESETS.map(preset => ({
        ...preset,
        label: t(`softwareSettings.preset.${preset.key}`, { defaultValue: preset.defaultLabel }),
      })),
    [t]
  );

  const handleSave = async () => {
    if (!parsedScale || disabled) return;

    setIsSaving(true);
    try {
      const response = await storyPointsApiService.updateScale(projectId, parsedScale);
      if (!response.done || !response.body) throw new Error(response.message);

      const nextScale = response.body.story_point_scale;
      setSavedScale(nextScale);
      setScaleInput(formatScale(nextScale));
      if (activeProjectId === projectId) {
        dispatch(mergeProject({ story_point_scale: nextScale }));
      }
      message.success(t('softwareSettings.scaleSaved', { defaultValue: 'Point scale saved' }));
    } catch (error) {
      logger.error('Error saving story point scale', error);
      message.error(
        t('softwareSettings.scaleSaveError', { defaultValue: 'Could not save the point scale' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Flex vertical gap={16}>
      <SectionHeader
        title={t('softwareSettings.estimationTitle', { defaultValue: 'Estimation' })}
        description={t('softwareSettings.estimationDescription', {
          defaultValue: 'Story point values your team can pick when sizing work items.',
        })}
      />

      <SettingsCard
        title={t('softwareSettings.presetsCard', { defaultValue: 'Start from a preset' })}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {presets.map(preset => {
            const isSelected = parsedScale !== null && formatScale(parsedScale) === formatScale(preset.values);
            return (
              <button
                key={preset.key}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => setScaleInput(formatScale(preset.values))}
                className="flex cursor-pointer flex-col gap-1 rounded-lg p-3 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorderSecondary}`,
                  background: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
                }}
              >
                <Flex justify="space-between" align="center">
                  <Typography.Text style={{ fontSize: 13, fontWeight: 600 }}>
                    {preset.label}
                  </Typography.Text>
                  {isSelected && <CheckOutlined style={{ color: token.colorPrimary }} />}
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatScale(preset.values)}
                </Typography.Text>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('softwareSettings.customScaleCard', { defaultValue: 'Point values' })}
        description={t('softwareSettings.customScaleHelp', {
          defaultValue:
            'Comma-separated, non-negative numbers (up to 30). They appear in the Backlog and work item details.',
        })}
      >
        <Input
          value={scaleInput}
          onChange={event => setScaleInput(event.target.value)}
          onPressEnter={handleSave}
          status={isInvalid ? 'error' : undefined}
          disabled={disabled}
          inputMode="decimal"
          placeholder={formatScale([...DEFAULT_STORY_POINT_SCALE])}
          aria-label={t('softwareSettings.customScaleCard', { defaultValue: 'Point values' })}
          aria-invalid={isInvalid}
        />
        {isInvalid && (
          <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            {t('softwareSettings.scaleInvalid', {
              defaultValue: 'Use comma-separated, non-negative numbers only.',
            })}
          </Typography.Text>
        )}

        <Flex wrap="wrap" gap={6} style={{ marginTop: 12 }} aria-live="polite">
          {(parsedScale ?? []).map(value => (
            <Tag key={value} bordered={false} style={{ marginInlineEnd: 0, minWidth: 32, textAlign: 'center' }}>
              {formatStoryPoints(value)}
            </Tag>
          ))}
        </Flex>

        <Flex justify="space-between" align="center" gap={8} style={{ marginTop: 16 }}>
          <Button
            type="link"
            style={{ paddingInline: 0 }}
            disabled={disabled}
            onClick={() => setScaleInput(formatScale([...DEFAULT_STORY_POINT_SCALE]))}
          >
            {t('softwareSettings.scaleReset', { defaultValue: 'Reset to default' })}
          </Button>
          <Button
            type="primary"
            onClick={handleSave}
            loading={isSaving}
            disabled={disabled || !hasChanges}
          >
            {t('softwareSettings.scaleSave', { defaultValue: 'Save scale' })}
          </Button>
        </Flex>
      </SettingsCard>
    </Flex>
  );
};

const formatScale = (scale: readonly number[]): string => scale.map(formatStoryPoints).join(', ');

const SCALE_PRESETS: { key: string; defaultLabel: string; values: number[] }[] = [
  { key: 'fibonacci', defaultLabel: 'Fibonacci', values: [0, 1, 2, 3, 5, 8, 13, 21] },
  {
    key: 'modifiedFibonacci',
    defaultLabel: 'Modified Fibonacci',
    values: [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100],
  },
  { key: 'powersOfTwo', defaultLabel: 'Powers of two', values: [0, 1, 2, 4, 8, 16, 32] },
  { key: 'linear', defaultLabel: 'Linear (1–10)', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
];
