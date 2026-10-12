/**
 * Shared CSV encoding helpers for Excel / Google Sheets compatibility.
 * UTF-8 with BOM; RFC 4180 quoting (commas, quotes, newlines).
 */

export const CSV_UTF8_BOM = "\uFEFF";

/**
 * Escapes a CSV cell value by doubling internal double-quotes.
 * Does not add surrounding quotes — use {@link formatCsvCell} for that.
 */
export const escapeCsvValue = (value: string): string => {
  return value.replace(/"/g, '""');
};

/**
 * Neutralizes CSV/formula injection (OWASP): a cell whose first character
 * is =, +, -, @, tab, or CR is interpreted as a formula by Excel/Sheets even
 * when quoted. Prefixing with a single quote forces it to render as literal
 * text instead of executing.
 */
const FORMULA_INJECTION_LEAD_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export const sanitizeCsvFormulaValue = (value: string): string => {
  if (value.length > 0 && FORMULA_INJECTION_LEAD_CHARS.has(value[0])) {
    return `'${value}`;
  }
  return value;
};

/**
 * Formats a single CSV cell: stringifies null/undefined as empty,
 * neutralizes formula injection, escapes quotes, and always wraps in double
 * quotes for safe Excel/Sheets paste.
 */
export const formatCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '""';
  }

  const asString = typeof value === "string" ? value : String(value);
  return `"${escapeCsvValue(sanitizeCsvFormulaValue(asString))}"`;
};

/**
 * Builds one CSV row from cell values (already raw; quoting applied here).
 */
export const buildCsvRow = (cells: unknown[]): string => {
  return cells.map(formatCsvCell).join(",");
};

export interface EncodeCsvOptions {
  /** Prepend UTF-8 BOM for Excel. Defaults to true. */
  includeBom?: boolean;
  /** Line ending. Defaults to `\n` (Sheets/Excel accept this with BOM). */
  lineEnding?: "\n" | "\r\n";
}

/**
 * Encodes a full CSV document from headers + data rows.
 * Returns a UTF-8 string (with BOM by default).
 */
export const encodeCsv = (
  headers: string[],
  rows: unknown[][],
  options: EncodeCsvOptions = {}
): string => {
  const includeBom = options.includeBom !== false;
  const lineEnding = options.lineEnding ?? "\n";

  const lines: string[] = [buildCsvRow(headers)];
  for (const row of rows) {
    lines.push(buildCsvRow(row));
  }

  const body = lines.join(lineEnding);
  return includeBom ? `${CSV_UTF8_BOM}${body}` : body;
};
