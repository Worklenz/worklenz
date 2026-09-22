const AUTO_DELIMITER_CANDIDATES = [',', ';', '\t', '|'];

/**
 * Decodes an ArrayBuffer to a string using the given encoding label.
 * Uses TextDecoder which correctly handles UTF-16 BOMs (unlike FileReader.readAsText).
 * Falls back to UTF-8 if the label is unrecognised.
 */
export const decodeBuffer = (buffer: ArrayBuffer, encoding: string): string => {
  // TextDecoder uses WHATWG encoding labels — map our select values to them
  const labelMap: Record<string, string> = {
    'UTF-16': 'utf-16',
    'UTF-16BE': 'utf-16be',
    'UTF-16LE': 'utf-16le',
    'UTF-8': 'utf-8',
    'US-ASCII': 'windows-1252', // ASCII is a subset; windows-1252 is the WHATWG superset
    'ISO-8859-1': 'iso-8859-1',
  };
  const label = labelMap[encoding] ?? encoding;
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    // Unknown label — fall back to UTF-8
    return new TextDecoder('utf-8').decode(buffer);
  }
};

export const detectCsvDelimiter = (text: string) => {
  const sampleLine = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .find(line => line.trim().length > 0);
  if (!sampleLine) return ',';

  let best = ',';
  let bestCount = -1;
  AUTO_DELIMITER_CANDIDATES.forEach(candidate => {
    const count = sampleLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  });
  return best;
};

const parseCsvRows = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;
  const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];

    if (char === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(value);
      value = '';
      continue;
    }

    if (!inQuotes && char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  rows.push(row);
  return rows;
};

export const parseCsvText = (
  text: string,
  providedDelimiter?: string
): { fields: string[]; rows: Record<string, string>[] } => {
  const delimiter = providedDelimiter || detectCsvDelimiter(text);
  const matrix = parseCsvRows(text || '', delimiter);
  if (!matrix.length) return { fields: [], rows: [] };

  const headers = (matrix[0] || []).map(
    (field, index) =>
      String(field || '')
        .replace(/^\uFEFF/, '')
        .trim() || `column_${index + 1}`
  );
  const fields = headers.filter(Boolean);

  const rows = matrix
    .slice(1)
    .map(rawRow => {
      const mapped = Object.fromEntries(
        fields.map((field, index) => [field, (rawRow[index] || '').trim()])
      ) as Record<string, string>;
      return mapped;
    })
    .filter(rowData => Object.values(rowData).some(v => `${v || ''}`.trim().length > 0));

  return { fields, rows };
};

// Recognized header spellings for each Worklenz field, used to auto-map CSV columns
// on upload (e.g. Linear/Jira/Asana exports). Keyed by the same `value` used in
// worklenzFieldOptions in ImportSourceModal.tsx. Keep aliases lowercase with no
// punctuation — column names are normalized the same way before matching.
export const CSV_COLUMN_ALIASES: Record<string, string[]> = {
  key: ['title', 'task name', 'task title', 'name', 'summary', 'issue', 'task'],
  description: ['description', 'desc', 'details'],
  status: ['status', 'state'],
  assignees: ['assignee', 'assignees', 'owner'],
  labels: ['labels', 'label', 'tags'],
  phase: ['phase', 'epic'],
  priority: ['priority'],
  timeTracking: ['time tracking', 'time spent', 'time logged'],
  estimation: ['estimate', 'estimation', 'story points', 'points'],
  startDate: ['start date', 'started'],
  dueDate: ['due date', 'due'],
  dueTime: ['due time'],
  completedDate: ['completed', 'completed date'],
  createdDate: ['created', 'created date'],
  lastUpdated: ['updated', 'last updated', 'updated date'],
  reporter: ['creator', 'reporter'],
};

export const normalizeCsvHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

/** Maps CSV column headers to Worklenz field values by exact alias match, e.g.
 * "Title" -> "key", "Due Date" -> "dueDate". Each target field is used at most
 * once; unrecognized columns are left unmapped for the user to assign manually
 * (or leave as a custom field). */
