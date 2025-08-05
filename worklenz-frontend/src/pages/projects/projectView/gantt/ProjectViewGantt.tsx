import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Spin, message } from '@/shared/antd-imports';
import { useParams } from 'react-router-dom';
import GanttTimeline from './components/gantt-timeline/GanttTimeline';
import GanttTaskList from './components/gantt-task-list/GanttTaskList';
import GanttChart from './components/gantt-chart/GanttChart';
import GanttToolbar from './components/gantt-toolbar/GanttToolbar';
import ManagePhaseModal from '@components/task-management/ManagePhaseModal';
import { GanttProvider } from './context/gantt-context';
import { GanttViewMode } from './types/gantt-types';
import {
  useGetRoadmapTasksQuery,
  useGetProjectPhasesQuery,
  transformToGanttTasks,
  transformToGanttPhases,
} from './services/gantt-api.service';
import { TimelineUtils } from './utils/timeline-calculator';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setShowTaskDrawer,
  setSelectedTaskId,
  setTaskFormViewModel,
} from '@features/task-drawer/task-drawer.slice';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import './gantt-styles.css';

const ProjectViewGantt: React.FC = React.memo(() => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const [viewMode, setViewMode] = useState<GanttViewMode>('month');
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
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
          const phaseId = task.id === 'phase-unmapped' ? 'unmapped' : task.phase_id;
          if (expandedTasks.has(phaseId) && task.children) {
            task.children.forEach((child: any) => {
              result.push({
                ...child,
                phase_id: task.phase_id // Ensure child has correct phase_id
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
    },
    [dispatch]
  );

  const handleClosePhaseModal = useCallback(() => {
    setShowPhaseModal(false);
  }, []);

  const handlePhaseReorder = useCallback((oldIndex: number, newIndex: number) => {
    // TODO: Implement phase reordering API call
    console.log('Reorder phases:', { oldIndex, newIndex });
    message.info('Phase reordering will be implemented with the backend API');
  }, []);

  const handleCreateQuickTask = useCallback(
    (taskName: string, phaseId?: string) => {
      // Refresh the Gantt data after task creation
      refetchTasks();
      message.success(`Task "${taskName}" created successfully!`);
    },
    [refetchTasks]
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
          onCreatePhase={handleCreatePhase}
          onCreateTask={handleCreateTask}
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
                onCreateTask={handleCreateTask}
                onCreateQuickTask={handleCreateQuickTask}
                onPhaseReorder={handlePhaseReorder}
                ref={taskListRef}
                onScroll={handleTaskListScroll}
                expandedTasks={expandedTasks}
                onExpandedTasksChange={setExpandedTasks}
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
                containerRef={containerRef}
                dateRange={dateRange}
                phases={phases}
                expandedTasks={expandedTasks}
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
    </GanttProvider>
  );
});

ProjectViewGantt.displayName = 'ProjectViewGantt';

export default ProjectViewGantt;
