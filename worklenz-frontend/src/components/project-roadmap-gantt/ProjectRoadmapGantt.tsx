import React, { useState, useMemo } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import { Button, Space, Badge } from 'antd';
import { CalendarOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { ProjectPhase, ProjectRoadmap, GanttViewOptions, PhaseModalData } from '../../types/project-roadmap.types';
import PhaseModal from './PhaseModal';
import { useAppSelector } from '../../hooks/useAppSelector';
import { themeWiseColor } from '../../utils/themeWiseColor';
import 'gantt-task-react/dist/index.css';
import './gantt-theme.css';

interface ProjectRoadmapGanttProps {
  roadmap: ProjectRoadmap;
  viewOptions?: Partial<GanttViewOptions>;
  onPhaseUpdate?: (phaseId: string, updates: Partial<ProjectPhase>) => void;
  onTaskUpdate?: (phaseId: string, taskId: string, updates: any) => void;
}

const ProjectRoadmapGantt: React.FC<ProjectRoadmapGanttProps> = ({
  roadmap,
  viewOptions = {},
  onPhaseUpdate,
  onTaskUpdate,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<PhaseModalData | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  
  // Theme support
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  const defaultViewOptions: GanttViewOptions = {
    viewMode: 'month',
    showTasks: true,
    showMilestones: true,
    groupByPhase: true,
    ...viewOptions,
  };

  // Theme-aware colors
  const ganttColors = useMemo(() => {
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
  const ganttTasks = useMemo(() => {
    const tasks: Task[] = [];

    roadmap.phases.forEach((phase, phaseIndex) => {
      // Add phase as main task with theme-aware colors
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
        phase.tasks.forEach((task) => {
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
              backgroundColor: themeWiseColor('rgba(59, 130, 246, 0.1)', 'rgba(96, 165, 250, 0.2)', themeMode),
            },
          };
          tasks.push(ganttTask);
        });
      }

      // Add milestones if enabled
      if (defaultViewOptions.showMilestones) {
        phase.milestones.forEach((milestone) => {
          const milestoneTask: Task = {
            id: milestone.id,
            name: milestone.name,
            start: milestone.dueDate,
            end: milestone.dueDate,
            progress: milestone.isCompleted ? 100 : 0,
            type: 'milestone',
            project: phase.id,
            styles: {
              progressColor: milestone.criticalPath ? ganttColors.criticalPath : ganttColors.progressBar,
              progressSelectedColor: milestone.criticalPath ? ganttColors.criticalPath : ganttColors.progressBar,
              backgroundColor: milestone.criticalPath ? 
                themeWiseColor('rgba(239, 68, 68, 0.1)', 'rgba(248, 113, 113, 0.2)', themeMode) :
                themeWiseColor('rgba(16, 185, 129, 0.1)', 'rgba(52, 211, 153, 0.2)', themeMode),
            },
          };
          tasks.push(milestoneTask);
        });
      }
    });

    return tasks;
  }, [roadmap.phases, defaultViewOptions, ganttColors, themeMode]);

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
    // Find the phase this task belongs to
    const phase = roadmap.phases.find(p => 
      p.tasks.some(t => t.id === task.id) || p.milestones.some(m => m.id === task.id)
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
      const parentPhase = roadmap.phases.find(p => 
        p.tasks.some(t => t.id === task.id)
      );
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
      const parentPhase = roadmap.phases.find(p => 
        p.tasks.some(t => t.id === task.id)
      );
      if (parentPhase) {
        onTaskUpdate(parentPhase.id, task.id, { progress: task.progress });
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#52c41a';
      case 'in-progress': return '#1890ff';
      case 'on-hold': return '#faad14';
      default: return '#d9d9d9';
    }
  };

  const columnWidth = viewMode === ViewMode.Year ? 350 : 
                    viewMode === ViewMode.Month ? 300 : 
                    viewMode === ViewMode.Week ? 250 : 60;

  return (
    <div className="project-roadmap-gantt w-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {roadmap.name}
              </h3>
              {roadmap.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-0">
                  {roadmap.description}
                </p>
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
            {roadmap.phases.map((phase) => (
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
                    <span>{phase.startDate.toLocaleDateString()} - {phase.endDate.toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <TeamOutlined className="w-4 h-4" />
                    <span>{phase.tasks.length} tasks</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <CheckCircleOutlined className="w-4 h-4" />
                    <span>{phase.progress}% complete</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="p-4">
          <div className="w-full overflow-x-auto">
            <div 
              className="gantt-container"
              style={{ 
                '--gantt-background': ganttColors.background,
                '--gantt-grid': ganttColors.grid,
                '--gantt-text': ganttColors.text.primary,
                '--gantt-border': ganttColors.border,
              } as React.CSSProperties}
            >
              <Gantt
                tasks={ganttTasks}
                viewMode={viewMode}
                onDateChange={handleDateChange}
                onProgressChange={handleProgressChange}
                onDoubleClick={handleTaskClick}
                listCellWidth=""
                columnWidth={columnWidth}
                todayColor={ganttColors.today}
                projectProgressColor={ganttColors.progressBar}
                projectBackgroundColor={themeWiseColor('rgba(82, 196, 26, 0.1)', 'rgba(52, 211, 153, 0.2)', themeMode)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Phase Modal */}
      <PhaseModal
        visible={isModalVisible}
        phase={selectedPhase}
        onClose={() => setIsModalVisible(false)}
        onUpdate={(updates) => {
          if (selectedPhase && onPhaseUpdate) {
            onPhaseUpdate(selectedPhase.id, updates);
          }
        }}
      />
    </div>
  );
};

export default ProjectRoadmapGantt;