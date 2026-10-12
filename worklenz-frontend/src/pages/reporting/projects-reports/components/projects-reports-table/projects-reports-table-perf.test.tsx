import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ProjectsReportsTable from './projects-reports-table';
import type { IRPTProject } from '@/types/reporting/reporting.types';

// Mock canvas getContext for Chart.js in jsdom
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => []),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock socket to record listener registrations
const socketListeners = new Map<string, Set<(...args: any[]) => void>>();
const mockSocket = {
  on: vi.fn((event: string, handler: (...args: any[]) => void) => {
    if (!socketListeners.has(event)) {
      socketListeners.set(event, new Set());
    }
    socketListeners.get(event)!.add(handler);
  }),
  off: vi.fn((event: string, handler: (...args: any[]) => void) => {
    socketListeners.get(event)?.delete(handler);
  }),
  emit: vi.fn(),
};

vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({
    socket: mockSocket,
    connected: true,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? '')
      ),
  }),
}));

// Mock drawer to isolate table measurement
vi.mock(
  '@/features/reporting/projectReports/projectReportsDrawer/ProjectReportsDrawer',
  () => ({
    default: () => null,
  })
);

const mockDispatch = vi.fn();
vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

const makeMockProject = (index: number): IRPTProject => ({
  id: `proj-${index}`,
  name: `Project Alpha ${index}`,
  color_code: '#1890ff',
  project_health: 'health-1',
  health_name: 'Good',
  health_color: '#52c41a',
  category_id: 'cat-1',
  category_name: 'Engineering',
  category_color: '#1890ff',
  client: 'Acme Corp',
  team_id: 'team-1',
  team_name: 'Core Team',
  team_color: '#722ed1',
  status_id: 'status-1',
  status: {
    name: 'In Progress',
    color_code: '#1890ff',
    icon: 'clock-circle',
  },
  status_name: 'In Progress',
  status_color: '#1890ff',
  status_icon: 'clock-circle',
  priority_id: 'pri-1',
  priority_name: 'High',
  priority_color: '#faad14',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  days_left: 45,
  is_overdue: false,
  is_today: false,
  project_manager: {
    id: `pm-${index}`,
    name: 'Jane Doe',
    email: 'jane@example.com',
    avatar_url: null,
    color_code: '#13c2c2',
    active: true,
    pending_invitation: false,
    project_manager_info: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      avatar_url: null,
    },
  } as any,
  estimated_time: 120,
  estimated_time_string: '2h',
  actual_time: 3600,
  actual_time_string: '1h',
  tasks_stat: {
    total: 10,
    done: 5,
    doing: 3,
    todo: 2,
  },
  comment: 'Weekly status update is on track with milestones.',
  last_activity: {
    last_activity_string: 'Task completed 2 hours ago',
  } as any,
});

const generateProjects = (count: number) =>
  Array.from({ length: count }, (_, i) => makeMockProject(i + 1));

let mockProjectsList: IRPTProject[] = [];

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: any) => any) => {
    const mockState = {
      projectStatusesReducer: {
        projectStatuses: [
          { id: 'status-1', name: 'In Progress', color_code: '#1890ff', icon: 'clock-circle' },
          { id: 'status-2', name: 'Completed', color_code: '#52c41a', icon: 'check-circle' },
        ],
        loading: false,
      },
      projectReportsReducer: {
        projectList: mockProjectsList,
        isLoading: false,
        total: mockProjectsList.length,
        index: 1,
        pageSize: mockProjectsList.length || 10,
        order: 'asc',
        field: 'name',
        searchQuery: '',
        selectedProjectStatuses: [],
        selectedProjectHealths: [],
        selectedProjectCategories: [],
        selectedProjectManagers: [],
        archived: false,
        isProjectReportsDrawerOpen: false,
      },
      projectReportsTableColumnsReducer: {
        name: true,
        estimatedVsActual: true,
        tasksProgress: true,
        lastActivity: true,
        status: true,
        priority: true,
        dates: true,
        daysLeft: true,
        projectHealth: true,
        category: true,
        projectUpdate: true,
        client: true,
        team: true,
        projectManager: true,
      },
      projectCategoriesReducer: {
        projectCategories: [
          { id: 'cat-1', name: 'Engineering', color_code: '#1890ff' },
          { id: 'cat-2', name: 'Marketing', color_code: '#52c41a' },
        ],
        loading: false,
      },
      projectHealthReducer: {
        projectHealths: [
          { id: 'health-1', name: 'Good', color_code: '#52c41a' },
          { id: 'health-2', name: 'At Risk', color_code: '#faad14' },
        ],
        loading: false,
      },
      themeReducer: {
        mode: 'light',
      },
    };
    return selector(mockState);
  },
}));

