import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from './useAppSelector';
import { useAppDispatch } from './useAppDispatch';
import {
  fetchTask,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';

/**
 * A custom hook that synchronizes the task drawer state with the URL.
 * When the task drawer is opened, it adds the task ID to the URL as a query parameter.
 * When the task drawer is closed, it removes the task ID from the URL.
 * It also checks for a task ID in the URL when the component mounts and opens the task drawer if one is found.
 */
const useTaskDrawerUrlSync = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { showTaskDrawer, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);

  // Use a ref to track whether we're in the process of closing the drawer
  const isClosingDrawer = useRef(false);
  // Use a ref to track the last task ID we processed
  const lastProcessedTaskId = useRef<string | null>(null);
  // Use a ref to track if we should ignore URL changes (when programmatically updating)
  const shouldIgnoreUrlChange = useRef(false);

  // Function to clear the task parameter from URL
  const clearTaskFromUrl = useCallback(() => {
    if (searchParams.has('task')) {
      // Set the flag to indicate we're closing the drawer
      isClosingDrawer.current = true;
      shouldIgnoreUrlChange.current = true;

      // Create a new URLSearchParams object to avoid modifying the current one
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('task');

      // Update the URL without triggering a navigation
      setSearchParams(newParams, { replace: true });

      // Reset the flags after a short delay
      setTimeout(() => {
        isClosingDrawer.current = false;
        shouldIgnoreUrlChange.current = false;
      }, 300); // Increased timeout to ensure proper cleanup
    }
  }, [searchParams, setSearchParams]);

  // Check for task ID in URL when it changes
  useEffect(() => {
    // Skip if we're programmatically updating the URL or closing the drawer
    if (shouldIgnoreUrlChange.current || isClosingDrawer.current) return;

    const taskIdFromUrl = searchParams.get('task');

    // Only process URL changes if:
    // 1. There's a task ID in the URL
    // 2. The drawer is not currently open
    // 3. We have a project ID
    // 4. It's a different task ID than what we last processed
    // 5. The selected task ID is different from URL (to avoid reopening same task)
    if (
      taskIdFromUrl &&
      !showTaskDrawer &&
      projectId &&
      taskIdFromUrl !== lastProcessedTaskId.current &&
      taskIdFromUrl !== selectedTaskId
    ) {
      lastProcessedTaskId.current = taskIdFromUrl;
      dispatch(setSelectedTaskId(taskIdFromUrl));
      dispatch(setShowTaskDrawer(true));

      // Fetch task data
      dispatch(fetchTask({ taskId: taskIdFromUrl, projectId }));
    }
  }, [searchParams, showTaskDrawer, projectId, selectedTaskId, dispatch]);

  // Update URL when task drawer state changes
  useEffect(() => {
    // Don't update URL if we're in the process of closing or ignoring changes
    if (isClosingDrawer.current || shouldIgnoreUrlChange.current) return;

    if (showTaskDrawer && selectedTaskId) {
      // Don't update if it's the same task ID we already processed
      if (lastProcessedTaskId.current === selectedTaskId) return;

      // Add task ID to URL when drawer is opened
      shouldIgnoreUrlChange.current = true;
      lastProcessedTaskId.current = selectedTaskId;

      // Create a new URLSearchParams object to avoid modifying the current one
      const newParams = new URLSearchParams(searchParams);
      newParams.set('task', selectedTaskId);

      // Update the URL without triggering a navigation
      setSearchParams(newParams, { replace: true });

      // Reset the flag after a short delay
      setTimeout(() => {
        shouldIgnoreUrlChange.current = false;
      }, 100);
    }
  }, [showTaskDrawer, selectedTaskId, searchParams, setSearchParams]);

  // Separate effect to handle URL clearing when drawer is closed
  useEffect(() => {
    // Only clear URL when drawer is closed and we have a task in URL
    // Also ensure we're not in the middle of processing other URL changes
    if (
      !showTaskDrawer &&
      searchParams.has('task') &&
      !isClosingDrawer.current &&
      !shouldIgnoreUrlChange.current &&
      !selectedTaskId
    ) {
      // Only clear if selectedTaskId is also null/cleared
      clearTaskFromUrl();
      lastProcessedTaskId.current = null;
    }
  }, [showTaskDrawer, searchParams, selectedTaskId, clearTaskFromUrl]);

  return { clearTaskFromUrl };
};

export default useTaskDrawerUrlSync;
