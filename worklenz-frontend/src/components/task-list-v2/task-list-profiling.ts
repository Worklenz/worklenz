import type { ProfilerOnRenderCallback } from 'react';

// Normal builds omit the profiling boundaries and use the standard React renderer.
export const isTaskListProfilingEnabled = import.meta.env.VITE_REACT_PROFILING === 'true';

/** CPU render durations live in detail; the measure spans render start to commit. */
export const recordTaskListRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  performance.measure(`worklenz-render:${id}`, {
    start: startTime,
    end: commitTime,
    detail: { phase, actualDuration, baseDuration },
  });
};
