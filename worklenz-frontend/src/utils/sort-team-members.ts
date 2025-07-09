export const sortByBooleanField = <T extends Record<string, any>>(
  data: T[],
  field: keyof T,
  prioritizeTrue: boolean = true
) => {
  return [...data].sort((a, b) => {
    const aValue = !!a[field];
    const bValue = !!b[field];

    if (aValue === bValue) return 0;
    if (prioritizeTrue) {
      return aValue ? -1 : 1;
    } else {
      return !aValue ? -1 : 1;
    }
  });
};

export const sortBySelection = (data: Array<{ selected?: boolean }>) =>
  sortByBooleanField(data, 'selected');

export const sortByPending = (data: Array<{ pending_invitation?: boolean }>) =>
  sortByBooleanField(data, 'pending_invitation', false);

export const sortTeamMembers = (
  data: Array<{ selected?: boolean; pending_invitation?: boolean; is_pending?: boolean }>
) => {
  return sortByBooleanField(
    sortByBooleanField(sortByBooleanField(data, 'is_pending', false), 'pending_invitation', false),
    'selected'
  );
};
