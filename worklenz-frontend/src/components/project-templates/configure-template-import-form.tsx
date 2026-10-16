import React, { useEffect, useMemo } from 'react';
import {
  Checkbox,
  DatePicker,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess, isFreeUser } from '@/utils/subscription-utils';
import { safeTextDisplay } from '@/utils/html-entities';
import ProjectManagerDropdown from '@/components/projects/project-manager-dropdown/project-manager-dropdown';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import {
  IProjectTemplateAdvancedSettings,
  IProjectTemplateIncludes,
  IProjectTemplateProjectSettingsIncludes,
  IProjectTemplateSettingsSnapshot,
} from '@/types/project/projectTemplate.types';
import {
  buildSettingsOverrides,
  initFormValuesFromSettings,
  type ConfigureTemplateImportFormValues,
} from './configure-template-import-helpers';

export type { ConfigureTemplateImportFormValues };
export { buildSettingsOverrides, initFormValuesFromSettings };

const { Text } = Typography;

interface ConfigureTemplateImportFormProps {
  projectName: string;
  onProjectNameChange: (value: string) => void;
  startDate: Dayjs | null;
  onStartDateChange: (value: Dayjs | null) => void;
  settings: IProjectTemplateSettingsSnapshot | null | undefined;
  includes: IProjectTemplateIncludes | null | undefined;
  formValues: ConfigureTemplateImportFormValues;
  onFormValuesChange: (patch: Partial<ConfigureTemplateImportFormValues>) => void;
  disabled?: boolean;
  nameError?: string;
  startDateError?: string;
}

const isSettingsFlagOn = (
  flags: Partial<IProjectTemplateProjectSettingsIncludes> | undefined,
  key: keyof IProjectTemplateProjectSettingsIncludes
): boolean => flags?.[key] === true;

