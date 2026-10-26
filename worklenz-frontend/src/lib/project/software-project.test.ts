import { describe, expect, it } from 'vitest';

import {
  isSoftwareProjectType,
  isSoftwareSprintSetupRequired,
} from './software-project';

describe('isSoftwareSprintSetupRequired', () => {
  it('locks software projects until the first sprint exists', () => {
    expect(isSoftwareSprintSetupRequired('software', 0)).toBe(true);
    expect(isSoftwareSprintSetupRequired('software', 1)).toBe(false);
  });

  it('does not lock general projects', () => {
    expect(isSoftwareSprintSetupRequired('general', 0)).toBe(false);
    expect(isSoftwareProjectType('general')).toBe(false);
  });
});
