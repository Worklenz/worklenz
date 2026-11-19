import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskListMeasurement } from './useTaskListMeasurement';

const frames = new Map<number, FrameRequestCallback>();
const mark = vi.fn();
const measure = vi.fn();
const cancel = vi.fn((id: number) => frames.delete(id));
let nextFrame = 0;
const flushFrame = () =>
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(0));
  });
const options = () => {
  const container = document.createElement('div');
  return {
    projectId: 'project-1',
    loadedProjectId: 'project-1',
    groups: [{ id: 'todo', title: 'Todo', taskIds: ['task-1'] }],
    collapsedGroups: new Set<string>(),
    outerScrollRef: { current: container },
    scrollContainer: container,
  };
};
beforeEach(() => {
  frames.clear();
  mark.mockClear();
  measure.mockClear();
  cancel.mockClear();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', cancel);
  vi.stubGlobal('performance', {
    mark,
    measure,
    clearMarks: vi.fn(),
    getEntriesByName: () => [{}],
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('task-list mounted-row measurement', () => {
  it('waits for actual rows, records once, and coalesces duplicate callbacks', () => {
    const props = options();
    const { result } = renderHook(() => useTaskListMeasurement(props));
    act(() => {
      result.current();
      result.current();
    });
    expect(frames.size).toBe(1);
    flushFrame();
    expect(mark).not.toHaveBeenCalled();
    props.outerScrollRef.current.innerHTML = '<div data-task-id="task-1"></div>';
    act(() => result.current());
    flushFrame();
    expect(mark).toHaveBeenCalledWith('worklenz-task-list-rows', {
      detail: { renderedTaskRows: 1, styleElements: document.querySelectorAll('style').length },
    });
    act(() => result.current());
    flushFrame();
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('does not record stale project data and cancels pending work on project changes', () => {
    const props = options();
    const { result, rerender } = renderHook(useTaskListMeasurement, { initialProps: props });
    act(() => result.current());
    rerender({ ...props, projectId: 'project-2' });
    expect(cancel).toHaveBeenCalledTimes(1);
    act(() => result.current());
    expect(frames.size).toBe(0);
    expect(measure).not.toHaveBeenCalled();
  });

  it('records empty or fully collapsed lists without waiting for task rows', () => {
    const props = { ...options(), collapsedGroups: new Set(['todo']) };
    renderHook(() => useTaskListMeasurement(props));
    flushFrame();
    expect(measure).toHaveBeenCalledTimes(1);
  });
});
