import { describe, expect, it } from 'vitest';
import { formatCsvText } from './csv-export';

describe('formatCsvText', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])('neutralizes formula prefix %j', lead => {
    expect(formatCsvText(`${lead}SUM(1,2)`)).toBe(`"'${lead}SUM(1,2)"`);
  });
  it('preserves commas, quotes and newlines in labels', () => {
    expect(formatCsvText('Sprint "A",\nNext')).toBe('"Sprint ""A"",\nNext"');
  });
});
