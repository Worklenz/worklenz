import { Task, User, Label } from '@/types/task-management.types';
import { nanoid } from 'nanoid';

// Mock users
export const mockUsers: User[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', avatar: '' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', avatar: '' },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com', avatar: '' },
  { id: '4', name: 'Alice Brown', email: 'alice@example.com', avatar: '' },
  { id: '5', name: 'Charlie Wilson', email: 'charlie@example.com', avatar: '' },
];

// Mock labels
export const mockLabels: Label[] = [
  { id: '1', name: 'Bug', color: '#ff4d4f' },
  { id: '2', name: 'Feature', color: '#52c41a' },
  { id: '3', name: 'Enhancement', color: '#1890ff' },
  { id: '4', name: 'Documentation', color: '#722ed1' },
  { id: '5', name: 'Urgent', color: '#fa541c' },
  { id: '6', name: 'Research', color: '#faad14' },
];

// Task titles for variety
const taskTitles = [
  'Implement user authentication system',
  'Design responsive navigation component',
  'Fix CSS styling issues on mobile',
  'Add drag and drop functionality',
  'Optimize database queries',
  'Write unit tests for API endpoints',
  'Update documentation for new features',
  'Refactor legacy code components',
  'Set up CI/CD pipeline',
  'Configure monitoring and logging',
  'Implement real-time notifications',
  'Create user onboarding flow',
  'Add search functionality',
  'Optimize image loading performance',
  'Implement data export feature',
  'Add multi-language support',
  'Create admin dashboard',
  'Fix memory leak in background process',
  'Implement caching strategy',
  'Add email notification system',
  'Create API rate limiting',
  'Implement user roles and permissions',
  'Add file upload functionality',
  'Create backup and restore system',
  'Implement advanced filtering',
  'Add calendar integration',
  'Create reporting dashboard',
  'Implement websocket connections',
  'Add payment processing',
  'Create mobile app version',
];

const taskDescriptions = [
  'This task requires careful consideration of security best practices and user experience.',
  'Need to ensure compatibility across all modern browsers and devices.',
  'Critical bug that affects user workflow and needs immediate attention.',
  'Enhancement to improve overall system performance and user satisfaction.',
  'Research task to explore new technologies and implementation approaches.',
  'Documentation update to keep project information current and accurate.',
  'Refactoring work to improve code maintainability and reduce technical debt.',
  'Testing task to ensure reliability and prevent regression bugs.',
];

const statuses: Task['status'][] = ['todo', 'doing', 'done'];
const priorities: Task['priority'][] = ['critical', 'high', 'medium', 'low'];
const phases = ['Planning', 'Development', 'Testing', 'Deployment'];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements<T>(array: T[], min: number = 0, max?: number): T[] {
  const maxCount = max ?? array.length;
  const count = Math.floor(Math.random() * (maxCount - min + 1)) + min;
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomProgress(): number {
  const progressOptions = [0, 10, 25, 50, 75, 90, 100];
  return getRandomElement(progressOptions);
}

function getRandomTimeTracking() {
  const estimated = Math.floor(Math.random() * 40) + 1; // 1-40 hours
  const logged = Math.floor(Math.random() * estimated); // 0 to estimated hours
  return { estimated, logged };
}

function getRandomDueDate(): string | undefined {
  if (Math.random() < 0.7) {
    // 70% chance of having a due date
    const now = new Date();
    const daysToAdd = Math.floor(Math.random() * 30) - 10; // -10 to +20 days from now
    const dueDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return dueDate.toISOString().split('T')[0];
  }
  return undefined;
}

export function generateMockTask(index: number): Task {
  const now = new Date();
  const createdAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Up to 30 days ago

  return {
    id: nanoid(),
    title: getRandomElement(taskTitles),
    description: Math.random() < 0.8 ? getRandomElement(taskDescriptions) : undefined,
    status: getRandomElement(statuses),
    priority: getRandomElement(priorities),
    phase: getRandomElement(phases),
    progress: getRandomProgress(),
    assignees: getRandomElements(mockUsers, 0, 3).map(user => user.id), // 0-3 assignees
    labels: getRandomElements(mockLabels, 0, 4).map(label => label.id), // 0-4 labels
    dueDate: getRandomDueDate(),
    timeTracking: getRandomTimeTracking(),
    customFields: {},
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    order: index,
  };
}

export function generateMockTasks(count: number = 100): Task[] {
  return Array.from({ length: count }, (_, index) => generateMockTask(index));
}

// Generate tasks with specific distribution for testing
export function generateBalancedMockTasks(count: number = 100): Task[] {
  const tasks: Task[] = [];
  const statusDistribution = { todo: 0.4, doing: 0.4, done: 0.2 };
  const priorityDistribution = { critical: 0.1, high: 0.3, medium: 0.4, low: 0.2 };

  for (let i = 0; i < count; i++) {
    const task = generateMockTask(i);

    // Distribute statuses
    const statusRand = Math.random();
    if (statusRand < statusDistribution.todo) {
      task.status = 'todo';
    } else if (statusRand < statusDistribution.todo + statusDistribution.doing) {
      task.status = 'doing';
    } else {
      task.status = 'done';
    }

    // Distribute priorities
    const priorityRand = Math.random();
    if (priorityRand < priorityDistribution.critical) {
      task.priority = 'critical';
    } else if (priorityRand < priorityDistribution.critical + priorityDistribution.high) {
      task.priority = 'high';
    } else if (
      priorityRand <
      priorityDistribution.critical + priorityDistribution.high + priorityDistribution.medium
    ) {
      task.priority = 'medium';
    } else {
      task.priority = 'low';
    }

    tasks.push(task);
  }

  return tasks;
}
