import React, { useState, useMemo } from 'react';
import { Button, Space, message, Card } from 'antd';
import AdvancedGanttChart from './AdvancedGanttChart';
import { GanttTask, ColumnConfig } from '../../types/advanced-gantt.types';
import { useAppSelector } from '../../hooks/useAppSelector';
import { holidayPresets, workingDayPresets } from './TimelineMarkers';

// Enhanced sample data with more realistic project structure
const generateSampleTasks = (): GanttTask[] => {
  const baseDate = new Date(2024, 11, 1); // December 1, 2024
  
  return [
    // Project Phase 1: Planning & Design
    {
      id: 'project-1',
      name: '🚀 Web Platform Development',
      startDate: new Date(2024, 11, 1),
      endDate: new Date(2025, 2, 31),
      progress: 45,
      type: 'project',
      status: 'in-progress',
      priority: 'high',
      color: '#1890ff',
      hasChildren: true,
      isExpanded: true,
      level: 0,
    },
    {
      id: 'planning-phase',
      name: '📋 Planning & Analysis Phase',
      startDate: new Date(2024, 11, 1),
      endDate: new Date(2024, 11, 20),
      progress: 85,
      type: 'project',
      status: 'in-progress',
      priority: 'high',
      parent: 'project-1',
      color: '#52c41a',
      hasChildren: true,
      isExpanded: true,
      level: 1,
    },
    {
      id: 'requirements-analysis',
      name: 'Requirements Gathering & Analysis',
      startDate: new Date(2024, 11, 1),
      endDate: new Date(2024, 11, 8),
      progress: 100,
      type: 'task',
      status: 'completed',
      priority: 'high',
      parent: 'planning-phase',
      assignee: {
        id: 'user-1',
        name: 'Alice Johnson',
        avatar: 'https://ui-avatars.com/api/?name=Alice+Johnson&background=1890ff&color=fff',
      },
      tags: ['research', 'documentation'],
      level: 2,
    },
    {
      id: 'technical-architecture',
      name: 'Technical Architecture Design',
      startDate: new Date(2024, 11, 8),
      endDate: new Date(2024, 11, 18),
      progress: 75,
      type: 'task',
      status: 'in-progress',
      priority: 'high',
      parent: 'planning-phase',
      assignee: {
        id: 'user-2',
        name: 'Bob Smith',
        avatar: 'https://ui-avatars.com/api/?name=Bob+Smith&background=52c41a&color=fff',
      },
      dependencies: ['requirements-analysis'],
      tags: ['architecture', 'design'],
      level: 2,
    },
    {
      id: 'ui-ux-design',
      name: 'UI/UX Design & Prototyping',
      startDate: new Date(2024, 11, 10),
      endDate: new Date(2024, 11, 20),
      progress: 60,
      type: 'task',
      status: 'in-progress',
      priority: 'medium',
      parent: 'planning-phase',
      assignee: {
        id: 'user-3',
        name: 'Carol Davis',
        avatar: 'https://ui-avatars.com/api/?name=Carol+Davis&background=faad14&color=fff',
      },
      dependencies: ['requirements-analysis'],
      tags: ['design', 'prototype'],
      level: 2,
    },
    {
      id: 'milestone-planning-complete',
      name: '🎯 Planning Phase Complete',
      startDate: new Date(2024, 11, 20),
      endDate: new Date(2024, 11, 20),
      progress: 0,
      type: 'milestone',
      status: 'not-started',
      priority: 'critical',
      parent: 'planning-phase',
      dependencies: ['technical-architecture', 'ui-ux-design'],
      level: 2,
    },

    // Development Phase
    {
      id: 'development-phase',
      name: '⚡ Development Phase',
      startDate: new Date(2024, 11, 21),
      endDate: new Date(2025, 1, 28),
      progress: 35,
      type: 'project',
      status: 'in-progress',
      priority: 'high',
      parent: 'project-1',
      color: '#722ed1',
      hasChildren: true,
      isExpanded: true,
      level: 1,
    },
    {
      id: 'backend-development',
      name: 'Backend API Development',
      startDate: new Date(2024, 11, 21),
      endDate: new Date(2025, 1, 15),
      progress: 45,
      type: 'task',
      status: 'in-progress',
      priority: 'high',
      parent: 'development-phase',
      assignee: {
        id: 'user-4',
        name: 'David Wilson',
        avatar: 'https://ui-avatars.com/api/?name=David+Wilson&background=722ed1&color=fff',
      },
      dependencies: ['milestone-planning-complete'],
      tags: ['backend', 'api'],
      level: 2,
    },
    {
      id: 'frontend-development',
      name: 'Frontend React Application',
      startDate: new Date(2025, 0, 5),
      endDate: new Date(2025, 1, 25),
      progress: 25,
      type: 'task',
      status: 'in-progress',
      priority: 'high',
      parent: 'development-phase',
      assignee: {
        id: 'user-5',
        name: 'Eva Brown',
        avatar: 'https://ui-avatars.com/api/?name=Eva+Brown&background=ff7a45&color=fff',
      },
      dependencies: ['backend-development'],
      tags: ['frontend', 'react'],
      level: 2,
    },
    {
      id: 'database-setup',
      name: 'Database Schema & Migration',
      startDate: new Date(2024, 11, 21),
      endDate: new Date(2025, 0, 10),
      progress: 80,
      type: 'task',
      status: 'in-progress',
      priority: 'medium',
      parent: 'development-phase',
      assignee: {
        id: 'user-6',
        name: 'Frank Miller',
        avatar: 'https://ui-avatars.com/api/?name=Frank+Miller&background=13c2c2&color=fff',
      },
      dependencies: ['milestone-planning-complete'],
      tags: ['database', 'migration'],
      level: 2,
    },

    // Testing Phase
    {
      id: 'testing-phase',
      name: '🧪 Testing & QA Phase',
      startDate: new Date(2025, 2, 1),
      endDate: new Date(2025, 2, 20),
      progress: 0,
      type: 'project',
      status: 'not-started',
      priority: 'high',
      parent: 'project-1',
      color: '#fa8c16',
      hasChildren: true,
      isExpanded: false,
      level: 1,
    },
    {
      id: 'unit-testing',
      name: 'Unit Testing Implementation',
      startDate: new Date(2025, 2, 1),
      endDate: new Date(2025, 2, 10),
      progress: 0,
      type: 'task',
      status: 'not-started',
      priority: 'high',
      parent: 'testing-phase',
      assignee: {
        id: 'user-7',
        name: 'Grace Lee',
        avatar: 'https://ui-avatars.com/api/?name=Grace+Lee&background=fa8c16&color=fff',
      },
      dependencies: ['frontend-development'],
      tags: ['testing', 'unit'],
      level: 2,
    },
    {
      id: 'integration-testing',
      name: 'Integration & E2E Testing',
      startDate: new Date(2025, 2, 8),
      endDate: new Date(2025, 2, 18),
      progress: 0,
      type: 'task',
      status: 'not-started',
      priority: 'high',
      parent: 'testing-phase',
      assignee: {
        id: 'user-8',
        name: 'Henry Clark',
        avatar: 'https://ui-avatars.com/api/?name=Henry+Clark&background=eb2f96&color=fff',
      },
      dependencies: ['unit-testing'],
      tags: ['testing', 'integration'],
      level: 2,
    },
    {
      id: 'milestone-beta-ready',
      name: '🎯 Beta Release Ready',
      startDate: new Date(2025, 2, 20),
      endDate: new Date(2025, 2, 20),
      progress: 0,
      type: 'milestone',
      status: 'not-started',
      priority: 'critical',
      parent: 'testing-phase',
      dependencies: ['integration-testing'],
      level: 2,
    },

    // Deployment Phase
    {
      id: 'deployment-phase',
      name: '🚀 Deployment & Launch',
      startDate: new Date(2025, 2, 21),
      endDate: new Date(2025, 2, 31),
      progress: 0,
      type: 'project',
      status: 'not-started',
      priority: 'critical',
      parent: 'project-1',
      color: '#f5222d',
      hasChildren: true,
      isExpanded: false,
      level: 1,
    },
    {
      id: 'production-deployment',
      name: 'Production Environment Setup',
      startDate: new Date(2025, 2, 21),
      endDate: new Date(2025, 2, 25),
      progress: 0,
      type: 'task',
      status: 'not-started',
      priority: 'critical',
      parent: 'deployment-phase',
      assignee: {
        id: 'user-9',
        name: 'Ivy Taylor',
        avatar: 'https://ui-avatars.com/api/?name=Ivy+Taylor&background=f5222d&color=fff',
      },
      dependencies: ['milestone-beta-ready'],
      tags: ['deployment', 'production'],
      level: 2,
    },
    {
      id: 'go-live',
      name: 'Go Live & Monitoring',
      startDate: new Date(2025, 2, 26),
      endDate: new Date(2025, 2, 31),
      progress: 0,
      type: 'task',
      status: 'not-started',
      priority: 'critical',
      parent: 'deployment-phase',
      assignee: {
        id: 'user-10',
        name: 'Jack Anderson',
        avatar: 'https://ui-avatars.com/api/?name=Jack+Anderson&background=2f54eb&color=fff',
      },
      dependencies: ['production-deployment'],
      tags: ['launch', 'monitoring'],
      level: 2,
    },
    {
      id: 'milestone-project-complete',
      name: '🎉 Project Launch Complete',
      startDate: new Date(2025, 2, 31),
      endDate: new Date(2025, 2, 31),
      progress: 0,
      type: 'milestone',
      status: 'not-started',
      priority: 'critical',
      parent: 'deployment-phase',
      dependencies: ['go-live'],
      level: 2,
    },
  ];
};

