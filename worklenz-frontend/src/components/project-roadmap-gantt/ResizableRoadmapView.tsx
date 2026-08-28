import React, { useState, useEffect, useRef } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import { Button, Space, Badge } from '@/shared/antd-imports';
import { CalendarOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {
  ProjectPhase,
  ProjectRoadmap,
  GanttViewOptions,
  PhaseModalData,
} from '../../types/project-roadmap.types';
import PhaseModal from './PhaseModal';
import { useAppSelector } from '../../hooks/useAppSelector';
import { themeWiseColor } from '../../utils/themeWiseColor';
import { useTranslation } from 'react-i18next';
import 'gantt-task-react/dist/index.css';
import './gantt-theme.css';
import './resizable-roadmap.css';

interface ResizableRoadmapViewProps {
  roadmap: ProjectRoadmap;
  viewOptions?: Partial<GanttViewOptions>;
  onPhaseUpdate?: (phaseId: string, updates: Partial<ProjectPhase>) => void;
  onTaskUpdate?: (phaseId: string, taskId: string, updates: any) => void;
  projectId?: string;
}

const MIN_LEFT_PANEL_WIDTH = 180;
const MAX_LEFT_PANEL_WIDTH = 480;
const DEFAULT_WIDTH = 280;
const STORAGE_KEY_PREFIX = 'roadmap_left_panel_width';

const ResizableRoadmapView: React.FC<ResizableRoadmapViewProps> = ({
  roadmap,
  viewOptions = {},
  onPhaseUpdate,
  onTaskUpdate,
  projectId,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<PhaseModalData | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  
  // Initialize left panel width from localStorage
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    if (projectId) {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}_${projectId}`);
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= MIN_LEFT_PANEL_WIDTH && width <= MAX_LEFT_PANEL_WIDTH) {
          return width;
        }
      }
    }
    return DEFAULT_WIDTH;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const currentWidthRef = useRef<number>(leftPanelWidth);

  // Theme support
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('gantt');

  const defaultViewOptions: GanttViewOptions = {
    viewMode: 'month',
    showTasks: true,
    showMilestones: true,
    groupByPhase: true,
    ...viewOptions,
  };

  // Theme-aware colors
  const ganttColors = React.useMemo(() => {
    return {
      background: themeWiseColor('#ffffff', '#1f2937', themeMode),
      surface: themeWiseColor('#f8f9fa', '#374151', themeMode),
      border: themeWiseColor('#e5e7eb', '#4b5563', themeMode),
      taskBar: themeWiseColor('#3b82f6', '#60a5fa', themeMode),
      taskBarHover: themeWiseColor('#2563eb', '#93c5fd', themeMode),
      progressBar: themeWiseColor('#10b981', '#34d399', themeMode),
      milestone: themeWiseColor('#f59e0b', '#fbbf24', themeMode),
      criticalPath: themeWiseColor('#ef4444', '#f87171', themeMode),
      text: {
        primary: themeWiseColor('#111827', '#f9fafb', themeMode),
        secondary: themeWiseColor('#6b7280', '#d1d5db', themeMode),
      },
      grid: themeWiseColor('#f3f4f6', '#4b5563', themeMode),
      today: themeWiseColor('rgba(59, 130, 246, 0.1)', 'rgba(96, 165, 250, 0.2)', themeMode),
    };
  }, [themeMode]);

  // Convert phases to Gantt tasks
  const ganttTasks = React.useMemo(() => {
    const tasks: Task[] = [];

    roadmap.phases.forEach((phase) => {
      // Add phase as main task
      const phaseTask: Task = {
        id: phase.id,
        name: phase.name,
        start: phase.startDate,
        end: phase.endDate,
        progress: phase.progress,
        type: 'project',
        styles: {
          progressColor: themeWiseColor(phase.color, phase.color, themeMode),
          progressSelectedColor: themeWiseColor(phase.color, phase.color, themeMode),
          backgroundColor: themeWiseColor(`${phase.color}20`, `${phase.color}30`, themeMode),
        },
      };
      tasks.push(phaseTask);

      // Add phase tasks if enabled
      if (defaultViewOptions.showTasks) {
        phase.tasks.forEach(task => {
          const ganttTask: Task = {
            id: task.id,
            name: task.name,
            start: task.startDate,
            end: task.endDate,
            progress: task.progress,
            type: 'task',
            project: phase.id,
            dependencies: task.dependencies,
            styles: {
              progressColor: ganttColors.taskBar,
              progressSelectedColor: ganttColors.taskBarHover,
              backgroundColor: themeWiseColor(
                'rgba(59, 130, 246, 0.1)',
                'rgba(96, 165, 250, 0.2)',
                themeMode
              ),
            },
          };
          tasks.push(ganttTask);
        });
      }

      // Add milestones if enabled
      if (defaultViewOptions.showMilestones) {
        phase.milestones.forEach(milestone => {
          const milestoneTask: Task = {
            id: milestone.id,
            name: milestone.name,
            start: milestone.dueDate,
            end: milestone.dueDate,
            progress: milestone.isCompleted ? 100 : 0,
            type: 'milestone',
            project: phase.id,
            styles: {
              progressColor: milestone.criticalPath
                ? ganttColors.criticalPath
                : ganttColors.progressBar,
              progressSelectedColor: milestone.criticalPath
                ? ganttColors.criticalPath
                : ganttColors.progressBar,
              backgroundColor: milestone.criticalPath
                ? themeWiseColor('rgba(239, 68, 68, 0.1)', 'rgba(248, 113, 113, 0.2)', themeMode)
                : themeWiseColor('rgba(16, 185, 129, 0.1)', 'rgba(52, 211, 153, 0.2)', themeMode),
            },
          };
          tasks.push(milestoneTask);
        });
      }
    });

    return tasks;
  }, [roadmap.phases, defaultViewOptions, ganttColors, themeMode]);

  // Keep track of current width in ref for use in closures
  useEffect(() => {
    currentWidthRef.current = leftPanelWidth;
  }, [leftPanelWidth]);

  // Setup drag listeners - IMPORTANT: Only depends on projectId, NOT leftPanelWidth
  // This prevents re-attaching listeners during every drag update
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      // Constrain width to min/max values
      if (newWidth >= MIN_LEFT_PANEL_WIDTH && newWidth <= MAX_LEFT_PANEL_WIDTH) {
        setLeftPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current && projectId) {
        // Use ref to get latest width
        localStorage.setItem(`${STORAGE_KEY_PREFIX}_${projectId}`, currentWidthRef.current.toString());
      }
      isDraggingRef.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove, false);
    document.addEventListener('mouseup', handleMouseUp, false);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, false);
      document.removeEventListener('mouseup', handleMouseUp, false);
    };
  }, [projectId]);

  // Save width on unmount
  useEffect(() => {
    return () => {
      if (projectId && leftPanelWidth) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}_${projectId}`, leftPanelWidth.toString());
      }
    };
  }, [projectId]);

  const handleDividerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handlePhaseClick = (phase: ProjectPhase) => {
    const taskCount = phase.tasks.length;
    const completedTaskCount = phase.tasks.filter(task => task.status === 'done').length;
    const milestoneCount = phase.milestones.length;
    const completedMilestoneCount = phase.milestones.filter(m => m.isCompleted).length;
    const teamMembers = [...new Set(phase.tasks.map(task => task.assigneeName).filter(Boolean))];

    const phaseModalData: PhaseModalData = {
      ...phase,
      taskCount,
      completedTaskCount,
      milestoneCount,
      completedMilestoneCount,
      teamMembers,
    };

    setSelectedPhase(phaseModalData);
    setIsModalVisible(true);
  };

  const handleTaskClick = (task: Task) => {
    const phase = roadmap.phases.find(
      p => p.tasks.some(t => t.id === task.id) || p.milestones.some(m => m.id === task.id)
    );

    if (phase) {
      handlePhaseClick(phase);
    }
  };

  const handleDateChange = (task: Task) => {
    const phase = roadmap.phases.find(p => p.id === task.id);
    if (phase && onPhaseUpdate) {
      onPhaseUpdate(phase.id, {
        startDate: task.start,
        endDate: task.end,
      });
    } else if (onTaskUpdate) {
      const parentPhase = roadmap.phases.find(p => p.tasks.some(t => t.id === task.id));
      if (parentPhase) {
        onTaskUpdate(parentPhase.id, task.id, {
          startDate: task.start,
          endDate: task.end,
        });
      }
    }
  };

  const handleProgressChange = (task: Task) => {
    const phase = roadmap.phases.find(p => p.id === task.id);
    if (phase && onPhaseUpdate) {
      onPhaseUpdate(phase.id, { progress: task.progress });
    } else if (onTaskUpdate) {
      const parentPhase = roadmap.phases.find(p => p.tasks.some(t => t.id === task.id));
      if (parentPhase) {
        onTaskUpdate(parentPhase.id, task.id, { progress: task.progress });
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#52c41a';
      case 'in-progress':
        return '#1890ff';
      case 'on-hold':
        return '#faad14';
      default:
        return '#d9d9d9';
    }
  };

  const columnWidth =
    viewMode === ViewMode.Year
      ? 350
      : viewMode === ViewMode.Month
        ? 300
        : viewMode === ViewMode.Week
          ? 250
          : 60;

  return (
    <div className="resizable-roadmap-view w-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {roadmap.name}
              </h3>
              {roadmap.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-0">{roadmap.description}</p>
              )}
            </div>
            <Space>
              <Button
                type={viewMode === ViewMode.Week ? 'primary' : 'default'}
                onClick={() => setViewMode(ViewMode.Week)}
                className="dark:border-gray-600 dark:text-gray-300"
              >
                Week
              </Button>
              <Button
                type={viewMode === ViewMode.Month ? 'primary' : 'default'}
                onClick={() => setViewMode(ViewMode.Month)}
                className="dark:border-gray-600 dark:text-gray-300"
              >
                Month
              </Button>
              <Button
                type={viewMode === ViewMode.Year ? 'primary' : 'default'}
                onClick={() => setViewMode(ViewMode.Year)}
                className="dark:border-gray-600 dark:text-gray-300"
              >
                Year
              </Button>
            </Space>
          </div>

          {/* Phase Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {roadmap.phases.map(phase => (
              <div
                key={phase.id}
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 cursor-pointer hover:shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200"
                onClick={() => handlePhaseClick(phase)}
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    color={getStatusColor(phase.status)}
                    text={
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {phase.name}
                      </span>
                    }
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <CalendarOutlined className="w-4 h-4" />
                    <span>
                      {phase.startDate.toLocaleDateString()} - {phase.endDate.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <TeamOutlined className="w-4 h-4" />
                    <span>{phase.tasks.length} {t('roadmap.tasksCount', { defaultValue: 'tasks' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <CheckCircleOutlined className="w-4 h-4" />
                    <span>{phase.progress}% {t('roadmap.complete', { defaultValue: 'complete' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resizable Container */}
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden flex"
        style={{ minHeight: '500px', height: '100%' }}
      >
        {/* Left Panel */}
        <div
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto flex flex-col"
          style={{
            width: `${leftPanelWidth}px`,
          }}
        >
          <div className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex-shrink-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 m-0">
              {t('roadmap.phasesAndTasks', { defaultValue: 'Phases & Tasks' })}
            </h4>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            {roadmap.phases.map(phase => (
              <div key={phase.id} className="mb-4">
                <div
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => handlePhaseClick(phase)}
                >
                  {phase.name}
                </div>
                {defaultViewOptions.showTasks && (
                  <div className="ml-2 space-y-1">
                    {phase.tasks.map(task => (
                      <div
                        key={task.id}
                        className="text-xs text-gray-600 dark:text-gray-400 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer truncate"
                        title={task.name}
                      >
                        └ {task.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Divider - THE KEY ELEMENT */}
        <div
          className="bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 dark:hover:bg-blue-400 cursor-col-resize transition-colors flex-shrink-0 select-none"
          style={{
            width: '8px',
            padding: '0 2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseDown={handleDividerMouseDown}
          title="Drag to resize (180px - 480px)"
        >
          <div
            style={{
              width: '2px',
              height: '40px',
              backgroundColor: 'currentColor',
              opacity: 0.5,
            }}
          />
        </div>

        {/* Right Panel - Gantt Chart */}
        <div
          className="flex-1 overflow-x-auto"
        >
          <div
            className="gantt-container"
            style={
              {
                '--gantt-background': ganttColors.background,
                '--gantt-grid': ganttColors.grid,
                '--gantt-text': ganttColors.text.primary,
                '--gantt-border': ganttColors.border,
              } as React.CSSProperties
            }
          >
            <Gantt
              tasks={ganttTasks}
              viewMode={viewMode}
              onDateChange={handleDateChange}
              onProgressChange={handleProgressChange}
              onDoubleClick={handleTaskClick}
              listCellWidth="0"
              columnWidth={columnWidth}
              todayColor={ganttColors.today}
              projectProgressColor={ganttColors.progressBar}
              projectBackgroundColor={themeWiseColor(
                'rgba(82, 196, 26, 0.1)',
                'rgba(52, 211, 153, 0.2)',
                themeMode
              )}
            />
          </div>
        </div>
      </div>

      {/* Phase Modal */}
      <PhaseModal
        visible={isModalVisible}
        phase={selectedPhase}
        onClose={() => setIsModalVisible(false)}
        onUpdate={updates => {
          if (selectedPhase && onPhaseUpdate) {
            onPhaseUpdate(selectedPhase.id, updates);
          }
        }}
      />
    </div>
  );
};

export default ResizableRoadmapView;
