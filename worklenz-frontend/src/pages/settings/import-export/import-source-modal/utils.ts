const AUTO_DELIMITER_CANDIDATES = [',', ';', '\t', '|'];

const detectDelimiter = (text: string) => {
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
  const delimiter = providedDelimiter || detectDelimiter(text);
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

export const normalizeDomain = (value: string): string =>
  value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();

export const isValidDomain = (value: string): boolean =>
  /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(value) && !/\s/.test(value);
