import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Spin, message } from '@/shared/antd-imports';
import { useParams } from 'react-router-dom';
import { useSocket } from '@/socket/socketContext';
import GanttTimeline from './components/gantt-timeline/GanttTimeline';
import GanttTaskList from './components/gantt-task-list/GanttTaskList';
import GanttChart from './components/gantt-chart/GanttChart';
import GanttToolbar from './components/gantt-toolbar/GanttToolbar';
import ManagePhaseModal from '@components/task-management/ManagePhaseModal';
import PhaseDetailsModal from './components/phase-details-modal/PhaseDetailsModal';
import { GanttProvider } from './context/gantt-context';
import { GanttViewMode } from './types/gantt-types';
import {
  useGetRoadmapTasksQuery,
  useGetProjectPhasesQuery,
  useReorderPhasesMutation,
  transformToGanttTasks,
  transformToGanttPhases,
} from './services/roadmap-api.service';
import { TimelineUtils } from './utils/timeline-calculator';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setShowTaskDrawer,
  setSelectedTaskId,
  setTaskFormViewModel,
  fetchTask,
} from '@features/task-drawer/task-drawer.slice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import { SocketEvents } from '@/shared/socket-events';
import './gantt-styles.css';

const ProjectViewGantt: React.FC = React.memo(() => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const [viewMode, setViewMode] = useState<GanttViewMode>('day');
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [showPhaseDetailsModal, setShowPhaseDetailsModal] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [animatingTasks, setAnimatingTasks] = useState<Set<string>>(new Set());
  const [prevExpandedTasks, setPrevExpandedTasks] = useState<Set<string>>(new Set());
  const timelineRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // RTK Query hooks
  const {
    data: tasksResponse,
    error: tasksError,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useGetRoadmapTasksQuery({ projectId: projectId || '' }, { skip: !projectId });

  const {
    data: phasesResponse,
    error: phasesError,
    isLoading: phasesLoading,
    refetch: refetchPhases,
  } = useGetProjectPhasesQuery({ projectId: projectId || '' }, { skip: !projectId });

  const [reorderPhases, { isLoading: isReordering }] = useReorderPhasesMutation();

  // Transform API data to component format
  const tasks = useMemo(() => {
    if (tasksResponse?.body && phasesResponse?.body) {
      const transformedTasks = transformToGanttTasks(tasksResponse.body, phasesResponse.body);
      const result: any[] = [];

      transformedTasks.forEach(task => {
        // Always show phase milestones
        if (task.type === 'milestone' || task.is_milestone) {
          result.push(task);

          // If this phase is expanded, show its children tasks
          const phaseId =
            task.id === 'phase-unmapped'
              ? 'unmapped'
              : task.phase_id || task.id.replace('phase-', '');
          const isExpanded = expandedTasks.has(phaseId);

          if (isExpanded && task.children) {
            task.children.forEach((child: any) => {
              result.push({
                ...child,
                phase_id: task.phase_id, // Ensure child has correct phase_id
              });
            });
          }
        }
      });

      return result;
    }
    return [];
  }, [tasksResponse, phasesResponse, expandedTasks]);

  const phases = useMemo(() => {
    if (phasesResponse?.body) {
      return transformToGanttPhases(phasesResponse.body);
    }
    return [];
  }, [phasesResponse]);

  // Calculate date range based on tasks
  const dateRange = useMemo(() => {
    if (tasks.length > 0) {
      return TimelineUtils.getSmartDateRange(tasks, viewMode);
    }
    return { start: new Date(), end: new Date() };
  }, [tasks, viewMode]);

  const loading = tasksLoading || phasesLoading;

  // Load priorities for task drawer functionality
  useEffect(() => {
    dispatch(fetchPriorities());
  }, [dispatch]);

  // Socket listener for quick task creation response
  useEffect(() => {
    if (!socket) return;

    const handleQuickTaskResponse = (response: any) => {
      if (response) {
        message.success(`Task "${response.name}" created successfully`);
        // Refresh the Gantt data to show the new task
        refetchTasks();
        refetchPhases();
      } else {
        message.error('Failed to create task');
      }
    };

    socket.on(SocketEvents.QUICK_TASK.toString(), handleQuickTaskResponse);

    return () => {
      socket.off(SocketEvents.QUICK_TASK.toString(), handleQuickTaskResponse);
    };
  }, [socket, refetchTasks, refetchPhases]);

  // Track expansion changes for animations
  useEffect(() => {
    const currentExpanded = expandedTasks;
    const previousExpanded = prevExpandedTasks;

    // Find newly expanded or collapsed phases
    const newlyExpanded = new Set([...currentExpanded].filter(id => !previousExpanded.has(id)));
    const newlyCollapsed = new Set([...previousExpanded].filter(id => !currentExpanded.has(id)));

    if (newlyExpanded.size > 0 || newlyCollapsed.size > 0) {
      // Set animation state for newly changed phases
      setAnimatingTasks(new Set([...newlyExpanded, ...newlyCollapsed]));

      // Clear animation state after animation completes
      const timeout = setTimeout(() => {
        setAnimatingTasks(new Set());
      }, 400); // Match CSS animation duration

      setPrevExpandedTasks(new Set(currentExpanded));

      return () => clearTimeout(timeout);
    }
  }, [expandedTasks, prevExpandedTasks]);

  const handleViewModeChange = useCallback((mode: GanttViewMode) => {
    setViewMode(mode);
  }, []);

  const handleChartScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;

    // Sync horizontal scroll with timeline
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = target.scrollLeft;
    }

    // Sync vertical scroll with task list
    if (taskListRef.current) {
      taskListRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  const handleTaskListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;

    // Sync vertical scroll with chart
    if (chartRef.current) {
      chartRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  const handleRefresh = useCallback(() => {
    refetchTasks();
    refetchPhases();
  }, [refetchTasks, refetchPhases]);

  const handleCreatePhase = useCallback(() => {
    setShowPhaseModal(true);
  }, []);

  const handleCreateTask = useCallback(
    (phaseId?: string) => {
      // Create a new task using the task drawer
      const newTaskViewModel = {
        id: null,
        name: DEFAULT_TASK_NAME,
        project_id: projectId,
        phase_id: phaseId || null,
        // Add other default properties as needed
      };

      dispatch(setSelectedTaskId(null));
      dispatch(setTaskFormViewModel(newTaskViewModel));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch, projectId]
  );

  const handleTaskClick = useCallback(
    (taskId: string) => {
      // Open existing task in the task drawer
      dispatch(setSelectedTaskId(taskId));
      dispatch(setTaskFormViewModel(null)); // Clear form view model for existing task
      dispatch(setShowTaskDrawer(true));

      // Fetch the complete task data including priorities
      if (projectId) {
        dispatch(fetchTask({ taskId, projectId }));
      }
    },
    [dispatch, projectId]
  );

  const handleClosePhaseModal = useCallback(() => {
    setShowPhaseModal(false);
  }, []);

  const handlePhaseClick = useCallback((phase: any) => {
    setSelectedPhase(phase);
    setShowPhaseDetailsModal(true);
  }, []);

  const handleClosePhaseDetailsModal = useCallback(() => {
    setShowPhaseDetailsModal(false);
    setSelectedPhase(null);
  }, []);

  const handlePhaseUpdate = useCallback(
    (updatedPhase: any) => {
      // Refresh the data after phase update
      refetchTasks();
      refetchPhases();
    },
    [refetchTasks, refetchPhases]
  );

  const handlePhaseReorder = useCallback(
    async (oldIndex: number, newIndex: number) => {
      if (!projectId || !phasesResponse?.body) {
        message.error('Unable to reorder phases: missing project data');
        return;
      }

      // Get current phases sorted by sort_index
      const currentPhases = [...phasesResponse.body].sort((a, b) => a.sort_index - b.sort_index);

      // Reorder phases array
      const reorderedPhases = [...currentPhases];
      const [moved] = reorderedPhases.splice(oldIndex, 1);
      reorderedPhases.splice(newIndex, 0, moved);

      // Create phase order data with new indices
      const phase_orders = reorderedPhases.map((phase, index) => ({
        phase_id: phase.id,
        sort_index: index + 1, // Start from 1
      }));

      try {
        await reorderPhases({
          project_id: projectId,
          phase_orders,
        }).unwrap();

        message.success('Phases reordered successfully');

        // Refresh data to reflect the changes
        refetchPhases();
        refetchTasks();
      } catch (error: any) {
        console.error('Failed to reorder phases:', error);
        message.error(error?.data?.message || 'Failed to reorder phases');
      }
    },
    [projectId, phasesResponse?.body, reorderPhases, refetchPhases, refetchTasks]
  );

  const handleCreateQuickTask = useCallback(
    (taskName: string, phaseId?: string, startDate?: Date) => {
      if (!socket || !projectId || !taskName.trim()) {
        message.error('Socket connection or project ID missing, or task name is empty');
        return;
      }

      const taskData = {
        project_id: projectId,
        name: taskName.trim(),
        phase_id: phaseId || null,
        start_date: startDate ? startDate.toISOString().split('T')[0] : null,
      };

      // Emit the task creation event through socket
      socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(taskData));
    },
    [socket, projectId]
  );

  const handleTaskNameClick = useCallback(
    (task: any) => {
      // Scroll timeline to show the task bar
      if (chartRef.current && task.start_date && dateRange) {
        const totalTimeSpan = dateRange.end.getTime() - dateRange.start.getTime();
        const timeFromStart = new Date(task.start_date).getTime() - dateRange.start.getTime();

        // Calculate the position based on the current viewport dimensions
        const chartElement = chartRef.current;
        const chartWidth = chartElement.scrollWidth;
        const viewportWidth = chartElement.clientWidth;

        // Calculate the scroll position to center the task
        const taskPosition = (timeFromStart / totalTimeSpan) * chartWidth;
        const scrollPosition = Math.max(0, taskPosition - viewportWidth / 2);

        // Smooth scroll to the task position
        chartElement.scrollTo({
          left: scrollPosition,
          behavior: 'smooth',
        });

        // Also scroll timeline to match
        if (timelineRef.current) {
          timelineRef.current.scrollTo({
            left: scrollPosition,
            behavior: 'smooth',
          });
        }
      } else if (!task.start_date) {
        message.info(`Task "${task.name}" has no start date set`);
      }
    },
    [dateRange]
  );

  // Handle errors
  if (tasksError || phasesError) {
    message.error('Failed to load Gantt chart data');
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full w-full">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <GanttProvider
      value={{
        tasks,
        phases,
        viewMode,
        projectId: projectId || '',
        dateRange,
        onRefresh: handleRefresh,
      }}
    >
      <div
        className="flex flex-col h-full w-full bg-gray-50 dark:bg-gray-900"
        style={{ height: 'calc(100vh - 64px)' }}
      >
        <GanttToolbar
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          dateRange={dateRange}
        />
        <div className="flex flex-1 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
          <div className="relative flex w-full h-full">
            {/* Fixed Task List - positioned absolutely to avoid scrollbar interference */}
            <div className="absolute left-0 top-0 bottom-0 z-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
              <GanttTaskList
                tasks={tasks}
                projectId={projectId || ''}
                viewMode={viewMode}
                onTaskClick={handleTaskClick}
                onPhaseClick={handlePhaseClick}
                onCreateTask={handleCreateTask}
                onCreateQuickTask={handleCreateQuickTask}
                onCreatePhase={handleCreatePhase}
                onPhaseReorder={handlePhaseReorder}
                ref={taskListRef}
                onScroll={handleTaskListScroll}
                expandedTasks={expandedTasks}
                onExpandedTasksChange={setExpandedTasks}
                animatingTasks={animatingTasks}
                onTaskNameClick={handleTaskNameClick}
              />
            </div>

            {/* Scrollable Timeline and Chart - with left margin for task list */}
            <div
              className="flex-1 flex flex-col overflow-hidden gantt-timeline-container"
              style={{ marginLeft: '444px' }}
              ref={containerRef}
            >
              <GanttTimeline
                viewMode={viewMode}
                ref={timelineRef}
                containerRef={containerRef}
                dateRange={dateRange}
              />
              <GanttChart
                tasks={tasks}
                viewMode={viewMode}
                ref={chartRef}
                onScroll={handleChartScroll}
                onPhaseClick={handlePhaseClick}
                containerRef={containerRef}
                dateRange={dateRange}
                phases={phases}
                expandedTasks={expandedTasks}
                animatingTasks={animatingTasks}
                onCreateQuickTask={handleCreateQuickTask}
                projectId={projectId || ''}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Phase Management Modal */}
      <ManagePhaseModal
        open={showPhaseModal}
        onClose={handleClosePhaseModal}
        projectId={projectId}
      />

      {/* Phase Details Modal */}
      <PhaseDetailsModal
        open={showPhaseDetailsModal}
        onClose={handleClosePhaseDetailsModal}
        phase={selectedPhase}
        onPhaseUpdate={handlePhaseUpdate}
      />
    </GanttProvider>
  );
});

ProjectViewGantt.displayName = 'ProjectViewGantt';

export default ProjectViewGantt;