// Enhanced column configuration
const sampleColumns: ColumnConfig[] = [
  { 
    field: 'name', 
    title: 'Task / Phase Name', 
    width: 300, 
    minWidth: 200, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'text'
  },
  { 
    field: 'assignee', 
    title: 'Assignee', 
    width: 150, 
    minWidth: 120, 
    resizable: true, 
    sortable: true, 
    fixed: true 
  },
  { 
    field: 'startDate', 
    title: 'Start Date', 
    width: 120, 
    minWidth: 100, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'date'
  },
  { 
    field: 'endDate', 
    title: 'End Date', 
    width: 120, 
    minWidth: 100, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'date'
  },
  { 
    field: 'duration', 
    title: 'Duration', 
    width: 80, 
    minWidth: 60, 
    resizable: true, 
    sortable: false, 
    fixed: true,
    align: 'center'
  },
  { 
    field: 'progress', 
    title: 'Progress', 
    width: 120, 
    minWidth: 100, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'number'
  },
  { 
    field: 'status', 
    title: 'Status', 
    width: 100, 
    minWidth: 80, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'select',
    editorOptions: [
      { value: 'not-started', label: 'Not Started' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'on-hold', label: 'On Hold' },
      { value: 'overdue', label: 'Overdue' },
    ]
  },
  { 
    field: 'priority', 
    title: 'Priority', 
    width: 100, 
    minWidth: 80, 
    resizable: true, 
    sortable: true, 
    fixed: true,
    editor: 'select',
    editorOptions: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ]
  },
];

