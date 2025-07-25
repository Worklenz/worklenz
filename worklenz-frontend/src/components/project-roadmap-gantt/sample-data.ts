import { ProjectRoadmap, ProjectPhase, PhaseTask, PhaseMilestone } from '../../types/project-roadmap.types';

// Sample tasks for Planning Phase
const planningTasks: PhaseTask[] = [
  {
    id: 'task-planning-1',
    name: 'Project Requirements Analysis',
    description: 'Gather and analyze project requirements from stakeholders',
    startDate: new Date(2024, 11, 1), // December 1, 2024
    endDate: new Date(2024, 11, 5),
    progress: 100,
    assigneeId: 'user-1',
    assigneeName: 'Alice Johnson',
    priority: 'high',
    status: 'done',
  },
  {
    id: 'task-planning-2',
    name: 'Technical Architecture Design',
    description: 'Design the technical architecture and system components',
    startDate: new Date(2024, 11, 6),
    endDate: new Date(2024, 11, 12),
    progress: 75,
    assigneeId: 'user-2',
    assigneeName: 'Bob Smith',
    priority: 'high',
    status: 'in-progress',
  },
  {
    id: 'task-planning-3',
    name: 'Resource Allocation Planning',
    description: 'Plan and allocate team resources for the project',
    startDate: new Date(2024, 11, 8),
    endDate: new Date(2024, 11, 15),
    progress: 50,
    assigneeId: 'user-3',
    assigneeName: 'Carol Davis',
    priority: 'medium',
    status: 'in-progress',
    dependencies: ['task-planning-1'],
  }
];

// Sample milestones for Planning Phase
const planningMilestones: PhaseMilestone[] = [
  {
    id: 'milestone-planning-1',
    name: 'Requirements Approved',
    description: 'All project requirements have been reviewed and approved by stakeholders',
    dueDate: new Date(2024, 11, 5),
    isCompleted: true,
    criticalPath: true,
  },
  {
    id: 'milestone-planning-2',
    name: 'Architecture Review Complete',
    description: 'Technical architecture has been reviewed and approved',
    dueDate: new Date(2024, 11, 15),
    isCompleted: false,
    criticalPath: true,
  }
];

// Sample tasks for Development Phase
const developmentTasks: PhaseTask[] = [
  {
    id: 'task-dev-1',
    name: 'Frontend Component Development',
    description: 'Develop core frontend components using React',
    startDate: new Date(2024, 11, 16),
    endDate: new Date(2025, 0, 31), // January 31, 2025
    progress: 30,
    assigneeId: 'user-4',
    assigneeName: 'David Wilson',
    priority: 'high',
    status: 'in-progress',
    dependencies: ['task-planning-2'],
  },
  {
    id: 'task-dev-2',
    name: 'Backend API Development',
    description: 'Develop REST APIs and database models',
    startDate: new Date(2024, 11, 16),
    endDate: new Date(2025, 0, 25),
    progress: 45,
    assigneeId: 'user-5',
    assigneeName: 'Eva Brown',
    priority: 'high',
    status: 'in-progress',
    dependencies: ['task-planning-2'],
  },
  {
    id: 'task-dev-3',
    name: 'Database Setup and Migration',
    description: 'Set up production database and create migration scripts',
    startDate: new Date(2024, 11, 20),
    endDate: new Date(2025, 0, 15),
    progress: 80,
    assigneeId: 'user-6',
    assigneeName: 'Frank Miller',
    priority: 'medium',
    status: 'in-progress',
  }
];

// Sample milestones for Development Phase
const developmentMilestones: PhaseMilestone[] = [
  {
    id: 'milestone-dev-1',
    name: 'Core Components Complete',
    description: 'All core frontend components have been developed and tested',
    dueDate: new Date(2025, 0, 20),
    isCompleted: false,
    criticalPath: false,
  },
  {
    id: 'milestone-dev-2',
    name: 'API Development Complete',
    description: 'All backend APIs are developed and documented',
    dueDate: new Date(2025, 0, 25),
    isCompleted: false,
    criticalPath: true,
  }
];

// Sample tasks for Testing Phase
const testingTasks: PhaseTask[] = [
  {
    id: 'task-test-1',
    name: 'Unit Testing Implementation',
    description: 'Write and execute comprehensive unit tests',
    startDate: new Date(2025, 1, 1), // February 1, 2025
    endDate: new Date(2025, 1, 15),
    progress: 0,
    assigneeId: 'user-7',
    assigneeName: 'Grace Lee',
    priority: 'high',
    status: 'todo',
    dependencies: ['task-dev-1', 'task-dev-2'],
  },
  {
    id: 'task-test-2',
    name: 'Integration Testing',
    description: 'Perform integration testing between frontend and backend',
    startDate: new Date(2025, 1, 10),
    endDate: new Date(2025, 1, 25),
    progress: 0,
    assigneeId: 'user-8',
    assigneeName: 'Henry Clark',
    priority: 'high',
    status: 'todo',
    dependencies: ['task-test-1'],
  },
  {
    id: 'task-test-3',
    name: 'User Acceptance Testing',
    description: 'Conduct user acceptance testing with stakeholders',
    startDate: new Date(2025, 1, 20),
    endDate: new Date(2025, 2, 5), // March 5, 2025
    progress: 0,
    assigneeId: 'user-9',
    assigneeName: 'Ivy Taylor',
    priority: 'medium',
    status: 'todo',
    dependencies: ['task-test-2'],
  }
];

