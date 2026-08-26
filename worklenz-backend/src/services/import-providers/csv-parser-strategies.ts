export interface DateParsingStrategy {
  readonly name: string;
  canParse(value: string): boolean;
  parse(value: string): Date | null;
}


export class IsoDateStrategy implements DateParsingStrategy {
  readonly name = "ISO 8601";
  private static readonly ISO_REGEX =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

  canParse(value: string): boolean {
    return IsoDateStrategy.ISO_REGEX.test(value.trim());
  }

  parse(value: string): Date | null {
    const d = new Date(value.trim());
    return isValidDate(d) ? d : null;
  }
}


export class UsDateStrategy implements DateParsingStrategy {
  readonly name = "US (MM/DD/YYYY)";
  private static readonly US_REGEX =
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;

  canParse(value: string): boolean {
    const match = value.trim().match(UsDateStrategy.US_REGEX);
    if (!match) return false;
    const month = parseInt(match[1], 10);
    return month >= 1 && month <= 12;
  }

  parse(value: string): Date | null {
    const match = value.trim().match(UsDateStrategy.US_REGEX);
    if (!match) return null;
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    return isValidDate(d) && d.getMonth() === month - 1 ? d : null;
  }
}


export class EuDateStrategy implements DateParsingStrategy {
  readonly name = "EU (DD/MM/YYYY)";
  private static readonly EU_REGEX =
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;

  canParse(value: string): boolean {
    const match = value.trim().match(EuDateStrategy.EU_REGEX);
    if (!match) return false;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    return day >= 1 && day <= 31 && month >= 1 && month <= 12;
  }

  parse(value: string): Date | null {
    const match = value.trim().match(EuDateStrategy.EU_REGEX);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    return isValidDate(d) && d.getMonth() === month - 1 ? d : null;
  }
}


export class NaturalDateStrategy implements DateParsingStrategy {
  readonly name = "Natural language";
  private static readonly NATURAL_REGEX =
    /^(\d{1,2})\s+(\w{3,9})\s+(\d{4})$|^(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i;

  canParse(value: string): boolean {
    return NaturalDateStrategy.NATURAL_REGEX.test(value.trim());
  }

  parse(value: string): Date | null {
    const d = new Date(value.trim());
    return isValidDate(d) ? d : null;
  }
}


export class UnixTimestampStrategy implements DateParsingStrategy {
  readonly name = "Unix timestamp";
  private static readonly UNIX_REGEX = /^\d{10,13}$/;

  canParse(value: string): boolean {
    return UnixTimestampStrategy.UNIX_REGEX.test(value.trim());
  }

  parse(value: string): Date | null {
    const num = parseInt(value.trim(), 10);
    if (!Number.isFinite(num)) return null;
    // 10-digit = seconds, 13-digit = milliseconds
    const ms = value.trim().length <= 10 ? num * 1000 : num;
    const d = new Date(ms);
    return isValidDate(d) ? d : null;
  }
}


function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}


const DEFAULT_DATE_STRATEGIES: DateParsingStrategy[] = [
  new IsoDateStrategy(),
  new UsDateStrategy(),
  new EuDateStrategy(),
  new NaturalDateStrategy(),
  new UnixTimestampStrategy(),
];


export function parseDate(
  value: string,
  strategies: DateParsingStrategy[] = DEFAULT_DATE_STRATEGIES,
): Date | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();

  for (const strategy of strategies) {
    if (strategy.canParse(trimmed)) {
      const result = strategy.parse(trimmed);
      if (result) return result;
    }
  }
  return null;
}

export function detectDateStrategy(
  sampleValues: string[],
  strategies: DateParsingStrategy[] = DEFAULT_DATE_STRATEGIES,
): DateParsingStrategy | null {
  if (!sampleValues.length) return null;

  let bestStrategy: DateParsingStrategy | null = null;
  let bestScore = 0;

  for (const strategy of strategies) {
    const matches = sampleValues.filter(
      (v) => v.trim() && strategy.canParse(v.trim()),
    ).length;
    const nonEmpty = sampleValues.filter((v) => v.trim()).length;
    const score = nonEmpty > 0 ? matches / nonEmpty : 0;
    if (score > bestScore) {
      bestScore = score;
      bestStrategy = strategy;
    }
  }

  return bestScore >= 0.5 ? bestStrategy : null;
}


