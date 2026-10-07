import {
  allocateCopyName,
  stripCopyNameRoot,
} from '@/utils/template-copy-name';
import {
  createEmptyDefinitionState,
  definitionStateToPayload,
  stripColorAlpha,
  templateDetailToDefinitionState,
} from '../project-template-definition-adapters';

describe('project-template-definition-adapters', () => {
  it('strips 8-digit hex alpha suffixes', () => {
    expect(stripColorAlpha('#1890ffaa')).toBe('#1890ff');
    expect(stripColorAlpha('#1890ff')).toBe('#1890ff');
  });

  it('maps template detail into editable state with preferred name', () => {
    const state = templateDetailToDefinitionState(
      {
        name: 'Bug Tracking',
        phase_label: 'Stage',
        color_code: '#11223344',
        phases: [{ name: 'Design', color_code: '#abcdef12' }],
        status: [{ name: 'To Do', category_id: 'cat-1' } as { name: string; category_id: string }],
        labels: [{ name: 'Bug', color_code: '#ff0000' }],
        tasks: [
          {
            id: 't1',
            name: 'Report bug',
            status_name: 'To Do',
            priority_name: 'High',
            phases: [{ name: 'Design' }],
          },
        ],
      },
      'Copy of Bug Tracking'
    );

    expect(state.name).toBe('Copy of Bug Tracking');
    expect(state.phase_label).toBe('Stage');
    expect(state.color_code).toBe('#112233');
    expect(state.phases[0].name).toBe('Design');
    expect(state.phases[0].color_code).toBe('#abcdef');
    expect(state.statuses[0].category_id).toBe('cat-1');
    expect(state.tasks[0].phase_name).toBe('Design');
    expect(state.tasks[0].name).toBe('Report bug');
  });

  it('builds a save payload from editable state', () => {
    const state = createEmptyDefinitionState('My Template');
    state.phases = [{ key: 'p1', name: 'Build', color_code: '#000000' }];
    state.statuses = [
      { key: 's1', name: 'Doing', category_id: 'c1', sort_order: 0 },
    ];
    state.tasks = [
      {
        key: 'task-1',
        name: 'Implement',
        status_name: 'Doing',
        priority_name: 'Medium',
        phase_name: 'Build',
        parent_key: null,
        description: '',
        total_minutes: 30,
      },
    ];

    const payload = definitionStateToPayload(state);
    expect(payload.name).toBe('My Template');
    expect(payload.phases).toEqual([{ name: 'Build', color_code: '#000000' }]);
    expect(payload.status?.[0]).toMatchObject({
      name: 'Doing',
      category_id: 'c1',
    });
    expect(payload.tasks?.[0]).toMatchObject({
      id: 'task-1',
      name: 'Implement',
      status_name: 'Doing',
      phase_name: 'Build',
      total_minutes: 30,
    });
  });
});

describe('template-copy-name (frontend mirror)', () => {
  it('allocates numbered copies', () => {
    expect(stripCopyNameRoot('Copy of Temp 1 (2)')).toBe('Temp 1');
    expect(allocateCopyName('Temp 1', ['Copy of Temp 1'])).toBe('Copy of Temp 1 (2)');
  });
});
