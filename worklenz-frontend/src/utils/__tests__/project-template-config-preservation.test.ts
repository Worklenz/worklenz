import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  buildSettingsOverrides,
  initFormValuesFromSettings,
} from '@/components/project-templates/configure-template-import-helpers';
import {
  groupTemplateImportSkips,
  summarizeTemplateImportSkips,
} from '@/utils/project-template-import-result';
import type { IProjectTemplateApplySkip } from '@/types/project/projectTemplate.types';

const t = (key: string, options?: Record<string, unknown>) => {
  if (options?.defaultValue) return String(options.defaultValue).replace(
    /\{\{(\w+)\}\}/g,
    (_, name) => String(options[name] ?? '')
  );
  return key;
};

describe('configure-template-import-form (Phase 8)', () => {
  it('8.2 — old templates with null settings get blank review defaults', () => {
    const values = initFormValuesFromSettings('My Project', null);
    expect(values.projectName).toBe('My Project');
    expect(values.category_id).toBeNull();
    expect(values.project_manager).toBeNull();
    expect(values.estimated_working_days).toBeNull();
    expect(values.hours_per_day).toBe(8);
    expect(values.advanced.use_manual_progress).toBe(false);
    expect(values.startDate?.isSame(dayjs(), 'day')).toBe(true);
  });

  it('8.2 — buildSettingsOverrides is empty when includes.projectSettings missing', () => {
    const values = initFormValuesFromSettings('P', {
      category_id: 'c1',
      estimated_working_days: 5,
    });
    const overrides = buildSettingsOverrides(values, null);
    expect(overrides).toEqual({});
  });

  it('8.3 — buildSettingsOverrides only emits flagged settings', () => {
    const values = initFormValuesFromSettings('P', {
      category_id: 'c1',
      estimated_working_days: 5,
      hours_per_day: 7,
      advanced: { use_manual_progress: true },
    });
    values.estimated_working_days = 12;
    const overrides = buildSettingsOverrides(values, {
      project: { statuses: true, phases: true, labels: true, customColumns: false },
      projectSettings: {
        category: true,
        projectManager: false,
        estimatedWorkingDays: true,
        estimatedManDays: false,
        hoursPerDay: true,
        advanced: true,
        budget: false,
      },
      task: {
        status: true,
        phase: true,
        labels: true,
        estimation: true,
        description: true,
        subtasks: true,
        assignees: false,
        recurrence: true,
        dependencies: true,
        billable: true,
        dateOffsets: true,
      },
    });
    expect(overrides.category_id).toBe('c1');
    expect(overrides.estimated_working_days).toBe(12);
    expect(overrides.hours_per_day).toBe(7);
    expect(overrides.advanced?.use_manual_progress).toBe(true);
    expect(overrides.project_manager_id).toBeUndefined();
    expect(overrides.budget).toBeUndefined();
  });
});

describe('template import skip summary (Phase 7/8)', () => {
  it('groups skips and builds a summary string', () => {
    const skips: IProjectTemplateApplySkip[] = [
      { type: 'assignee', reason: 'inactive_or_missing', detail: 'a@x.com' },
      { type: 'assignee', reason: 'inactive_or_missing', detail: 'b@x.com' },
      { type: 'dependency', reason: 'unmapped_or_self' },
      { type: 'plan_gated', reason: 'budget' },
    ];
    const groups = groupTemplateImportSkips(skips);
    expect(groups.find(g => g.type === 'assignee')?.count).toBe(2);
    const summary = summarizeTemplateImportSkips(skips, t);
    expect(summary).toContain('assignee');
    expect(summary).toContain('dependenc');
  });

  it('returns null when there are no skips', () => {
    expect(summarizeTemplateImportSkips([], t)).toBeNull();
    expect(summarizeTemplateImportSkips(null, t)).toBeNull();
  });
});
