import { describe, expect, it } from 'vitest';

import {
  isSoftwareProjectType,
  isSoftwareSprintSetupRequired,
} from './software-project';

describe('isSoftwareSprintSetupRequired', () => {
  it('never locks the backlog (setup gate removed)', () => {
    expect(isSoftwareSprintSetupRequired('software', 0)).toBe(false);
    expect(isSoftwareSprintSetupRequired('software', 1)).toBe(false);
    expect(isSoftwareSprintSetupRequired('general', 0)).toBe(false);
  });

  it('still detects software project type', () => {
    expect(isSoftwareProjectType('software')).toBe(true);
    expect(isSoftwareProjectType('general')).toBe(false);
  });
});
