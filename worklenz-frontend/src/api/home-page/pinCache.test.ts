import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import type { IHomeTasksConfig } from '@/types/home/home-page.types';
import type { IMyTask } from '@/types/home/my-tasks.types';
import homePageApi, { applyPinToCachedTasks } from './home-page.api.service';

const task = (id: string, extra: Partial<IMyTask> = {}) => ({ id, name: id, ...extra }) as IMyTask;

const buildStore = () =>
  configureStore({
    reducer: { [homePageApi.reducerPath]: homePageApi.reducer },
    middleware: getDefault => getDefault().concat(homePageApi.middleware),
  });

const listArg = (tab: string) => ({ current_tab: tab, tasks_group_by: 0, index: 1, size: 10 }) as unknown as IHomeTasksConfig;

const seed = async (store: ReturnType<typeof buildStore>, arg: IHomeTasksConfig, tasks: IMyTask[]) => {
  await store.dispatch(
    homePageApi.util.upsertQueryData('getMyTasks', arg, {
      done: true,
      body: { tasks, total: tasks.length, today: 0, upcoming: 0, overdue: 0, no_due_date: 0, in_progress: 0 },
    })
  );
};

const rowsOf = (store: ReturnType<typeof buildStore>, arg: IHomeTasksConfig) =>
  homePageApi.endpoints.getMyTasks.select(arg)(store.getState()).data?.body?.tasks ?? [];

describe('applyPinToCachedTasks', () => {
  it('flips the pin on the task in every cached list, leaving other tasks alone', async () => {
    const store = buildStore();
    const all = listArg('All');
    const overdue = listArg('Overdue');
    await seed(store, all, [task('a'), task('b')]);
    await seed(store, overdue, [task('b'), task('c')]);

    store.dispatch((d, getState) => applyPinToCachedTasks(d, getState, 'b', true));

    expect(rowsOf(store, all).map(t => t.is_pinned)).toEqual([undefined, true]);
    expect(rowsOf(store, overdue).map(t => t.is_pinned)).toEqual([true, undefined]);
    expect(rowsOf(store, all)[1].pinned_at).toEqual(expect.any(String));
  });

  it('unpins and clears the pin time', async () => {
    const store = buildStore();
    const all = listArg('All');
    await seed(store, all, [task('a', { is_pinned: true, pinned_at: '2026-01-01T00:00:00Z' })]);

    store.dispatch((d, getState) => applyPinToCachedTasks(d, getState, 'a', false));

    expect(rowsOf(store, all)[0]).toMatchObject({ is_pinned: false, pinned_at: null });
  });

  it('puts the previous values back when undone, as when the request fails', async () => {
    const store = buildStore();
    const all = listArg('All');
    await seed(store, all, [task('a', { is_pinned: false })]);

    const undo = store.dispatch((d, getState) => applyPinToCachedTasks(d, getState, 'a', true));
    expect(rowsOf(store, all)[0].is_pinned).toBe(true);

    undo();
    expect(rowsOf(store, all)[0].is_pinned).toBe(false);
  });

  it('does nothing when no list is cached', () => {
    const store = buildStore();
    const undo = store.dispatch((d, getState) => applyPinToCachedTasks(d, getState, 'a', true));
    expect(() => undo()).not.toThrow();
  });
});
