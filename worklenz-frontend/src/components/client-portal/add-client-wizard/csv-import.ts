import Papa from 'papaparse';
import type { ImportRowInput } from '@/api/client-portal/company-users-api';

/** Must match IMPORT_MAX_ROWS in the backend's client-onboarding-service. */
export const CSV_MAX_ROWS = 500;
export const CSV_MAX_BYTES = 1024 * 1024;

export type CsvParseError =
  | { kind: 'notCsv' }
  | { kind: 'tooLarge' }
  | { kind: 'empty' }
  | { kind: 'unreadable' }
  | { kind: 'missingColumns'; columns: Array<'first_name' | 'email'> }
  | { kind: 'tooManyRows'; count: number };

export type CsvParseResult =
  | { ok: true; rows: ImportRowInput[] }
  | { ok: false; error: CsvParseError };

type ColumnKey = keyof ImportRowInput;

// Header spellings people actually use, compared after lower-casing and dropping spaces, dashes
// and underscores ("First name", "first_name" and "FirstName" are all the same column).
const COLUMN_ALIASES: Record<string, ColumnKey> = {
  company: 'company',
  companyname: 'company',
  organization: 'company',
  organisation: 'company',
  firstname: 'first_name',
  first: 'first_name',
  givenname: 'first_name',
  lastname: 'last_name',
  last: 'last_name',
  surname: 'last_name',
  familyname: 'last_name',
  email: 'email',
  emailaddress: 'email',
};

const normalizeHeader = (header: string) =>
  header
    .replace(/^﻿/, '')
    .toLowerCase()
    .replace(/[\s_\-]/g, '');

/** Checks the file before reading it. */
export const checkCsvFile = (file: { name: string; size: number }): CsvParseError | null => {
  if (!/\.csv$/i.test(file.name)) return { kind: 'notCsv' };
  if (file.size > CSV_MAX_BYTES) return { kind: 'tooLarge' };
  return null;
};

/**
 * Turns CSV text into import rows. The header row is required. Column order and spelling are
 * flexible; First name and Email are required, Company and Last name are optional. Blank lines are
 * skipped. Whether each row is acceptable is decided by the server.
 */
export const parseCsvText = (text: string): CsvParseResult => {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => COLUMN_ALIASES[normalizeHeader(header)] ?? header,
  });

  // A malformed row (for example an unclosed quote) makes the whole file untrustworthy.
  if (parsed.errors.some(error => error.type === 'Quotes')) {
    return { ok: false, error: { kind: 'unreadable' } };
  }

  const columns = new Set(parsed.meta.fields ?? []);
  const missing = (['first_name', 'email'] as const).filter(column => !columns.has(column));
  if (missing.length > 0) {
    return { ok: false, error: { kind: 'missingColumns', columns: missing } };
  }

  const rows = parsed.data.map<ImportRowInput>(record => ({
    company: (record.company ?? '').trim(),
    first_name: (record.first_name ?? '').trim(),
    last_name: (record.last_name ?? '').trim(),
    email: (record.email ?? '').trim(),
  }));

  if (rows.length === 0) return { ok: false, error: { kind: 'empty' } };
  if (rows.length > CSV_MAX_ROWS) {
    return { ok: false, error: { kind: 'tooManyRows', count: rows.length } };
  }

  return { ok: true, rows };
};
