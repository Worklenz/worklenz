import { describe, it, expect } from 'vitest';
import { getPostTeamSwitchLocation } from './team-switch-navigation';

describe('getPostTeamSwitchLocation', () => {
  it('redirects project detail pages to the projects list', () => {
    expect(
      getPostTeamSwitchLocation('/worklenz/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    ).toBe('/worklenz/projects');
  });

  it('keeps shared projects rail pages in place', () => {
    expect(getPostTeamSwitchLocation('/worklenz/projects/all-projects')).toBe(
      '/worklenz/projects/all-projects'
    );
    expect(getPostTeamSwitchLocation('/worklenz/projects/time-entries')).toBe(
      '/worklenz/projects/time-entries'
    );
    expect(getPostTeamSwitchLocation('/worklenz/projects')).toBe('/worklenz/projects');
  });

  it('redirects task short links to the projects list', () => {
    expect(getPostTeamSwitchLocation('/worklenz/t/task-123')).toBe('/worklenz/projects');
  });

  it('keeps home, planner, and finance pages in place', () => {
    expect(getPostTeamSwitchLocation('/worklenz/home')).toBe('/worklenz/home');
    expect(getPostTeamSwitchLocation('/worklenz/planner/schedule')).toBe(
      '/worklenz/planner/schedule'
    );
    expect(getPostTeamSwitchLocation('/worklenz/finance/overview')).toBe(
      '/worklenz/finance/overview'
    );
  });
});
