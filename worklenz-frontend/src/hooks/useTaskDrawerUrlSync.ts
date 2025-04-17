import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from './useAppSelector';
import { useAppDispatch } from './useAppDispatch';
import { fetchTask, setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';

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
  // Use a ref to track if we've already processed the initial URL
  const initialUrlProcessed = useRef(false);
  // Use a ref to track the last task ID we processed
  const lastProcessedTaskId = useRef<string | null>(null);

  // Function to clear the task parameter from URL
  const clearTaskFromUrl = useCallback(() => {
    if (searchParams.has('task')) {
      // Set the flag to indicate we're closing the drawer
      isClosingDrawer.current = true;
      
      // Create a new URLSearchParams object to avoid modifying the current one
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('task');
      
      // Update the URL without triggering a navigation
      setSearchParams(newParams, { replace: true });
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isClosingDrawer.current = false;
      }, 200);
    }
  }, [searchParams, setSearchParams]);

  // Check for task ID in URL when component mounts
  useEffect(() => {
    // Only process the URL once on initial mount
    if (!initialUrlProcessed.current) {
      const taskIdFromUrl = searchParams.get('task');
      if (taskIdFromUrl && !showTaskDrawer && projectId && !isClosingDrawer.current) {
        lastProcessedTaskId.current = taskIdFromUrl;
        dispatch(setSelectedTaskId(taskIdFromUrl));
        dispatch(setShowTaskDrawer(true));
        
        // Fetch task data
        dispatch(fetchTask({ taskId: taskIdFromUrl, projectId }));
      }
      initialUrlProcessed.current = true;
    }
  }, [searchParams, dispatch, showTaskDrawer, projectId]);

  // Update URL when task drawer state changes
  useEffect(() => {
    // Don't update URL if we're in the process of closing
    if (isClosingDrawer.current) return;
    
    if (showTaskDrawer && selectedTaskId) {
      // Don't update if it's the same task ID we already processed
      if (lastProcessedTaskId.current === selectedTaskId) return;
      
      // Add task ID to URL when drawer is opened
      lastProcessedTaskId.current = selectedTaskId;
      
      // Create a new URLSearchParams object to avoid modifying the current one
      const newParams = new URLSearchParams(searchParams);
      newParams.set('task', selectedTaskId);
      
      // Update the URL without triggering a navigation
      setSearchParams(newParams, { replace: true });
    } else if (!showTaskDrawer && searchParams.has('task')) {
      // Remove task ID from URL when drawer is closed
      clearTaskFromUrl();
      lastProcessedTaskId.current = null;
    }
  }, [showTaskDrawer, selectedTaskId, searchParams, setSearchParams, clearTaskFromUrl]);

  return { clearTaskFromUrl };
};

export default useTaskDrawerUrlSync; 