describe('Phase 0 — ProjectsReportsTable client render & socket benchmarks', () => {
  beforeEach(() => {
    socketListeners.clear();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockDispatch.mockClear();
  });

  it(
    'measures 100-row first paint, re-render time, and counts live socket listeners',
    () => {
      mockProjectsList = generateProjects(100);

    // Time first paint / mount
    const mountStart = performance.now();
    const { rerender, unmount } = render(<ProjectsReportsTable />);
    const mountDuration = performance.now() - mountStart;

    // Count live socket listeners
    let totalLiveListeners = 0;
    const listenerCountsByEvent: Record<string, number> = {};
    for (const [event, handlers] of socketListeners.entries()) {
      listenerCountsByEvent[event] = handlers.size;
      totalLiveListeners += handlers.size;
    }

    // Time a re-render with changed data: re-rendering with unchanged props
    // bails out of memo and measures nothing.
    mockProjectsList = generateProjects(100).map(project => ({
      ...project,
      name: `${project.name} v2`,
    }));
    const rerenderStart = performance.now();
    rerender(<ProjectsReportsTable />);
    const rerenderDuration = performance.now() - rerenderStart;

    console.log('\n================ PHASE 0 BENCHMARK (100 ROWS) ================');
    console.log(`Mount Duration (First Paint):     ${mountDuration.toFixed(2)} ms`);
    console.log(`Re-render Duration:               ${rerenderDuration.toFixed(2)} ms`);
    console.log(`Total Live Socket Listeners:      ${totalLiveListeners}`);
    console.log('Socket Listeners Breakdown:');
    for (const [event, count] of Object.entries(listenerCountsByEvent)) {
      console.log(`  - ${event}: ${count} listeners`);
    }
    console.log('=================================================================\n');

    expect(mockProjectsList.length).toBe(100);
    expect(totalLiveListeners).toBeGreaterThan(0);

    unmount();
  }, 60000);

  it('measures 10-row baseline for comparison', () => {
    mockProjectsList = generateProjects(10);

    const mountStart = performance.now();
    const { rerender, unmount } = render(<ProjectsReportsTable />);
    const mountDuration = performance.now() - mountStart;

    let totalLiveListeners = 0;
    for (const handlers of socketListeners.values()) {
      totalLiveListeners += handlers.size;
    }

    // Same as above: change the data so the rows actually re-render.
    mockProjectsList = generateProjects(10).map(project => ({
      ...project,
      name: `${project.name} v2`,
    }));
    const rerenderStart = performance.now();
    rerender(<ProjectsReportsTable />);
    const rerenderDuration = performance.now() - rerenderStart;

    console.log('\n================ PHASE 0 BENCHMARK (10 ROWS) =================');
    console.log(`Mount Duration (First Paint):     ${mountDuration.toFixed(2)} ms`);
    console.log(`Re-render Duration:               ${rerenderDuration.toFixed(2)} ms`);
    console.log(`Total Live Socket Listeners:      ${totalLiveListeners}`);
    console.log('=================================================================\n');

    expect(mockProjectsList.length).toBe(10);
    unmount();
  });
});
