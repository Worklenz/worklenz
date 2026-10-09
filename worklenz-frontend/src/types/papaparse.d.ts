/**
 * Minimal typings for the parts of papaparse the client import uses. The package ships without
 * types and @types/papaparse is not a dependency, so only what is called is declared.
 */
declare module 'papaparse' {
  export interface ParseError {
    type: 'Quotes' | 'Delimiter' | 'FieldMismatch';
    code: string;
    message: string;
    row?: number;
  }

  export interface ParseMeta {
    fields?: string[];
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    transformHeader?: (header: string, index: number) => string;
  }

  export function parse<T = unknown>(input: string, config?: ParseConfig): ParseResult<T>;

  const Papa: { parse: typeof parse };
  export default Papa;
}