export const autoMapCsvColumns = (columns: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const usedTargets = new Set<string>();

  for (const column of columns) {
    const normalized = normalizeCsvHeader(column);
    const match = Object.entries(CSV_COLUMN_ALIASES).find(
      ([target, aliases]) => !usedTargets.has(target) && aliases.includes(normalized)
    );
    if (match) {
      mapping[column] = match[0];
      usedTargets.add(match[0]);
    }
  }

  return mapping;
};


export interface CsvImportValidation {
  errors: Array<{ row: number; field: string; message: string }>;
  warnings: Array<{ row?: number; field: string; message: string }>;
}

/** Validate values that will be written to Worklenz before the import starts.
 * Blank optional values are accepted; populated due dates must be parseable and
 * mapped status/assignee values must be explicitly resolved by the wizard. */
export const validateCsvImport = (args: {
  rows: Record<string, string>[];
  columns: string[];
  fieldMappings: Record<string, string>;
  statusValueMapping: Record<string, string>;
  csvUserRows: string[];
  userEmails: Record<string, string>;
  addUsers: boolean;
}): CsvImportValidation => {
  const { rows, columns, fieldMappings, statusValueMapping, csvUserRows, userEmails, addUsers } = args;
  const findColumn = (target: string) =>
    columns.find(column => fieldMappings[column] === target && fieldMappings[column]) || '';
  const titleColumn = findColumn('key');
  const statusColumn = findColumn('status');
  const assigneeColumn = findColumn('assignees');
  const dueDateColumn = findColumn('dueDate');
  const errors: CsvImportValidation['errors'] = [];
  const warnings: CsvImportValidation['warnings'] = [];

  if (!titleColumn) {
    errors.push({ row: 0, field: 'Title', message: 'Map a CSV column to Task name / Title.' });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (titleColumn && !String(row[titleColumn] ?? '').trim()) {
      errors.push({ row: rowNumber, field: titleColumn, message: 'Task title is empty.' });
    }
    if (dueDateColumn) {
      const raw = String(row[dueDateColumn] ?? '').trim();
      if (raw && !isValidImportDate(raw)) {
        errors.push({ row: rowNumber, field: dueDateColumn, message: `Invalid due date: ${raw}` });
      }
    }
    if (statusColumn) {
      const raw = String(row[statusColumn] ?? '').trim();
      if (raw && !statusValueMapping[raw]) {
        warnings.push({ row: rowNumber, field: statusColumn, message: `Status '${raw}' is not mapped and will use the project default.` });
      }
    }
    if (assigneeColumn && addUsers) {
      const raw = String(row[assigneeColumn] ?? '').trim();
      if (raw && !isValidEmail(userEmails[raw] || '')) {
        errors.push({ row: rowNumber, field: assigneeColumn, message: `Assignee '${raw}' has no valid email mapping.` });
      }
    }
  });

  if (assigneeColumn && addUsers) {
    csvUserRows.forEach(user => {
      const value = String(userEmails[user] || '').trim();
      if (user && !isValidEmail(value)) {
        errors.push({ row: 0, field: 'Assignee', message: `'${user}' needs a valid email address.` });
      }
    });
  }

  return { errors, warnings };
};

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidImportDate = (value: string): boolean => {
  const input = value.trim();
  if (!input) return true;
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(input)) {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/)!;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return false;
    const parsed = new Date(input);
    return !Number.isNaN(parsed.getTime());
  }
  const numeric = input.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const year = Number(numeric[3]);
    // For ambiguous numeric dates, accept either D/M/Y or M/D/Y when both are
    // structurally valid. The backend uses the same deterministic rule.
    const month = a > 12 ? b : b > 12 ? a : a;
    const day = a > 12 ? a : b > 12 ? b : b;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  const parsed = new Date(input);
  return !Number.isNaN(parsed.getTime());
};

export const normalizeDomain = (value: string): string =>
  value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();

export const isValidDomain = (value: string): boolean =>
  /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(value) && !/\s/.test(value);
