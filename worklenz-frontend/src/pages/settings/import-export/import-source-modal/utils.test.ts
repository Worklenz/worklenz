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
