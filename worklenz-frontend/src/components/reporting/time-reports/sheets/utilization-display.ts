import type { TFunction } from 'i18next';

export const formatUtilizationRange = (
  t: TFunction,
  state: string | undefined,
  min: number,
  max: number
): string => {
  switch (state) {
    case 'under':
      return t('underUtilizedRange', { defaultValue: 'Under-utilized (Under {{min}}%)', min });
    case 'optimal':
      return t('optimalUtilizedRange', { defaultValue: 'Optimal-utilized ({{min}}%-{{max}}%)', min, max });
    case 'over':
      return t('overUtilizedRange', { defaultValue: 'Over-utilized (Over {{max}}%)', max });
    default:
      return t('unknown', { defaultValue: 'Unknown' });
  }
};

export const getUtilizationColor = (state: string | undefined): string => {
  if (state === 'under') return '#faad14';
  if (state === 'optimal') return '#52c41a';
  return '#ef4444';
};
