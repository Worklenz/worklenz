// Mock the db module before imports
jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from '../config/db';
import { getDefaultCategoryOrder, resolveProjectCategoryOrder } from '../shared/status-category-order';
import { validateCategoryOrder } from '../shared/validate-category-order';
import { requireProjectPermission } from '../middlewares/validators/require-project-permission';

const mockDb = db as jest.Mocked<typeof db>;

// UUIDs used throughout tests
const DOING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TODO_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const DONE_ID  = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const UNKNOWN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const DEFAULT_CATEGORIES = [
  { id: DOING_ID, is_todo: false, is_doing: true,  is_done: false },
  { id: TODO_ID,  is_todo: true,  is_doing: false, is_done: false },
  { id: DONE_ID,  is_todo: false, is_doing: false, is_done: true  },
];

// ─────────────────────────────────────────────────────────────────────────────
// resolveProjectCategoryOrder
// ─────────────────────────────────────────────────────────────────────────────
describe('resolveProjectCategoryOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the saved order when status_category_order is non-null on the project', async () => {
    const savedOrder = [TODO_ID, DOING_ID, DONE_ID];

    // First call: SELECT status_category_order FROM projects
    mockDb.query.mockResolvedValueOnce({
      rows: [{ status_category_order: savedOrder }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    const result = await resolveProjectCategoryOrder('proj-1');
    expect(result).toEqual(savedOrder);
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('returns the default [doing, todo, done] order when status_category_order is null', async () => {
    // First call: SELECT status_category_order FROM projects → null
    mockDb.query.mockResolvedValueOnce({
      rows: [{ status_category_order: null }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    // Second call: SELECT id ... FROM sys_task_status_categories
    mockDb.query.mockResolvedValueOnce({
      rows: DEFAULT_CATEGORIES,
      rowCount: 3,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    const result = await resolveProjectCategoryOrder('proj-2');
    expect(result).toEqual([DOING_ID, TODO_ID, DONE_ID]);
    expect(mockDb.query).toHaveBeenCalledTimes(2);
  });

  it('returns the default order when status_category_order row is missing', async () => {
    // First call: project not found
    mockDb.query.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    // Second call: categories
    mockDb.query.mockResolvedValueOnce({
      rows: DEFAULT_CATEGORIES,
      rowCount: 3,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    const result = await resolveProjectCategoryOrder('proj-3');
    expect(result).toEqual([DOING_ID, TODO_ID, DONE_ID]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getDefaultCategoryOrder
// ─────────────────────────────────────────────────────────────────────────────
describe('getDefaultCategoryOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives [doing, todo, done] from sys_task_status_categories', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: DEFAULT_CATEGORIES,
      rowCount: 3,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    const result = await getDefaultCategoryOrder();
    expect(result).toEqual([DOING_ID, TODO_ID, DONE_ID]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateCategoryOrder
// ─────────────────────────────────────────────────────────────────────────────
describe('validateCategoryOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a valid 3-element UUID array where all IDs exist in DB', async () => {
    const order = [DOING_ID, TODO_ID, DONE_ID];

    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: DOING_ID }, { id: TODO_ID }, { id: DONE_ID }],
      rowCount: 3,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    const result = await validateCategoryOrder(order);
    expect(result).toEqual({ valid: true });
  });

  it('rejects arrays with duplicate IDs', async () => {
    const order = [DOING_ID, DOING_ID, DONE_ID];
    const result = await validateCategoryOrder(order);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/duplicate/i);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('rejects arrays containing unknown (non-existent) category IDs', async () => {
    const order = [DOING_ID, TODO_ID, UNKNOWN_ID];

    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: DOING_ID }, { id: TODO_ID }], // only 2 found
      rowCount: 2,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    const result = await validateCategoryOrder(order);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unknown/i);
  });

  it('rejects an array with 2 elements (too few)', async () => {
    const result = await validateCategoryOrder([DOING_ID, TODO_ID]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exactly 3/i);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('rejects an array with 4 elements (too many)', async () => {
    const result = await validateCategoryOrder([DOING_ID, TODO_ID, DONE_ID, UNKNOWN_ID]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exactly 3/i);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('rejects non-array input (string)', async () => {
    const result = await validateCategoryOrder('not-an-array');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/array/i);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('rejects non-array input (null)', async () => {
    const result = await validateCategoryOrder(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/array/i);
  });

  it('rejects array elements that are not valid UUIDs', async () => {
    const result = await validateCategoryOrder(['not-a-uuid', TODO_ID, DONE_ID]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid UUID/i);
    expect(mockDb.query).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireProjectPermission middleware — statuses permission gate
// ─────────────────────────────────────────────────────────────────────────────

// Mock project-access so we can control what permissions are returned
jest.mock('../shared/project-access', () => ({
  getProjectAccessForRequest: jest.fn(),
}));

import { getProjectAccessForRequest } from '../shared/project-access';
const mockGetAccess = getProjectAccessForRequest as jest.MockedFunction<typeof getProjectAccessForRequest>;

function createMockReqRes(projectId: string) {
  const req: any = {
    params: { id: projectId },
    query: {},
    body: {},
    user: { id: 'user-1', team_id: 'team-1' },
  };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

const FULL_PERMISSIONS = {
  settings: true,
  statuses: true,
  delete: true,
  archive: false,
  finance: false,
  assignPm: false,
  move: false,
  members: { add: false, removeMember: false, changeMemberRole: false },
  view: true,
};

describe('requireProjectPermission("statuses") middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next() when the user has statuses permission', async () => {
    const { req, res, next } = createMockReqRes('proj-1');

    mockGetAccess.mockResolvedValueOnce({
      permissions: FULL_PERMISSIONS,
      isProjectManager: false,
      financeAccess: false,
      canCreateProjectsFromTemplates: false,
    } as any);

    const middleware = requireProjectPermission('statuses', {
      sources: ['params.id', 'query.current_project_id'],
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when the user lacks statuses permission', async () => {
    const { req, res, next } = createMockReqRes('proj-1');

    mockGetAccess.mockResolvedValueOnce({
      permissions: { ...FULL_PERMISSIONS, statuses: false },
      isProjectManager: false,
      financeAccess: false,
      canCreateProjectsFromTemplates: false,
    } as any);

    const middleware = requireProjectPermission('statuses', {
      sources: ['params.id', 'query.current_project_id'],
    });
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when project id cannot be resolved', async () => {
    const req: any = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-1', team_id: 'team-1' },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    const middleware = requireProjectPermission('statuses', {
      sources: ['params.id'],
    });
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
