import { describe, expect, it } from 'vitest';
import {
  PERMISSION_LEVELS,
  PERMISSION_TEMPLATES,
  applyLevelToSelection,
  applyPermissionTemplate,
  getPermissionTemplate,
  toProjectAccessPayload,
  toggleSelectAll,
} from './client-permissions';

const PROJECTS = ['p1', 'p2', 'p3'];

describe('permission definitions', () => {
  it('defines the three levels and three templates once', () => {
    expect(PERMISSION_LEVELS.map(level => level.key)).toEqual(['view', 'comment', 'contributor']);
    expect(PERMISSION_TEMPLATES.map(template => [template.key, template.level])).toEqual([
      ['view_only', 'view'],
      ['standard_contact', 'comment'],
      ['full_partner', 'contributor'],
    ]);
  });

  it('maps every template to a level that exists', () => {
    const levels = PERMISSION_LEVELS.map(level => level.key);
    PERMISSION_TEMPLATES.forEach(template => expect(levels).toContain(template.level));
  });

  it('looks a template up by key', () => {
    expect(getPermissionTemplate('full_partner')?.level).toBe('contributor');
    expect(getPermissionTemplate('nope')).toBeUndefined();
  });
});

describe('applyPermissionTemplate', () => {
  it('sets the template level on every current project, replacing what was chosen', () => {
    const template = getPermissionTemplate('standard_contact')!;

    expect(applyPermissionTemplate(template, PROJECTS)).toEqual({
      p1: 'comment',
      p2: 'comment',
      p3: 'comment',
    });
  });

  it('returns nothing for a company with no projects', () => {
    expect(applyPermissionTemplate(getPermissionTemplate('view_only')!, [])).toEqual({});
  });
});

describe('applyLevelToSelection', () => {
  it('sets one level on every selected project', () => {
    expect(applyLevelToSelection({ p1: 'view', p3: 'comment' }, 'contributor')).toEqual({
      p1: 'contributor',
      p3: 'contributor',
    });
  });

  it('does not add projects that were not selected', () => {
    expect(Object.keys(applyLevelToSelection({ p2: 'view' }, 'comment'))).toEqual(['p2']);
  });
});

describe('toggleSelectAll', () => {
  it('adds the missing projects at view and keeps the levels already chosen', () => {
    expect(toggleSelectAll({ p2: 'contributor' }, PROJECTS)).toEqual({
      p1: 'view',
      p2: 'contributor',
      p3: 'view',
    });
  });

  it('clears everything when every project is already selected', () => {
    expect(toggleSelectAll({ p1: 'view', p2: 'view', p3: 'comment' }, PROJECTS)).toEqual({});
  });

  it('does nothing useful for an empty company', () => {
    expect(toggleSelectAll({}, [])).toEqual({});
  });

  it('does not mutate its input', () => {
    const input = { p1: 'view' as const };
    toggleSelectAll(input, PROJECTS);
    expect(input).toEqual({ p1: 'view' });
  });
});

describe('toProjectAccessPayload', () => {
  it('converts the map to the list the API takes', () => {
    expect(toProjectAccessPayload({ p1: 'view', p2: 'comment' })).toEqual([
      { project_id: 'p1', level: 'view' },
      { project_id: 'p2', level: 'comment' },
    ]);
  });
});
