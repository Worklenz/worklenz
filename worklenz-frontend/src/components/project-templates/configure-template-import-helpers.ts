/**
 * Pure helpers extracted for unit tests (Phase 8) — no React / Redux.
 */
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import type {
  IProjectTemplateAdvancedSettings,
  IProjectTemplateIncludes,
  IProjectTemplateProjectSettingsIncludes,
  IProjectTemplateSettingsOverrides,
  IProjectTemplateSettingsSnapshot,
} from '@/types/project/projectTemplate.types';

export interface ConfigureTemplateImportFormValues {
  projectName: string;
  startDate: Dayjs | null;
  category_id?: string | null;
  project_manager: ITeamMemberViewModel | null;
  estimated_working_days?: number | null;
  estimated_man_days?: number | null;
  hours_per_day?: number | null;
  advanced: IProjectTemplateAdvancedSettings;
  budget_amount?: number | null;
  budget_currency?: string | null;
}

const isSettingsFlagOn = (
  flags: Partial<IProjectTemplateProjectSettingsIncludes> | undefined,
  key: keyof IProjectTemplateProjectSettingsIncludes
): boolean => flags?.[key] === true;

export const buildSettingsOverrides = (
  values: ConfigureTemplateImportFormValues,
  includes: IProjectTemplateIncludes | null | undefined
): IProjectTemplateSettingsOverrides => {
  const flags = includes?.projectSettings;
  const overrides: IProjectTemplateSettingsOverrides = {};

  if (isSettingsFlagOn(flags, 'category')) {
    overrides.category_id = values.category_id ?? null;
  }
  if (isSettingsFlagOn(flags, 'projectManager')) {
    overrides.project_manager_id = values.project_manager?.id ?? null;
  }
  if (isSettingsFlagOn(flags, 'estimatedWorkingDays')) {
    overrides.estimated_working_days =
      values.estimated_working_days !== undefined && values.estimated_working_days !== null
        ? Number(values.estimated_working_days)
        : null;
  }
  if (isSettingsFlagOn(flags, 'estimatedManDays')) {
    overrides.estimated_man_days =
      values.estimated_man_days !== undefined && values.estimated_man_days !== null
        ? Number(values.estimated_man_days)
        : null;
  }
  if (isSettingsFlagOn(flags, 'hoursPerDay')) {
    overrides.hours_per_day =
      values.hours_per_day !== undefined && values.hours_per_day !== null
        ? Number(values.hours_per_day)
        : null;
  }
  if (isSettingsFlagOn(flags, 'advanced')) {
    overrides.advanced = { ...values.advanced };
  }
  if (isSettingsFlagOn(flags, 'budget')) {
    overrides.budget = {
      amount:
        values.budget_amount !== undefined && values.budget_amount !== null
          ? Number(values.budget_amount)
          : null,
      currency: values.budget_currency ?? null,
    };
  }

  return overrides;
};

export const initFormValuesFromSettings = (
  projectName: string,
  settings: IProjectTemplateSettingsSnapshot | null | undefined
): ConfigureTemplateImportFormValues => {
  const advanced: Partial<IProjectTemplateAdvancedSettings> = settings?.advanced || {};
  return {
    projectName,
    startDate: dayjs(),
    category_id: settings?.category_id ?? null,
    project_manager: settings?.project_manager_id
      ? ({ id: settings.project_manager_id } as ITeamMemberViewModel)
      : null,
    estimated_working_days: settings?.estimated_working_days ?? null,
    estimated_man_days: settings?.estimated_man_days ?? null,
    hours_per_day: settings?.hours_per_day ?? 8,
    advanced: {
      use_manual_progress: Boolean(advanced.use_manual_progress),
      use_weighted_progress: Boolean(advanced.use_weighted_progress),
      use_time_progress: Boolean(advanced.use_time_progress),
      auto_assign_task_creator: Boolean(advanced.auto_assign_task_creator),
      restrict_task_creation: Boolean(advanced.restrict_task_creation),
      phase_assignees_enabled: Boolean(advanced.phase_assignees_enabled),
    },
    budget_amount: settings?.budget?.amount ?? null,
    budget_currency: settings?.budget?.currency ?? 'USD',
  };
};
