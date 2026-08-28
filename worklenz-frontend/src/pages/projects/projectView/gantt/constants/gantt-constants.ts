export const GANTT_COLUMN_WIDTH = 80; // Base column width in pixels

// Pixels-per-real-day for each zoom level, matching Planner > Timeline's
// TIMELINE_ZOOM_CFG mechanism: everything (grid columns, header cells, task bars) derives
// its pixel position from `daysSinceRangeStart * pxPerDay`, so there's a single source of
// truth instead of separate column-count/column-width computations that can drift apart.
// Day and Week both tick by individual day (Week is Day, just zoomed further out — not an
// aggregated "one cell per week"), so their value is used directly as each day-column's
// width. Month ticks by month, so this is multiplied by each month's real day count
// (28-31) to get that month's own column width — which is what keeps Month's grid exactly
// aligned with real month boundaries regardless of how far from today it is.
export const getColumnWidth = (viewMode: string): number => {
  switch (viewMode) {
    case 'day':
      return 40;
    case 'week':
      // Matches Planner > Timeline's own Weeks zoom pxPerDay exactly — 18px was too
      // narrow for the stacked "weekday abbreviation over day number" cell (e.g. "Thu"
      // over "18") and let the text overflow into neighboring day columns since the
      // cells don't clip until 50px+.
      return 34;
    case 'month':
      return 2.8;
    case 'quarter':
      return 1.2;
    case 'year':
      return 0.3;
    default:
      return 40;
  }
};
