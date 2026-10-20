import { describe, expect, it } from 'vitest';
import { sortTimezoneOptions, timezoneMatches, type TimezoneOption } from '../timezones';

const option = (name: string, abbrev = ''): TimezoneOption => ({ value: name, label: `${name} (${abbrev})`, timezone: { id: name, name, abbrev } });

describe('time zone search', () => {
  const zones = [option('posix/Australia/Sydney', 'AEST'), option('Europe/Berlin', 'CET'), option('Australia/Sydney', 'AEST'), option('America/New_York', 'EST')];

  it('matches the name or the abbreviation anywhere, and everything for an empty search', () => {
    expect(timezoneMatches('syd', zones[2])).toBe(true);
    expect(timezoneMatches('est', zones[3])).toBe(true);
    expect(timezoneMatches('zzz', zones[2])).toBe(false);
    expect(timezoneMatches('', undefined)).toBe(true);
  });

  it('puts names that start with the search first, then shorter paths', () => {
    const sorted = [...zones].sort((a, b) => sortTimezoneOptions(a, b, 'australia'));
    expect(sorted[0].timezone.name).toBe('Australia/Sydney');
    expect(sorted[1].timezone.name).toBe('posix/Australia/Sydney');
  });

  it('leaves the order alone when nothing is typed', () => {
    expect(sortTimezoneOptions(zones[0], zones[1], '')).toBe(0);
  });
});
