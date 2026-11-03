import { describe, expect, it } from 'vitest';
import { mapOverviewProjectsToVelocityOptions } from './velocity-project-options';

describe('mapOverviewProjectsToVelocityOptions', () => {
  it('includes general and software projects so phase velocity stays accessible', () => {
    const options = mapOverviewProjectsToVelocityOptions([
      { id: 'g1', name: 'General Phase Project', project_type: 'general' },
      { id: 's1', name: 'Software Sprint Project', project_type: 'software' },
      { id: 'u1', name: 'Unset type project' },
    ]);

    expect(options).toEqual([
      { value: 'g1', label: 'General Phase Project' },
      { value: 's1', label: 'Software Sprint Project' },
      { value: 'u1', label: 'Unset type project' },
    ]);
  });

  it('dedupes by project id across team responses', () => {
    const options = mapOverviewProjectsToVelocityOptions([
      { id: 'p1', name: 'Alpha', project_type: 'general' },
      { id: 'p1', name: 'Alpha duplicate', project_type: 'general' },
      { id: 'p2', name: 'Beta', project_type: 'software' },
    ]);

    expect(options.map(o => o.value)).toEqual(['p1', 'p2']);
    expect(options[0].label).toBe('Alpha');
  });
});