// Sample milestones for Testing Phase
const testingMilestones: PhaseMilestone[] = [
  {
    id: 'milestone-test-1',
    name: 'All Tests Passing',
    description: 'All unit and integration tests are passing',
    dueDate: new Date(2025, 1, 25),
    isCompleted: false,
    criticalPath: true,
  },
  {
    id: 'milestone-test-2',
    name: 'UAT Sign-off',
    description: 'User acceptance testing completed and signed off',
    dueDate: new Date(2025, 2, 5),
    isCompleted: false,
    criticalPath: true,
  }
];

// Sample tasks for Deployment Phase
const deploymentTasks: PhaseTask[] = [
  {
    id: 'task-deploy-1',
    name: 'Production Environment Setup',
    description: 'Configure and set up production environment',
    startDate: new Date(2025, 2, 6), // March 6, 2025
    endDate: new Date(2025, 2, 12),
    progress: 0,
    assigneeId: 'user-10',
    assigneeName: 'Jack Anderson',
    priority: 'high',
    status: 'todo',
    dependencies: ['task-test-3'],
  },
  {
    id: 'task-deploy-2',
    name: 'Application Deployment',
    description: 'Deploy application to production environment',
    startDate: new Date(2025, 2, 13),
    endDate: new Date(2025, 2, 15),
    progress: 0,
    assigneeId: 'user-11',
    assigneeName: 'Kelly White',
    priority: 'high',
    status: 'todo',
    dependencies: ['task-deploy-1'],
  },
  {
    id: 'task-deploy-3',
    name: 'Post-Deployment Monitoring',
    description: 'Monitor application performance post-deployment',
    startDate: new Date(2025, 2, 16),
    endDate: new Date(2025, 2, 20),
    progress: 0,
    assigneeId: 'user-12',
    assigneeName: 'Liam Garcia',
    priority: 'medium',
    status: 'todo',
    dependencies: ['task-deploy-2'],
  }
];

// Sample milestones for Deployment Phase
const deploymentMilestones: PhaseMilestone[] = [
  {
    id: 'milestone-deploy-1',
    name: 'Production Go-Live',
    description: 'Application is live in production environment',
    dueDate: new Date(2025, 2, 15),
    isCompleted: false,
    criticalPath: true,
  },
  {
    id: 'milestone-deploy-2',
    name: 'Project Handover',
    description: 'Project handed over to maintenance team',
    dueDate: new Date(2025, 2, 20),
    isCompleted: false,
    criticalPath: false,
  }
];

// Sample project phases
const samplePhases: ProjectPhase[] = [
  {
    id: 'phase-planning',
    name: 'Planning & Analysis',
    description: 'Initial project planning, requirements gathering, and technical analysis',
    startDate: new Date(2024, 11, 1),
    endDate: new Date(2024, 11, 15),
    progress: 75,
    color: '#1890ff',
    status: 'in-progress',
    tasks: planningTasks,
    milestones: planningMilestones,
  },
  {
    id: 'phase-development',
    name: 'Development',
    description: 'Core development of frontend, backend, and database components',
    startDate: new Date(2024, 11, 16),
    endDate: new Date(2025, 0, 31),
    progress: 40,
    color: '#52c41a',
    status: 'in-progress',
    tasks: developmentTasks,
    milestones: developmentMilestones,
  },
  {
    id: 'phase-testing',
    name: 'Testing & QA',
    description: 'Comprehensive testing including unit, integration, and user acceptance testing',
    startDate: new Date(2025, 1, 1),
    endDate: new Date(2025, 2, 5),
    progress: 0,
    color: '#faad14',
    status: 'not-started',
    tasks: testingTasks,
    milestones: testingMilestones,
  },
  {
    id: 'phase-deployment',
    name: 'Deployment & Launch',
    description: 'Production deployment and project launch activities',
    startDate: new Date(2025, 2, 6),
    endDate: new Date(2025, 2, 20),
    progress: 0,
    color: '#722ed1',
    status: 'not-started',
    tasks: deploymentTasks,
    milestones: deploymentMilestones,
  }
];

// Sample project roadmap
export const sampleProjectRoadmap: ProjectRoadmap = {
  id: 'roadmap-sample-project',
  projectId: 'project-web-platform',
  name: 'Web Platform Development Roadmap',
  description: 'Comprehensive roadmap for developing a new web-based platform with modern technologies and agile methodologies',
  startDate: new Date(2024, 11, 1),
  endDate: new Date(2025, 2, 20),
  phases: samplePhases,
  createdAt: new Date(2024, 10, 15),
  updatedAt: new Date(2024, 11, 1),
};

export default sampleProjectRoadmap;