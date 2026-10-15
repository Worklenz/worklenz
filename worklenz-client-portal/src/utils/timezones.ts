import type { ClientTimezoneV2 } from '@/types/v2';

export interface TimezoneOption {
  value: string;
  label: string;
  timezone: ClientTimezoneV2;
}

/** Results whose name starts with the search come first, then shallower paths, then alphabetical. */
export const sortTimezoneOptions = (a: TimezoneOption, b: TimezoneOption, searchValue: string): number => {
  if (!searchValue) return 0;
  const term = searchValue.toLowerCase();
  const nameA = a.timezone.name.toLowerCase();
  const nameB = b.timezone.name.toLowerCase();
  const partsA = nameA.split('/');
  const partsB = nameB.split('/');

  const aFirst = partsA[0].startsWith(term);
  const bFirst = partsB[0].startsWith(term);
  if (aFirst !== bFirst) return aFirst ? -1 : 1;

  const aAny = partsA.some(part => part.startsWith(term));
  const bAny = partsB.some(part => part.startsWith(term));
  if (aAny !== bAny) return aAny ? -1 : 1;

  if (partsA.length !== partsB.length) return partsA.length - partsB.length;
  return nameA.localeCompare(nameB);
};

/** Matches the zone name or its abbreviation anywhere. */
export const timezoneMatches = (input: string, option: TimezoneOption | undefined): boolean => {
  if (!input) return true;
  const term = input.toLowerCase();
  return Boolean(option && (option.timezone.name.toLowerCase().includes(term) || option.timezone.abbrev.toLowerCase().includes(term)));
};
