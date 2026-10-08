jest.mock('../config/db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../shared/io', () => ({
  __esModule: true,
  IO: {
    getInstance: () => ({ to: () => ({ emit: jest.fn() }) }),
  },
}));

import TaskStatusesController from '../controllers/task-statuses-controller';
import TaskWorklogController from '../controllers/task-work-log-controller';

const db = require('../config/db').default;

const STATUS_COLOR_SELECT =
  'COALESCE(task_statuses.color_code, stsc.color_code) AS color_code';
const STATUS_COLOR_DARK_SELECT =
  'COALESCE(task_statuses.color_code, stsc.color_code_dark, stsc.color_code) AS color_code_dark';
const STATUS_COLOR_PAIR =
  'COALESCE(s.color_code, c.color_code) FROM task_statuses s';
const STATUS_COLOR_PAIR_DARK =
  'COALESCE(s.color_code, c.color_code_dark, c.color_code) FROM task_statuses s';

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

const normalize = (sql: unknown) => String(sql).replace(/\s+/g, ' ');

const lastQuery = () =>
  normalize(db.query.mock.calls[db.query.mock.calls.length - 1][0]);

/**
 * A colour picked for a single status must render identically in light and dark
 * mode. Previously dark mode fell back to the category colour, so every custom
 * status inside the Doing category turned blue.
 */
describe('task status colours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('serves the status colour as the dark colour, with the category as fallback', async () => {
    const res = createRes();

    await TaskStatusesController.get(
      { query: { project: 'project-1' }, user: { team_id: 'team-1' } } as any,
      res as any
    );

    const sql = lastQuery();
    expect(sql).toContain(STATUS_COLOR_SELECT);
    expect(sql).toContain(STATUS_COLOR_DARK_SELECT);
    // The status colour has to be resolved before the category dark colour.
    expect(sql.indexOf('task_statuses.color_code, stsc.color_code_dark')).toBeGreaterThan(-1);
  });

  it('applies the same rule when a single status is fetched', async () => {
    const res = createRes();

    await TaskStatusesController.getById(
      { params: { id: 'status-1' }, query: { project_id: 'project-1' } } as any,
      res as any
    );

    const sql = lastQuery();
    expect(sql).toContain(STATUS_COLOR_SELECT);
    expect(sql).toContain(STATUS_COLOR_DARK_SELECT);
  });

  it('returns the status colour pair after a rename instead of the category pair', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 2 }], rowCount: 1 });
    const res = createRes();

    await TaskStatusesController.update(
      {
        params: { id: 'status-1' },
        body: { name: 'In Review', project_id: 'project-1', category_id: 'category-1' },
      } as any,
      res as any
    );

    const sql = lastQuery();
    expect(sql).toContain(STATUS_COLOR_PAIR);
    expect(sql).toContain(STATUS_COLOR_PAIR_DARK);
  });

  it('returns the status colour pair after a category change', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: 2 }], rowCount: 1 });
    const res = createRes();

    await TaskStatusesController.updateCategory(
      {
        params: { id: 'status-1' },
        body: { category_id: 'category-2' },
        query: { current_project_id: 'project-1' },
      } as any,
      res as any
    );

    const sql = lastQuery();
    expect(sql).toContain(STATUS_COLOR_PAIR);
    expect(sql).toContain(STATUS_COLOR_PAIR_DARK);
  });

  it('keeps the palette write to a single colour so the two themes cannot drift', async () => {
    const res = createRes();

    await TaskStatusesController.updateColor(
      {
        params: { id: 'status-1' },
        body: { color_code: '#E884A8' },
        query: { current_project_id: 'project-1' },
      } as any,
      res as any
    );

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SET color_code = $3'),
      ['status-1', 'project-1', '#e884a8']
    );
  });
});

const TIME_LOG_STATUS_COLOR_DARK =
  'COALESCE(ts.color_code, tsc.color_code_dark, tsc.color_code) AS status_color_dark';
const TIME_LOG_STATUS_COLOR_LIGHT =
  'COALESCE(ts.color_code, tsc.color_code) AS status_color,';

/**
 * The Time Entries and Home > Log Time feeds resolve their status colour
 * themselves, so the same rule has to hold there: the status colour wins, then
 * the category dark colour, then the category light colour. Without that third
 * fallback those endpoints sent NULL for status_color_dark while status_color
 * was the category colour, and the frontend hands the value straight to the
 * tag's color prop, so dark mode fell back to the default tag colour.
 */
describe('time log status colours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  const statusColorProjections = () =>
    db.query.mock.calls
      .map((call: any[]) => normalize(call[0]))
      .filter((sql: string) => sql.includes('status_color_dark'));

  const expectDarkFallsBackToCategoryLight = () => {
    const sqls = statusColorProjections();
    expect(sqls.length).toBeGreaterThan(0);
    for (const sql of sqls) {
      expect(sql).toContain(TIME_LOG_STATUS_COLOR_DARK);
      expect(sql).toContain(TIME_LOG_STATUS_COLOR_LIGHT);
    }
  };

  it('resolves the dark colour in the Home > Log Time recent feed', async () => {
    const res = createRes();

    await TaskWorklogController.getRecentTimeLogs(
      { query: { limit: '10' }, user: { id: 'user-1', team_id: 'team-1' } } as any,
      res as any
    );

    expectDarkFallsBackToCategoryLight();
  });

  it('resolves the dark colour in the flat Time Entries feed', async () => {
    const res = createRes();

    await TaskWorklogController.getMyTimeLogEntries(
      { query: {}, user: { id: 'user-1', team_id: 'team-1' } } as any,
      res as any
    );

    expectDarkFallsBackToCategoryLight();
  });

  it('resolves the dark colour in the Time Entries by-task view', async () => {
    const res = createRes();

    await TaskWorklogController.getMyTimeLogEntries(
      { query: { view: 'task' }, user: { id: 'user-1', team_id: 'team-1' } } as any,
      res as any
    );

    expectDarkFallsBackToCategoryLight();
  });

  it('resolves the dark colour in the grouped Time Entries feed', async () => {
    const res = createRes();

    await TaskWorklogController.getMyGroupedEntries(
      { query: { group_by: 'member' }, user: { id: 'user-1', team_id: 'team-1' } } as any,
      res as any
    );

    expectDarkFallsBackToCategoryLight();
  });
  it('returns the resolved colours in the recent feed response payload', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'log-1',
          task_id: 'task-1',
          status_name: 'In Review',
          status_color: '#e884a8',
          status_color_dark: '#e884a8',
        },
      ],
      rowCount: 1,
    });
    const res = createRes();

    await TaskWorklogController.getRecentTimeLogs(
      { query: { limit: '10' }, user: { id: 'user-1', team_id: 'team-1' } } as any,
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        done: true,
        body: [expect.objectContaining({ status_color_dark: '#e884a8' })],
      })
    );
  });

});
