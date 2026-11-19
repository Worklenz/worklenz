import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { TaskGroup } from '@/types/task-management.types';

interface TaskListMeasurementOptions {
  projectId?: string;
  loadedProjectId: string | null;
  groups: TaskGroup[];
  collapsedGroups: Set<string>;
  outerScrollRef: RefObject<HTMLDivElement | null>;
  scrollContainer: HTMLDivElement | null;
}

/** Records mounted rows once per project and cancels stale animation frames. */
export const useTaskListMeasurement = ({
  projectId,
  loadedProjectId,
  groups,
  collapsedGroups,
  outerScrollRef,
  scrollContainer,
}: TaskListMeasurementOptions) => {
  const measurementFrameRef = useRef<number | null>(null);
  const measuredProjectRef = useRef<string | null>(null);
  const hasVisibleGroupTasks = groups.some(
    group => !collapsedGroups.has(group.id) && group.taskIds.length > 0
  );
  const scheduleListMeasurement = useCallback(() => {
    if (
      !projectId ||
      loadedProjectId !== projectId ||
      measuredProjectRef.current === projectId ||
      measurementFrameRef.current !== null
    )
      return;
    measurementFrameRef.current = requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      const container = outerScrollRef.current;
      if (!container) return;
      const renderedTaskRows = container.querySelectorAll('[data-task-id]').length;
      // Virtuoso can report its first range before task rows are mounted.
      if (hasVisibleGroupTasks && renderedTaskRows === 0) return;
      if (performance.getEntriesByName('worklenz-project-view-start', 'mark').length === 0) return;
      measuredProjectRef.current = projectId;
      performance.mark('worklenz-task-list-rows', {
        detail: { renderedTaskRows, styleElements: document.querySelectorAll('style').length },
      });
      performance.measure(
        'worklenz-project-view-to-task-list-rows',
        'worklenz-project-view-start',
        'worklenz-task-list-rows'
      );
      performance.clearMarks('worklenz-project-view-start');
      performance.clearMarks('worklenz-task-list-rows');
    });
  }, [projectId, loadedProjectId, hasVisibleGroupTasks, outerScrollRef]);
  useEffect(
    () => () => {
      if (measurementFrameRef.current !== null) cancelAnimationFrame(measurementFrameRef.current);
      measurementFrameRef.current = null;
      measuredProjectRef.current = null;
    },
    [projectId]
  );
  useEffect(() => {
    // Empty or fully collapsed lists may not produce task items to observe.
    if (scrollContainer && !hasVisibleGroupTasks) scheduleListMeasurement();
  }, [scrollContainer, hasVisibleGroupTasks, scheduleListMeasurement]);

  return scheduleListMeasurement;
};