export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}


type CsvDelimiter = "," | ";" | "\t";

const SUPPORTED_DELIMITERS: CsvDelimiter[] = [",", ";", "\t"];


export function detectDelimiter(text: string): CsvDelimiter {
  const sampleLines = text.split(/\r?\n/).slice(0, 10).filter(Boolean);
  if (!sampleLines.length) return ",";

  let bestDelimiter: CsvDelimiter = ",";
  let bestScore = -1;

  for (const delimiter of SUPPORTED_DELIMITERS) {
    const counts = sampleLines.map((line) =>
      countDelimiterOccurrences(line, delimiter),
    );

    if (counts[0] === 0) continue;

    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
    const consistency = variance === 0 ? 1 : 1 / (1 + variance);
    const score = avg * consistency;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}


function countDelimiterOccurrences(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      count++;
    }
  }
  return count;
}


const BINARY_SIGNATURES = ["%PDF-", "\x89PNG", "\xFF\xD8\xFF", "PK\x03\x04"];

export const MAX_CSV_ROWS = 5000;


export const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024;


export function isBinaryContent(text: string): boolean {
  const sample = text.slice(0, 512);
  return BINARY_SIGNATURES.some((sig) => sample.includes(sig));
}


export function tokenizeCsv(
  rawText: string,
  delimiter?: CsvDelimiter,
): string[][] {
  const text = stripBom(rawText);
  const delim = delimiter || detectDelimiter(text);

  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delim && !inQuotes) {
      current.push(field.trim());
      field = "";
      continue;
    }

    if (char === "\r" && !inQuotes) {
      // Consume \r\n as a single line break
      if (next === "\n") i++;
      if (field.length || current.length) {
        current.push(field.trim());
        rows.push(current);
        current = [];
        field = "";
      }
      continue;
    }

    if (char === "\n" && !inQuotes) {
      if (field.length || current.length) {
        current.push(field.trim());
        rows.push(current);
        current = [];
        field = "";
      }
      continue;
    }

    field += char;
  }


  if (field.length || current.length) {
    current.push(field.trim());
    rows.push(current);
  }

  return rows.filter((r) => r.length > 0);
}


export const AUTO_FIELD_RULES: Record<string, string[]> = {
  key: [
    "title", "task name", "task", "name", "summary", "subject",
    "issue", "ticket", "item", "work item", "task title",
  ],
  description: [
    "description", "details", "notes", "body", "task description",
    "content", "remark", "remarks",
  ],
  status: [
    "status", "state", "stage", "progress", "section", "phase",
    "workflow", "column",
  ],
  assignees: [
    "assignee", "assigned to", "owner", "member", "assigned",
    "user email", "responsible", "team member", "user",
  ],
  dueDate: [
    "due date", "due_date", "due", "deadline", "end date",
    "target date", "finish date", "due by",
  ],
  startDate: [
    "start date", "start_date", "start", "begin date",
    "begin", "opened", "planned start",
  ],
  priority: [
    "priority", "urgency", "severity", "level", "importance",
  ],
  estimation: [
    "estimate", "estimated hours", "estimation", "points",
    "story points", "effort", "hours",
  ],
  labels: [
    "label", "labels", "tag", "tags", "category", "categories",
  ],
};


export function suggestFieldMapping(header: string): string | null {
  if (!header) return null;
  const normalized = header.trim().toLowerCase().replace(/[_\-]+/g, " ");

  for (const [targetField, synonyms] of Object.entries(AUTO_FIELD_RULES)) {
    if (synonyms.some((s) => s === normalized)) {
      return targetField;
    }
  }
  return null;
}


export function autoMapHeaders(
  headers: string[],
): Record<string, string | null> {
  const usedTargets = new Set<string>();
  const result: Record<string, string | null> = {};

  for (const header of headers) {
    const suggested = suggestFieldMapping(header);
    if (suggested && !usedTargets.has(suggested)) {
      result[header] = suggested;
      usedTargets.add(suggested);
    } else {
      result[header] = null;
    }
  }

  return result;
}
