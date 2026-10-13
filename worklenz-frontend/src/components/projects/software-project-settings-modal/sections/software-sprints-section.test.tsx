import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider, theme } from 'antd';
import type { IProjectViewModel } from '@/types/project/projectViewModel.types';

const env = vi.hoisted(() => ({
  state: {
    projectReducer: { project: { id: 'project-A', auto_start_complete_sprints: false } },
    projectDrawerReducer: { project: { id: 'project-B', auto_start_complete_sprints: true } },
    phaseReducer: { phaseList: [], loadingPhases: false },
  },
  dispatch: vi.fn(), save: vi.fn(),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => env.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: (select: (state: typeof env.state) => unknown) => select(env.state) }));
vi.mock('@/app/store', () => ({ store: { getState: () => env.state } }));
vi.mock('@/hooks/useSprintActions', () => ({ useSprintActions: () => ({ refreshSprintData: vi.fn() }) }));
vi.mock('@/api/taskAttributes/phases/phases.api.service', () => ({ phasesApiService: { updateSprintSettings: env.save } }));
vi.mock('@/api/projects/projects.api.service', () => ({ projectsApiService: {} }));
vi.mock('@/features/project/project.slice', () => ({ mergeProject: (changes: unknown) => ({ type: 'merge-page', payload: changes }), cacheProjectAccess: vi.fn() }));
vi.mock('@/features/projects/singleProject/phase/phases.slice', () => ({ fetchPhasesByProjectId: () => ({ type: 'fetch-phases' }), addPhaseWithDates: vi.fn(), deletePhaseOption: vi.fn() }));
vi.mock('@/components/task-management/sprint-form-modal', () => ({ SprintFormModal: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }));
vi.mock('../../project-settings-modal/components/settings-card', () => ({ default: ({ title, extra }: { title: string; extra: React.ReactNode }) => <section aria-label={title}>{extra}</section> }));
vi.mock('../components/section-header', () => ({ SectionHeader: () => null }));
import { SoftwareSprintsSection } from './software-sprints-section';
import drawerReducer, { mergeProjectData, setProjectData } from '@/features/project/project-drawer.slice';

beforeEach(() => {
  env.dispatch.mockClear(); env.save.mockReset().mockResolvedValue({ done: true });
  env.state.projectReducer.project = { id: 'project-A', auto_start_complete_sprints: false };
  env.state.projectDrawerReducer.project = { id: 'project-B', auto_start_complete_sprints: true };
});
const renderSettings = (dark = false) => render(<ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}><SoftwareSprintsSection projectId="project-B" disabled={false} /></ConfigProvider>);

describe('software sprint settings project scope', () => {
  it.each([false, true])('reads and saves drawer B without updating active A (dark %s)', async dark => {
    renderSettings(dark);
    const toggle = screen.getAllByRole('switch')[0];
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await waitFor(() => expect(env.save).toHaveBeenCalledWith('project-B', { auto_start_complete_sprints: false }));
    await waitFor(() => expect(env.dispatch).toHaveBeenCalledWith(mergeProjectData({ projectId: 'project-B', changes: { auto_start_complete_sprints: false } })));
    expect(env.dispatch.mock.calls.some(([action]) => action.type === 'merge-page')).toBe(false);
  });
  it('also updates the page when its project matches the saved drawer project', async () => {
    env.state.projectReducer.project.id = 'project-B';
    renderSettings(); fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => expect(env.dispatch).toHaveBeenCalledWith({ type: 'merge-page', payload: { auto_start_complete_sprints: false } }));
  });
  it('does not update a different page project if navigation occurs during the save', async () => {
    let finish!: (value: { done: boolean }) => void;
    env.save.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    env.state.projectReducer.project.id = 'project-B';
    renderSettings(); fireEvent.click(screen.getAllByRole('switch')[0]);
    env.state.projectReducer.project.id = 'project-C';
    finish({ done: true });
    await waitFor(() => expect(env.dispatch).toHaveBeenCalledWith(mergeProjectData({ projectId: 'project-B', changes: { auto_start_complete_sprints: false } })));
    expect(env.dispatch.mock.calls.some(([action]) => action.type === 'merge-page')).toBe(false);
  });
  it('merges a successful save into the matching drawer project', () => {
    const initial = drawerReducer(undefined, setProjectData({ id: 'project-B', auto_start_complete_sprints: true } as IProjectViewModel));
    const next = drawerReducer(initial, mergeProjectData({ projectId: 'project-B', changes: { auto_start_complete_sprints: false } }));
    expect(next.project?.auto_start_complete_sprints).toBe(false);
  });
  it('does not merge a delayed save into another drawer project', () => {
    const initial = drawerReducer(undefined, setProjectData({ id: 'project-C', auto_start_complete_sprints: true } as IProjectViewModel));
    const next = drawerReducer(initial, mergeProjectData({ projectId: 'project-B', changes: { auto_start_complete_sprints: false } }));
    expect(next.project?.id).toBe('project-C'); expect(next.project?.auto_start_complete_sprints).toBe(true);
  });
});