export const ConfigureTemplateImportForm: React.FC<ConfigureTemplateImportFormProps> = ({
  projectName,
  onProjectNameChange,
  startDate,
  onStartDateChange,
  settings,
  includes,
  formValues,
  onFormValuesChange,
  disabled = false,
  nameError,
  startDateError,
}) => {
  const { t } = useTranslation('settings/project-templates');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();
  const isFree = isFreeUser(session);
  const hasBusinessAccess = hasBusinessFeatureAccess(session);
  const categories = useAppSelector(state => state.projectCategoriesReducer.projectCategories);

  const flags = includes?.projectSettings;
  const showSettingsSection = useMemo(() => {
    if (!flags) return false;
    return Object.values(flags).some(Boolean);
  }, [flags]);

  useEffect(() => {
    if (isSettingsFlagOn(flags, 'category') && categories.length === 0) {
      dispatch(fetchProjectCategories());
    }
  }, [dispatch, flags, categories.length]);

  const categoryOptions = categories.map(category => ({
    value: category.id,
    label: safeTextDisplay(category.name),
  }));

  const handleAdvancedChange = (
    key: keyof IProjectTemplateAdvancedSettings,
    checked: boolean
  ) => {
    onFormValuesChange({
      advanced: {
        ...formValues.advanced,
        [key]: checked,
      },
    });
  };

  return (
    <div
      style={{ padding: '8px 0' }}
      role="form"
      aria-label={t('importAsTitle', { defaultValue: 'Configure Project' })}
    >
      <Text
        type="secondary"
        id="import-configure-hint"
        style={{ display: 'block', marginBottom: 16, color: token.colorTextSecondary }}
      >
        {t('importConfigureHint', {
          defaultValue:
            'Name the project, set a start date, and adjust any saved project settings. Changes apply only to the new project.',
        })}
      </Text>

      <Form layout="vertical" aria-describedby="import-configure-hint">
        <Form.Item
          label={t('projectNameLabel', { defaultValue: 'Project Name' })}
          required
          validateStatus={nameError ? 'error' : undefined}
          help={nameError || undefined}
        >
          <Input
            autoFocus
            value={projectName}
            onChange={e => onProjectNameChange(e.target.value)}
            placeholder={t('projectNamePlaceholder', { defaultValue: 'Enter project name' })}
            maxLength={100}
            showCount
            disabled={disabled}
            aria-label={t('projectNameLabel', { defaultValue: 'Project Name' })}
          />
        </Form.Item>

        <Form.Item
          label={t('startDateLabel', { defaultValue: 'Project start date' })}
          required
          validateStatus={startDateError ? 'error' : undefined}
          help={
            startDateError ||
            t('startDateHint', {
              defaultValue: 'Task dates from the template are offset from this date.',
            })
          }
        >
          <DatePicker
            value={startDate}
            onChange={value => onStartDateChange(value)}
            style={{ width: '100%' }}
            disabled={disabled}
            allowClear={false}
            aria-label={t('startDateLabel', { defaultValue: 'Project start date' })}
          />
        </Form.Item>

        {showSettingsSection && (
          <>
            <Divider style={{ margin: '8px 0 16px' }} />
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              {t('projectSettingsReview', { defaultValue: 'Project Settings' })}
            </Text>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
              {t('projectSettingsReviewHint', {
                defaultValue:
                  'Prefilled from the template. Edit freely — the template itself is not changed.',
              })}
            </Text>

            {isSettingsFlagOn(flags, 'category') && (
              <Form.Item label={t('settingsCategory', { defaultValue: 'Category' })}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={formValues.category_id || undefined}
                  onChange={value => onFormValuesChange({ category_id: value ?? null })}
                  options={categoryOptions}
                  placeholder={t('settingsCategoryPlaceholder', {
                    defaultValue: 'Select category',
                  })}
                  disabled={disabled || isFree}
                  aria-label={t('settingsCategory', { defaultValue: 'Category' })}
                />
              </Form.Item>
            )}

            {isSettingsFlagOn(flags, 'projectManager') && isOwnerOrAdmin && (
              <Form.Item
                label={t('settingsProjectManager', { defaultValue: 'Project manager' })}
              >
                <ProjectManagerDropdown
                  selectedProjectManager={formValues.project_manager}
                  setSelectedProjectManager={member =>
                    onFormValuesChange({ project_manager: member })
                  }
                  disabled={disabled || isFree}
                />
              </Form.Item>
            )}

            {(isSettingsFlagOn(flags, 'estimatedWorkingDays') ||
              isSettingsFlagOn(flags, 'estimatedManDays') ||
              isSettingsFlagOn(flags, 'hoursPerDay')) && (
              <Flex gap={12} wrap="wrap">
                {isSettingsFlagOn(flags, 'estimatedWorkingDays') && (
                  <Form.Item
                    label={t('settingsWorkingDays', { defaultValue: 'Estimated working days' })}
                    style={{ flex: '1 1 140px' }}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={formValues.estimated_working_days ?? undefined}
                      onChange={value =>
                        onFormValuesChange({
                          estimated_working_days: value === null ? null : Number(value),
                        })
                      }
                      disabled={disabled}
                      aria-label={t('settingsWorkingDays', {
                        defaultValue: 'Estimated working days',
                      })}
                    />
                  </Form.Item>
                )}
                {isSettingsFlagOn(flags, 'estimatedManDays') && (
                  <Form.Item
                    label={t('settingsManDays', { defaultValue: 'Estimated man days' })}
                    style={{ flex: '1 1 140px' }}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={formValues.estimated_man_days ?? undefined}
                      onChange={value =>
                        onFormValuesChange({
                          estimated_man_days: value === null ? null : Number(value),
                        })
                      }
                      disabled={disabled}
                      aria-label={t('settingsManDays', { defaultValue: 'Estimated man days' })}
                    />
                  </Form.Item>
                )}
                {isSettingsFlagOn(flags, 'hoursPerDay') && (
                  <Form.Item
                    label={t('settingsHoursPerDay', { defaultValue: 'Hours per day' })}
                    style={{ flex: '1 1 140px' }}
                  >
                    <InputNumber
                      min={1}
                      max={24}
                      style={{ width: '100%' }}
                      value={formValues.hours_per_day ?? undefined}
                      onChange={value =>
                        onFormValuesChange({
                          hours_per_day: value === null ? null : Number(value),
                        })
                      }
                      disabled={disabled}
                      aria-label={t('settingsHoursPerDay', { defaultValue: 'Hours per day' })}
                    />
                  </Form.Item>
                )}
              </Flex>
            )}

            {isSettingsFlagOn(flags, 'advanced') && (
              <Form.Item
                label={t('settingsAdvanced', { defaultValue: 'Advanced settings' })}
              >
                <Flex
                  vertical
                  gap={8}
                  role="group"
                  aria-label={t('settingsAdvanced', { defaultValue: 'Advanced settings' })}
                >
                  {(
                    [
                      ['use_manual_progress', 'advancedManualProgress', 'Manual progress'],
                      ['use_weighted_progress', 'advancedWeightedProgress', 'Weighted progress'],
                      ['use_time_progress', 'advancedTimeProgress', 'Time-based progress'],
                      [
                        'auto_assign_task_creator',
                        'advancedAutoAssignCreator',
                        'Auto-assign task creator',
                      ],
                      [
                        'restrict_task_creation',
                        'advancedRestrictCreation',
                        'Restrict task creation',
                      ],
                      [
                        'phase_assignees_enabled',
                        'advancedPhaseAssignees',
                        'Phase assignees enabled',
                      ],
                    ] as const
                  ).map(([key, i18nKey, fallback]) => (
                    <Checkbox
                      key={key}
                      checked={Boolean(formValues.advanced?.[key])}
                      onChange={e => handleAdvancedChange(key, e.target.checked)}
                      disabled={disabled}
                    >
                      {t(i18nKey, { defaultValue: fallback })}
                    </Checkbox>
                  ))}
                </Flex>
              </Form.Item>
            )}

            {isSettingsFlagOn(flags, 'budget') && isOwnerOrAdmin && (
              <Form.Item
                label={t('settingsBudget', { defaultValue: 'Budget' })}
                extra={
                  !hasBusinessAccess
                    ? t('budgetPlanHint', {
                        defaultValue:
                          'Budget settings are available on Business and Enterprise plans.',
                      })
                    : undefined
                }
              >
                <Flex gap={12}>
                  <InputNumber
                    min={0}
                    style={{ flex: 1 }}
                    value={formValues.budget_amount ?? undefined}
                    onChange={value =>
                      onFormValuesChange({
                        budget_amount: value === null ? null : Number(value),
                      })
                    }
                    disabled={disabled || !hasBusinessAccess}
                    placeholder={t('settingsBudgetAmount', { defaultValue: 'Amount' })}
                    aria-label={t('settingsBudgetAmount', { defaultValue: 'Amount' })}
                  />
                  <Input
                    style={{ width: 100 }}
                    value={formValues.budget_currency ?? ''}
                    onChange={e => onFormValuesChange({ budget_currency: e.target.value })}
                    disabled={disabled || !hasBusinessAccess}
                    placeholder={t('settingsBudgetCurrency', { defaultValue: 'Currency' })}
                    aria-label={t('settingsBudgetCurrency', { defaultValue: 'Currency' })}
                    maxLength={8}
                  />
                </Flex>
              </Form.Item>
            )}

            {!settings && (
              <Text type="secondary" style={{ fontSize: 12, color: token.colorTextSecondary }}>
                {t('noSavedSettings', {
                  defaultValue: 'This template has no saved project settings.',
                })}
              </Text>
            )}
          </>
        )}
      </Form>
    </div>
  );
};

export default ConfigureTemplateImportForm;
