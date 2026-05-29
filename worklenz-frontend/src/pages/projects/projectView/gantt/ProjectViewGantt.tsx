import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Spin, message } from '@/shared/antd-imports';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { UnifiedTimelineCalculator } from './utils/unified-timeline-calculator';
import { getColumnWidth } from './constants/gantt-constants';
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
  const { t } = useTranslation('gantt');
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
  } = useGetRoadmapTasksQuery(
    { projectId: projectId || '' },
    {
      skip: !projectId,
      pollingInterval: 30000,
    }
  );

  const {
    data: phasesResponse,
    error: phasesError,
    isLoading: phasesLoading,
    refetch: refetchPhases,
  } = useGetProjectPhasesQuery(
    { projectId: projectId || '' },
    {
      skip: !projectId,
      pollingInterval: 30000,
    }
  );

  const [reorderPhases, { isLoading: isReordering }] = useReorderPhasesMutation();

  // Transform API data to component format
  const tasks = useMemo(() => {
    if (tasksResponse?.body && phasesResponse?.body) {
      const transformedTasks = transformToGanttTasks(tasksResponse.body, phasesResponse.body);
      console.log('Transformed tasks from API:', transformedTasks);
      const result: any[] = [];

      transformedTasks.forEach(task => {
        if (task.type === 'milestone' || task.is_milestone) {
          console.log(`Adding phase to result: ${task.name}`, {
            start_date: task.start_date,
            end_date: task.end_date,
            phase_id: task.phase_id,
          });

          const taskCopy = {
            ...task,
            start_date: task.start_date ? new Date(task.start_date) : null,
            end_date: task.end_date ? new Date(task.end_date) : null,
            children: task.children ? [...task.children] : undefined,
          };

          result.push(taskCopy);

          const phaseId =
            task.id === 'phase-unmapped'
              ? 'unmapped'
              : task.phase_id || task.id.replace('phase-', '');
          const isExpanded = expandedTasks.has(phaseId);

          if (isExpanded && task.children) {
            task.children.forEach((child: any) => {
              result.push({
                ...child,
                start_date: child.start_date ? new Date(child.start_date) : null,
                end_date: child.end_date ? new Date(child.end_date) : null,
                phase_id: task.phase_id,
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

  const dateRange = useMemo(() => {
    if (tasks.length > 0) {
      const range = UnifiedTimelineCalculator.createAlignedDateRange(tasks, viewMode, true);
      console.log('Calculated date range:', {
        start: range.start,
        end: range.end,
        viewMode,
        tasksCount: tasks.length,
      });
      return range;
    }
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 15);
    const end = new Date(today);
    end.setDate(end.getDate() + 15);
    return { start, end };
  }, [tasks, viewMode]);

  const timelineCalculator = useMemo(() => {
    if (!dateRange) return null;
    const baseColumnWidth = getColumnWidth(viewMode);
    const calculator = new UnifiedTimelineCalculator(viewMode, dateRange, baseColumnWidth);

    console.log('Created timeline calculator:', {
      viewMode,
      baseColumnWidth,
      dateRange,
      columnsCount: calculator.getColumns().length,
      totalWidth: calculator.getConfiguration().totalWidth,
    });

    return calculator;
  }, [viewMode, dateRange]);

  const loading = tasksLoading || phasesLoading;

  useEffect(() => {
    dispatch(fetchPriorities());
  }, [dispatch]);

  useEffect(() => {
    if (!socket) return;

    const handleQuickTaskResponse = (response: any) => {
      if (response) {
        message.success(`Task "${response.name}" created successfully`);
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

  useEffect(() => {
    const currentExpanded = expandedTasks;
    const previousExpanded = prevExpandedTasks;

   const newlyExpanded = new Set(Array.from(currentExpanded).filter(id => !previousExpanded.has(id)));
const newlyCollapsed = new Set(Array.from(previousExpanded).filter(id => !currentExpanded.has(id)));

    if (newlyExpanded.size > 0 || newlyCollapsed.size > 0) {
     setAnimatingTasks(new Set(Array.from(newlyExpanded).concat(Array.from(newlyCollapsed))));
      const timeout = setTimeout(() => {
        setAnimatingTasks(new Set());
      }, 400);

      setPrevExpandedTasks(new Set(Array.from(currentExpanded)));

      return () => clearTimeout(timeout);
    }
  }, [expandedTasks, prevExpandedTasks]);

  const handleViewModeChange = useCallback((mode: GanttViewMode) => {
    setViewMode(mode);
  }, []);

  const handleChartScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;

    if (timelineRef.current) {
      timelineRef.current.scrollLeft = target.scrollLeft;
    }

    if (taskListRef.current) {
      taskListRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  const handleTaskListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;

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
      const newTaskViewModel = {
        id: null,
        name: DEFAULT_TASK_NAME,
        project_id: projectId,
        phase_id: phaseId || null,
      };

      dispatch(setSelectedTaskId(null));
      dispatch(setTaskFormViewModel(newTaskViewModel));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch, projectId]
  );

  const handleTaskClick = useCallback(
    (taskId: string) => {
      dispatch(setSelectedTaskId(taskId));
      dispatch(setTaskFormViewModel(null));
      dispatch(setShowTaskDrawer(true));

      if (projectId) {
        dispatch(fetchTask({ taskId, projectId }));
      }
    },
    [dispatch, projectId]
  );

  const handleClosePhaseModal = useCallback(() => {
    setShowPhaseModal(false);
    refetchTasks();
    refetchPhases();
  }, []);

  const handlePhaseClick = useCallback((phase: any) => {
    // Enrich children with assignees from the raw tasks response
    if (phase.children && tasksResponse?.body) {
      const rawTasks = tasksResponse.body;
      const enrichedChildren = phase.children.map((child: any) => {
        const rawTask = rawTasks.find((t: any) => t.id === child.id);
        return rawTask ? { ...child, assignees: rawTask.assignees || [] } : child;
      });
      setSelectedPhase({ ...phase, children: enrichedChildren });
    } else {
      setSelectedPhase(phase);
    }
    setShowPhaseDetailsModal(true);
  }, [tasksResponse]);

  const handleClosePhaseDetailsModal = useCallback(() => {
    setShowPhaseDetailsModal(false);
    setSelectedPhase(null);
  }, []);

  const handlePhaseUpdate = useCallback(
    (updatedPhase: any) => {
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

      const currentPhases = [...phasesResponse.body];
      const reorderedPhases = [...currentPhases];
      const [moved] = reorderedPhases.splice(oldIndex, 1);
      reorderedPhases.splice(newIndex, 0, moved);

      const phase_orders = reorderedPhases.map((phase, index) => ({
        phase_id: phase.id,
        sort_index: reorderedPhases.length - index,
      }));

      try {
        await reorderPhases({
          project_id: projectId,
          phase_orders,
        }).unwrap();

        message.success('Phases reordered successfully');
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
        return;
      }

      const taskData = {
        project_id: projectId,
        name: taskName.trim(),
        phase_id: phaseId || null,
        start_date: startDate ? startDate.toISOString().split('T')[0] : null,
      };

      socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(taskData));
    },
    [socket, projectId]
  );

  const handleTaskNameClick = useCallback(
    (task: any) => {
      if (chartRef.current && task.start_date && dateRange) {
        const totalTimeSpan = dateRange.end.getTime() - dateRange.start.getTime();
        const timeFromStart = new Date(task.start_date).getTime() - dateRange.start.getTime();

        const chartElement = chartRef.current;
        const chartWidth = chartElement.scrollWidth;
        const viewportWidth = chartElement.clientWidth;

        const taskPosition = (timeFromStart / totalTimeSpan) * chartWidth;
        const scrollPosition = Math.max(0, taskPosition - viewportWidth / 2);

        chartElement.scrollTo({
          left: scrollPosition,
          behavior: 'smooth',
        });

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
        timelineCalculator,
      }}
    >
      <div
        className="gantt-scroll-container"
        style={{
          height: 'calc(100vh - 220px)', // Adjust based on your header height
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex flex-col bg-gray-50 dark:bg-gray-900"
          style={{ paddingBottom: '24px' }}
        >
          <GanttToolbar
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            dateRange={dateRange}
          />
          <div className="flex flex-1 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
            <div className="relative flex w-full h-full">
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
                  onTaskClick={handleTaskClick}
                  containerRef={containerRef}
                  dateRange={dateRange}
                  phases={phases}
                  expandedTasks={expandedTasks}
                  animatingTasks={animatingTasks}
                  onCreateQuickTask={handleCreateQuickTask}
                  projectId={projectId || ''}
                  onRefresh={handleRefresh}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ManagePhaseModal
        open={showPhaseModal}
        onClose={handleClosePhaseModal}
        projectId={projectId}
      />

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
