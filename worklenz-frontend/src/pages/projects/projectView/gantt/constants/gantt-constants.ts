export const GANTT_COLUMN_WIDTH = 80; // Base column width in pixels

export const getColumnWidth = (viewMode: string): number => {
  switch (viewMode) {
    case 'day':
      return 40;
    case 'week':
      return 60;
    case 'month':
      return 80;
    case 'quarter':
      return 120;
    case 'year':
      return 160;
    default:
      return 80;
  }
};
