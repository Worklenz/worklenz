import {
  mapScheduleFiltersToPersistedState,
  stashScheduleFiltersForOpen,
  consumePendingScheduleFilters,
} from './analytics-schedule-open';

describe('analytics-schedule-open', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('maps relative date preset without freezing project picks for live scope', () => {
    const mapped = mapScheduleFiltersToPersistedState({
      date_preset: 'yesterday',
      project_ids: [],
      project_scope: 'live',
      team_ids: ['team-1'],
      member_ids: ['m1'],
      health_ids: ['h1'],
    });

    expect(mapped.state.datePreset).toBe('yesterday');
    expect(mapped.state.customRange).toBeNull();
    expect(mapped.state.selectedTeamIds).toEqual(['team-1']);
    expect(mapped.state.selectedMemberIds).toEqual(['m1']);
    expect(mapped.state.selectedHealthIds).toEqual(['h1']);
    expect(mapped.state.selectedProjectIds).toBeUndefined();
    expect(mapped.explicitProjects).toBe(false);
    expect(mapped.explicitTeams).toBe(true);
  });

  it('maps explicit project ids for open hydrate', () => {
    const mapped = mapScheduleFiltersToPersistedState({
      project_ids: ['p1', 'p2'],
      project_scope: 'explicit',
      date_preset: 'last_7_days',
    });

    expect(mapped.state.selectedProjectIds).toEqual(['p1', 'p2']);
    expect(mapped.explicitProjects).toBe(true);
    expect(mapped.state.datePreset).toBe('last_7_days');
  });

  it('stashes and consumes once for the matching report', () => {
    stashScheduleFiltersForOpen({
      reportKind: 'project-health',
      templateId: null,
      filters: { date_preset: 'yesterday', team_ids: ['t1'] },
    });

    expect(consumePendingScheduleFilters('velocity')).toBeNull();
    const applied = consumePendingScheduleFilters('project-health');
    expect(applied?.state.datePreset).toBe('yesterday');
    expect(applied?.state.selectedTeamIds).toEqual(['t1']);
    expect(consumePendingScheduleFilters('project-health')).toBeNull();
  });

  it('matches custom template schedules by template id', () => {
    stashScheduleFiltersForOpen({
      reportKind: 'velocity',
      templateId: 'tpl-1',
      filters: { date_preset: 'today', project_ids: ['p9'] },
    });

    expect(consumePendingScheduleFilters('velocity')).toBeNull();
    const applied = consumePendingScheduleFilters('velocity', 'tpl-1');
    expect(applied?.state.datePreset).toBe('today');
    expect(applied?.state.selectedProjectIds).toEqual(['p9']);
  });
});