const AdvancedGanttDemo: React.FC = () => {
  const [tasks, setTasks] = useState<GanttTask[]>(generateSampleTasks());
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handleTaskUpdate = (taskId: string, updates: Partial<GanttTask>) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
    message.success(`Task "${tasks.find(t => t.id === taskId)?.name}" updated`);
  };

  const handleTaskMove = (taskId: string, newDates: { start: Date; end: Date }) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, startDate: newDates.start, endDate: newDates.end }
          : task
      )
    );
    message.info(`Task moved: ${newDates.start.toLocaleDateString()} - ${newDates.end.toLocaleDateString()}`);
  };

  const handleProgressChange = (taskId: string, progress: number) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId ? { ...task, progress } : task
      )
    );
    message.info(`Progress updated: ${Math.round(progress)}%`);
  };

  const handleSelectionChange = (selection: any) => {
    setSelectedTasks(selection.selectedTasks);
  };

  const resetToSampleData = () => {
    setTasks(generateSampleTasks());
    setSelectedTasks([]);
    message.info('Gantt chart reset to sample data');
  };

  const addSampleTask = () => {
    const newTask: GanttTask = {
      id: `task-${Date.now()}`,
      name: `New Task ${tasks.length + 1}`,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      progress: 0,
      type: 'task',
      status: 'not-started',
      priority: 'medium',
      level: 0,
    };
    setTasks(prev => [...prev, newTask]);
    message.success('New task added');
  };

  const deleteSelectedTasks = () => {
    if (selectedTasks.length === 0) {
      message.warning('No tasks selected');
      return;
    }
    
    setTasks(prev => prev.filter(task => !selectedTasks.includes(task.id)));
    setSelectedTasks([]);
    message.success(`${selectedTasks.length} task(s) deleted`);
  };

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const overdue = tasks.filter(t => t.status === 'overdue').length;
    const avgProgress = tasks.reduce((sum, t) => sum + t.progress, 0) / total;

    return { total, completed, inProgress, overdue, avgProgress };
  }, [tasks]);

  return (
    <div className="advanced-gantt-demo p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-4">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                🚀 Advanced Gantt Chart Demo
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Professional Gantt chart with draggable tasks, virtual scrolling, holiday markers, 
                and performance optimizations for modern project management.
              </p>
            </div>
            
            <div className="flex flex-col items-end space-y-2">
              <Space>
                <Button 
                  onClick={addSampleTask}
                  type="primary"
                  className="dark:border-gray-600"
                >
                  Add Task
                </Button>
                <Button 
                  onClick={deleteSelectedTasks}
                  danger
                  disabled={selectedTasks.length === 0}
                  className="dark:border-gray-600"
                >
                  Delete Selected ({selectedTasks.length})
                </Button>
                <Button 
                  onClick={resetToSampleData}
                  className="dark:border-gray-600 dark:text-gray-300"
                >
                  Reset Data
                </Button>
              </Space>
            </div>
          </div>

          {/* Project Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-lg p-3">
              <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Tasks</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{taskStats.total}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-lg p-3">
              <div className="text-green-600 dark:text-green-400 text-sm font-medium">Completed</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{taskStats.completed}</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 rounded-lg p-3">
              <div className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">In Progress</div>
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{taskStats.inProgress}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 rounded-lg p-3">
              <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">Avg Progress</div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {Math.round(taskStats.avgProgress)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm" style={{ height: '70vh' }}>
        <AdvancedGanttChart
          tasks={tasks}
          columns={sampleColumns}
          timelineConfig={{
            showWeekends: true,
            showNonWorkingDays: true,
            holidays: holidayPresets.US,
            workingDays: workingDayPresets.standard,
            dayWidth: 30,
          }}
          onTaskUpdate={handleTaskUpdate}
          onTaskMove={handleTaskMove}
          onProgressChange={handleProgressChange}
          onSelectionChange={handleSelectionChange}
          enableDragDrop={true}
          enableResize={true}
          enableProgressEdit={true}
          enableInlineEdit={true}
          enableVirtualScrolling={true}
          className="h-full"
        />
      </div>

      {/* Feature List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mt-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            ✨ Advanced Features Demonstrated
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Performance & UX</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Virtual scrolling for 1000+ tasks</li>
                <li>• Smooth 60fps drag & drop</li>
                <li>• Debounced updates</li>
                <li>• Memory-optimized rendering</li>
                <li>• Responsive design</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Gantt Features</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Draggable task bars</li>
                <li>• Resizable task duration</li>
                <li>• Progress editing</li>
                <li>• Multi-level hierarchy</li>
                <li>• Task dependencies</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Timeline & Markers</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Weekend & holiday markers</li>
                <li>• Working day indicators</li>
                <li>• Today line</li>
                <li>• Multi-tier timeline</li>
                <li>• Zoom levels (Year/Month/Week/Day)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Grid Features</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Fixed columns layout</li>
                <li>• Inline editing</li>
                <li>• Column resizing</li>
                <li>• Multi-select</li>
                <li>• Hierarchical tree view</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">UI/UX</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Dark/Light theme support</li>
                <li>• Tailwind CSS styling</li>
                <li>• Consistent with Worklenz</li>
                <li>• Accessibility features</li>
                <li>• Mobile responsive</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Architecture</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Modern React patterns</li>
                <li>• TypeScript safety</li>
                <li>• Optimized performance</li>
                <li>• Enterprise features</li>
                <li>• Best practices 2025</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedGanttDemo;