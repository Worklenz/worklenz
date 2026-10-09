import { createContext, useContext } from 'react';

export type TaskListMode = 'default' | 'backlog';

export const TaskListModeContext = createContext<TaskListMode>('default');

export const useTaskListMode = (): TaskListMode => useContext(TaskListModeContext);

/** Sentinel used by list API / quick-create for tasks with no sprint/phase. */
export const UNMAPPED_PHASE_ID = 'Unmapped';
