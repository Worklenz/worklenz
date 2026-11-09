import { describe, expect, it } from 'vitest';
import {
  selectEffectiveStatusCategoryOrder,
  setProject,
  setProjectId,
  setStatusCategoryOrder,
} from './project.slice';
import projectReducer from './project.slice';

describe('project status category order', () => {
  it('uses the project order when no explicit Redux order is set', () => {
    const projectId = 'project-1';
    const projectState = projectReducer(
      projectReducer(undefined, setProjectId(projectId)),
      setProject({
        id: projectId,
        status_category_order: ['doing', 'todo', 'done'],
      })
    );

    expect(
      selectEffectiveStatusCategoryOrder({
        projectReducer: { ...projectState, statusCategoryOrder: null },
      })
    ).toEqual(['doing', 'todo', 'done']);
  });

  it('returns the updated order from Redux state', () => {
    const projectId = 'project-1';
    const initialProjectState = projectReducer(
      projectReducer(undefined, setProjectId(projectId)),
      setProject({
        id: projectId,
        status_category_order: ['doing', 'todo', 'done'],
      })
    );
    const updatedProjectState = projectReducer(
      initialProjectState,
      setStatusCategoryOrder(['todo', 'doing', 'done'])
    );

    expect(selectEffectiveStatusCategoryOrder({ projectReducer: updatedProjectState })).toEqual([
      'todo',
      'doing',
      'done',
    ]);
  });

  it('does not carry a project-specific order when switching projects', () => {
    const firstProjectState = projectReducer(
      projectReducer(undefined, setProjectId('project-1')),
      setProject({
        id: 'project-1',
        status_category_order: ['todo', 'doing', 'done'],
      })
    );
    const secondProjectState = projectReducer(firstProjectState, setProjectId('project-2'));

    expect(secondProjectState.statusCategoryOrder).toBeNull();
    expect(
      selectEffectiveStatusCategoryOrder({
        projectReducer: {
          ...secondProjectState,
          project: { id: 'project-1', status_category_order: ['todo', 'doing', 'done'] },
        },
      })
    ).toEqual([]);
  });
});
