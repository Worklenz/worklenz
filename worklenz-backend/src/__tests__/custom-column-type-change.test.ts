import CustomColumnsController from '../controllers/custom-columns-controller';
import db from '../config/db';
import { getDependentColumnNames, validateParentColumn } from '../services/cascading-selection-service';
import { createMockRequest, createMockResponse } from '../tests/utils/express-mock';

jest.mock('../config/db', () => ({ __esModule: true, default: { pool: { connect: jest.fn() } } }));
jest.mock('../services/cascading-selection-service', () => ({
  validateParentColumn: jest.fn(), getDependentColumnNames: jest.fn(),
}));
const query = jest.fn();
const release = jest.fn();
const id = '33333333-3333-4333-8333-333333333333';
let formulaNames: string[];
let oldType: string;

beforeEach(() => {
  jest.clearAllMocks();
  formulaNames = [];
  oldType = 'number';
  (db.pool.connect as jest.Mock).mockResolvedValue({ query, release });
  (validateParentColumn as jest.Mock).mockResolvedValue(null);
  (getDependentColumnNames as jest.Mock).mockResolvedValue([]);
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT cc.field_type')) return { rowCount: 1, rows: [{ field_type: oldType, type_locked: true, project_id: 'project', key: 'cost', parent_column_id: null }] };
    if (sql.includes('SELECT DISTINCT cc.name')) return { rowCount: formulaNames.length, rows: formulaNames.map(name => ({ name })) };
    return { rowCount: 1, rows: [{ id }] };
  });
});

const update = async (fieldType: unknown) => {
  const req = createMockRequest({ params: { id }, body: {
    name: 'Cost', field_type: fieldType, width: 120, is_visible: true,
    configuration: { field_title: 'Cost', selections_list: [], labels_list: [] },
  } });
  const res = createMockResponse();
  await CustomColumnsController.update(req, res);
  return res;
};

describe('custom-column type changes', () => {
  it.each(['unsupported', '', 42, {}])('rejects an invalid field type before opening a transaction: %p', async fieldType => {
    const res = await update(fieldType);
    expect(res.statusCode).toBe(400);
    expect(res.body.body.error_code).toBe('INVALID_CUSTOM_COLUMN_TYPE');
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  it('rejects a referenced numeric type change before deleting any task data', async () => {
    formulaNames = ['Total'];
    const res = await update('text');
    expect(res.statusCode).toBe(400);
    expect(res.body.body).toMatchObject({ error_code: 'CUSTOM_COLUMN_HAS_FORMULA_DEPENDENTS', dependent_fields: ['Total'] });
    expect(query.mock.calls.some(([sql]: [string]) => /DELETE FROM cc_column_values|UPDATE cc_custom_columns/.test(sql))).toBe(false);
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });
  it('allows renaming a referenced Number field without clearing values', async () => {
    formulaNames = ['Total'];
    expect((await update('number')).statusCode).toBe(200);
    expect(query.mock.calls.some(([sql]: [string]) => sql.includes('DELETE FROM cc_column_values'))).toBe(false);
  });
  it('permits an independent type change and clears old values and incompatible options', async () => {
    oldType = 'selection';
    expect((await update('text')).statusCode).toBe(200);
    expect(query).toHaveBeenCalledWith('DELETE FROM cc_column_values WHERE column_id = $1', [id]);
    expect(query).toHaveBeenCalledWith('DELETE FROM cc_selection_options WHERE column_id = $1', [id]);
    expect(query).toHaveBeenCalledWith('COMMIT');
  });
  it('keeps the cascading Selection dependency protection', async () => {
    oldType = 'selection';
    (getDependentColumnNames as jest.Mock).mockResolvedValue(['City']);
    const res = await update('text');
    expect(res.statusCode).toBe(400);
    expect(res.body.body.error_code).toBe('CASCADE_PARENT_HAS_DEPENDENTS');
    expect(query.mock.calls.some(([sql]: [string]) => sql.includes('DELETE FROM cc_column_values'))).toBe(false);
  });
});
