import { describe, expect, it } from 'vitest';
import { autoMapCsvColumns, normalizeCsvHeader, parseCsvText } from './utils';

describe('normalizeCsvHeader', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeCsvHeader('  Due Date  ')).toBe('due date');
    expect(normalizeCsvHeader('DUE   DATE')).toBe('due date');
  });

  it('treats underscores and dashes as spaces', () => {
    expect(normalizeCsvHeader('due_date')).toBe('due date');
    expect(normalizeCsvHeader('due-date')).toBe('due date');
    expect(normalizeCsvHeader('Task__Name')).toBe('task name');
  });
});

describe('autoMapCsvColumns', () => {
  it('maps a typical Linear export header row to Worklenz fields', () => {
    const columns = [
      'ID',
      'Team',
      'Title',
      'Description',
      'Status',
      'Estimate',
      'Priority',
      'Project ID',
      'Project',
      'Creator',
      'Assignee',
      'Labels',
      'Created',
      'Updated',
      'Due Date',
    ];

    expect(autoMapCsvColumns(columns)).toEqual({
      Title: 'key',
      Description: 'description',
      Status: 'status',
      Estimate: 'estimation',
      Priority: 'priority',
      Creator: 'reporter',
      Assignee: 'assignees',
      Labels: 'labels',
      Created: 'createdDate',
      Updated: 'lastUpdated',
      'Due Date': 'dueDate',
    });
  });

  it('leaves columns with no known alias unmapped', () => {
    expect(autoMapCsvColumns(['ID', 'Team', 'Project ID', 'UUID'])).toEqual({});
  });

  it('is case- and punctuation-insensitive', () => {
    expect(autoMapCsvColumns(['TASK NAME', 'due_date', 'Assignee(s)'])).toEqual({
      'TASK NAME': 'key',
      due_date: 'dueDate',
    });
  });

  it('maps each Worklenz target at most once, first match wins', () => {
    // Two columns could both plausibly mean "title" — only the first is mapped;
    // the second is left for the user to map manually (e.g. as a custom field).
    expect(autoMapCsvColumns(['Title', 'Name'])).toEqual({ Title: 'key' });
  });

  it('returns an empty mapping for no columns', () => {
    expect(autoMapCsvColumns([])).toEqual({});
  });
});

describe('parseCsvText + autoMapCsvColumns integration', () => {
  it('auto-maps the header row parsed straight out of a real CSV export', () => {
    const csv = [
      'Title,Description,Status,Priority,Assignee,Due Date',
      '"Fix bug","Something is broken",To Do,High,jane@example.com,2026-09-01',
    ].join('\n');

    const { fields } = parseCsvText(csv);
    expect(autoMapCsvColumns(fields)).toEqual({
      Title: 'key',
      Description: 'description',
      Status: 'status',
      Priority: 'priority',
      Assignee: 'assignees',
      'Due Date': 'dueDate',
    });
  });
});

describe('validateCsvImport', () => {
  it('rejects empty titles and invalid due dates before import', async () => {
    const { validateCsvImport } = await import('./utils');
    const result = validateCsvImport({
      rows: [
        { Title: '', 'Due Date': '2026-02-30' },
        { Title: 'Valid task', 'Due Date': '2026-09-09' },
      ],
      columns: ['Title', 'Due Date'],
      fieldMappings: { Title: 'key', 'Due Date': 'dueDate' },
      statusValueMapping: {},
      csvUserRows: [],
      userEmails: {},
      addUsers: false,
    });
    expect(result.errors.some(error => error.message === 'Task title is empty.')).toBe(true);
    expect(result.errors.some(error => error.message.includes('Invalid due date'))).toBe(true);
  });

  it('reports unmapped statuses as warnings and invalid assignee emails as errors', async () => {
    const { validateCsvImport } = await import('./utils');
    const result = validateCsvImport({
      rows: [{ Title: 'Task', Status: 'Doing', Assignee: 'Alice' }],
      columns: ['Title', 'Status', 'Assignee'],
      fieldMappings: { Title: 'key', Status: 'status', Assignee: 'assignees' },
      statusValueMapping: {},
      csvUserRows: ['Alice'],
      userEmails: { Alice: 'not-an-email' },
      addUsers: true,
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.errors.some(error => error.field === 'Assignee')).toBe(true);
  });
});

describe('CSV delimiter detection', () => {
  it('detects semicolon-delimited files so preview and backend receive the same delimiter', async () => {
    const { detectCsvDelimiter, parseCsvText } = await import('./utils');
    const csv = 'Title;Status;Assignee;Due Date\nTask;Doing;alice@example.com;2026-09-09';
    const delimiter = detectCsvDelimiter(csv);
    expect(delimiter).toBe(';');
    expect(parseCsvText(csv, delimiter).rows[0]).toEqual({
      Title: 'Task',
      Status: 'Doing',
      Assignee: 'alice@example.com',
      'Due Date': '2026-09-09',
    });
  });
});
