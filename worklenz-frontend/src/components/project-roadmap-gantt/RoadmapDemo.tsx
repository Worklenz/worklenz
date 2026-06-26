import React, { useState } from 'react';
import { Button, Space, message } from '@/shared/antd-imports';
import ProjectRoadmapGantt from './ProjectRoadmapGantt';
import { sampleProjectRoadmap } from './sample-data';
import { ProjectPhase, ProjectRoadmap } from '../../types/project-roadmap.types';
import { useAppSelector } from '../../hooks/useAppSelector';

const RoadmapDemo: React.FC = () => {
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

  return (
    <div className="roadmap-demo p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-4">
        <div className="p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Project Roadmap Gantt Chart Demo
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-0">
                Interactive Gantt chart showing project phases as milestones/epics. Click on any
                phase card or Gantt bar to view detailed information in a modal.
              </p>
            </div>
            <Space>
              <Button
                onClick={resetToSampleData}
                className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Reset to Sample Data
              </Button>
            </Space>
          </div>
        </div>
      </div>

      <ProjectRoadmapGantt
        roadmap={roadmap}
        viewOptions={{
          viewMode: 'month',
          showTasks: true,
          showMilestones: true,
          groupByPhase: true,
        }}
        onPhaseUpdate={handlePhaseUpdate}
        onTaskUpdate={handleTaskUpdate}
      />

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mt-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Features Demonstrated:
          </h3>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Phase-based Grouping:</strong>{' '}
              Projects organized by phases (Planning, Development, Testing, Deployment)
            </li>
            <li>
              •{' '}
              <strong className="text-gray-900 dark:text-gray-100">Interactive Phase Cards:</strong>{' '}
              Click on phase cards for detailed view
            </li>
            <li>
              •{' '}
              <strong className="text-gray-900 dark:text-gray-100">
                Gantt Chart Visualization:
              </strong>{' '}
              Timeline view with tasks, milestones, and dependencies
            </li>
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Modal Details:</strong>{' '}
              Comprehensive phase information with tasks, milestones, and team members
            </li>
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Progress Tracking:</strong>{' '}
              Visual progress indicators and completion statistics
            </li>
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Multiple View Modes:</strong>{' '}
              Week, Month, and Year timeline views
            </li>
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Task Management:</strong> Task
              assignments, priorities, and status tracking
            </li>
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Milestone Tracking:</strong>{' '}
              Critical path milestones and completion status
            </li>
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Team Overview:</strong> Team
              member assignments and workload distribution
            </li>
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Editable Fields:</strong>{' '}
              In-modal editing for phase attributes (name, description, dates, status)
            </li>
            <li>
              • <strong className="text-gray-900 dark:text-gray-100">Theme Support:</strong>{' '}
              Automatic light/dark theme adaptation with consistent styling
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoadmapDemo;
