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
});
