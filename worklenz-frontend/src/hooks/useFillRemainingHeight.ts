import React from 'react';

/**
 * Measures a container's own rendered height, live — for a container that
 * sits inside a CSS flex column already constraining it to "whatever space
 * is left" (`flex: 1 1 auto; min-height: <floor>px`, as a sibling of other
 * fixed-size rows such as a header or pagination bar). Flexbox does the
 * actual arithmetic of "how much is left after my fixed-size siblings claim
 * theirs" — exactly and synchronously, with no risk of drifting out of sync
 * the way subtracting a separately-measured sibling's height in JS can for a
 * frame (e.g. while that sibling is still settling its own size). This hook
 * only reads the result, for the one thing CSS can't hand a component
 * directly: an API (like AntD Table's `scroll.y`) that needs a real pixel
 * number rather than a CSS length.
 *
 * Re-measures on window resize and whenever the container's own size changes
 * (e.g. a sibling row wrapping onto a second line on a narrow screen), so it
 * stays correct without a manual re-tune.
 *
 * `recomputeDeps` forces an extra, synchronous (pre-paint) re-measurement
 * whenever any of these values change, on top of the ResizeObserver-driven
 * one. This matters because the ResizeObserver can only react to an element
 * that has *already* changed size — it's a best-effort, asynchronously
 * batched signal, not an immediate one. A sibling like `TablePagination`
 * that renders `null` while `total === 0` and then mounts real content once
 * data arrives is exactly the case that slips through: the very first
 * measurement (taken while that sibling is still empty) treats this
 * container as taller than it will end up being, and although the observer
 * does eventually catch it shrinking, pass the data that actually drives
 * the sibling's/content's size here (e.g. `[loading, list.length, total]`)
 * to force a same-tick recompute the instant it's known to be stale, rather
 * than trusting the observer alone.
 */
export function useFillRemainingHeight<T extends HTMLElement = HTMLDivElement>(
  minHeight = 200,
  recomputeDeps: React.DependencyList = []
) {
  const containerRef = React.useRef<T>(null);
  const [height, setHeight] = React.useState(300);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recompute = () => {
      // Defensive: if the container this effect captured has since been
      // unmounted/replaced (e.g. a caller conditionally swaps it for a
      // different element, such as a loading-skeleton branch), it's still a
      // live JS reference but detached from the document — its rect reads
      // as all zeros, which would otherwise collapse `available` to 0. Skip
      // the update rather than apply a bogus one; the last valid height
      // stays in effect until a real container remounts.
      if (!container.isConnected) return;
      const available = container.getBoundingClientRect().height;
      setHeight(Math.max(minHeight, Math.round(available)));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minHeight, ...recomputeDeps]);

  return { containerRef, height };
}
