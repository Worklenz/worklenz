type ScrollLeftTarget = { scrollLeft: number };

/**
 * Keeps the roadmap chart grid and its date header horizontally in sync.
 *
 * Writing scrollLeft onto the header fires the header's own 'scroll' event a frame
 * later. Mirroring that (by then stale) value back onto the chart would cancel any
 * smooth scroll the chart is running (e.g. the "Today" button). Each write onto the
 * header therefore records the single echo it is expected to produce; the next header
 * scroll event consumes that record whether or not it matches, so a later genuine
 * header scroll back to the same position is still mirrored onto the chart.
 */
export const createHorizontalScrollSync = () => {
  let pendingEchoLeft: number | null = null;

  return {
    syncFromChart(chart: ScrollLeftTarget, timeline: ScrollLeftTarget | null) {
      if (!timeline) return;

      const before = timeline.scrollLeft;
      if (before === chart.scrollLeft) return;

      timeline.scrollLeft = chart.scrollLeft;
      const after = timeline.scrollLeft;

      // A clamped write that didn't move the header fires no scroll event, so there is
      // no echo to wait for.
      if (after !== before) pendingEchoLeft = after;
    },

    syncFromTimeline(timeline: ScrollLeftTarget, chart: ScrollLeftTarget | null) {
      const expectedEcho = pendingEchoLeft;
      pendingEchoLeft = null;

      if (expectedEcho !== null && Math.abs(timeline.scrollLeft - expectedEcho) < 1) return;

      if (chart && chart.scrollLeft !== timeline.scrollLeft) {
        chart.scrollLeft = timeline.scrollLeft;
      }
    },
  };
};
