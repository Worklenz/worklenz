import React, { useState } from 'react';
import { Button, Space, message } from '@/shared/antd-imports';
import ResizableRoadmapView from './ResizableRoadmapView';
import { sampleProjectRoadmap } from './sample-data';
import { ProjectPhase, ProjectRoadmap } from '../../types/project-roadmap.types';
import { useAppSelector } from '../../hooks/useAppSelector';

const ResizableRoadmapDemo: React.FC = () => {
  const [roadmap, setRoadmap] = useState<ProjectRoadmap>(sampleProjectRoadmap);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handlePhaseUpdate = (phaseId: string, updates: Partial<ProjectPhase>) => {
    setRoadmap(prevRoadmap => ({
      ...prevRoadmap,
      phases: prevRoadmap.phases.map(phase =>
        phase.id === phaseId ? { ...phase, ...updates } : phase
      ),
    }));

    message.success('Phase updated successfully!');
  };

  const handleTaskUpdate = (phaseId: string, taskId: string, updates: any) => {
    setRoadmap(prevRoadmap => ({
      ...prevRoadmap,
      phases: prevRoadmap.phases.map(phase =>
        phase.id === phaseId
          ? {
              ...phase,
              tasks: phase.tasks.map(task => (task.id === taskId ? { ...task, ...updates } : task)),
            }
          : phase
      ),
    }));

    message.success('Task updated successfully!');
  };

  const resetToSampleData = () => {
    setRoadmap(sampleProjectRoadmap);
    message.info('Roadmap reset to sample data');
  };

  const clearSavedWidth = () => {
    localStorage.removeItem('roadmap_left_panel_width_demo');
    message.info('Saved panel width cleared. Page will refresh to apply changes.');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="resizable-roadmap-demo p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Resizable Roadmap View
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-0">
                Interactive Gantt chart with a resizable left panel showing task names and section labels.
              </p>
            </div>
            <Space>
              <Button
                onClick={resetToSampleData}
                className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Reset Data
              </Button>
              <Button
                onClick={clearSavedWidth}
                className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear Saved Width
              </Button>
            </Space>
          </div>
        </div>
      </div>

      <ResizableRoadmapView
        roadmap={roadmap}
        projectId="demo"
        viewOptions={{
          viewMode: 'month',
          showTasks: true,
          showMilestones: true,
          groupByPhase: true,
        }}
        onPhaseUpdate={handlePhaseUpdate}
        onTaskUpdate={handleTaskUpdate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Resizable Panel Features:
            </h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Drag Divider:</strong> Click and
                drag the vertical divider between the left panel and timeline to resize
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Min Width:</strong> Left panel cannot
                be narrower than 180px (ensures readability)
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Max Width:</strong> Left panel cannot
                be wider than 480px (preserves timeline view)
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Persistent Storage:</strong> Your
                chosen width is saved per project in localStorage
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Smooth Animation:</strong> Width
                changes animate smoothly when not dragging
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Visual Feedback:</strong> Divider
                highlights on hover and during drag
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              View Features:
            </h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Left Panel Content:</strong> Shows
                all phases with their tasks hierarchically organized
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Scrollable Tasks:</strong> Left panel
                scrolls independently allowing browsing of all tasks
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Clickable Items:</strong> Click
                phases or tasks to open the detail modal
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Timeline Reflow:</strong> Day/timeline
                area automatically fills remaining horizontal space
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Theme Support:</strong> Works
                seamlessly in both light and dark themes
              </li>
              <li>
                • <strong className="text-gray-900 dark:text-gray-100">Responsive:</strong> Adapts to
                different screen sizes and view modes
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mt-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            How to Use:
          </h3>
          <ol className="space-y-2 text-gray-700 dark:text-gray-300 list-decimal list-inside">
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Resize the Panel:</strong> Position
              your cursor on the vertical line between the left panel and the timeline. The cursor will
              change to a resize cursor (double-headed arrow).
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Drag to Adjust Width:</strong> Click
              and drag left to make the panel narrower or right to make it wider. The panel respects the
              minimum (180px) and maximum (480px) width constraints.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">View Your Preferences:</strong> Once
              you release the mouse, your chosen width is automatically saved in your browser's
              localStorage per project.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Width Persists Across Sessions:</strong>{' '}
              When you return to this project, your preferred panel width will be restored automatically.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Switch View Modes:</strong> Use the
              Week/Month/Year buttons to change the timeline granularity. The panel width remains unchanged.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ResizableRoadmapDemo;
