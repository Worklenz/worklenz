import React, { useEffect, useRef } from 'react';
import { Tooltip, Typography } from '@/shared/antd-imports';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface StickyTaskNameProps {
  name?: string | null;
  enterThreshold?: number;
  exitThreshold?: number;
}

/**
 * Mirrors the task name into the (already fixed) drawer header once the large
 * title in the body scrolls out of view, so the user never loses context.
 *
 * Visibility is toggled directly on the DOM node instead of through React state
 * so scrolling never re-renders the drawer or its heavy tab content.
 */
export const StickyTaskName: React.FC<StickyTaskNameProps> = ({
  name,
  enterThreshold = 70,
  exitThreshold = 30,
}) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let scroller: HTMLElement | null = null;
    let rafId: number | null = null;
    let retries = 0;
    let isVisible = false;

    // Resolve the scroll container relative to this header instead of querying
    // the document, so we always target this drawer's own body.
    const resolveScroller = () =>
      (anchorRef.current
        ?.closest('.ant-drawer-content-wrapper')
        ?.querySelector('.ant-drawer-body') as HTMLElement | null) ?? null;

    const applyVisibility = (next: boolean) => {
      isVisible = next;
      const element = textRef.current;
      if (!element) return;
      element.style.visibility = next ? 'visible' : 'hidden';
      element.style.opacity = next ? '1' : '0';
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!scroller) return;
        // Hysteresis prevents flicker when the position hovers the threshold.
        const next = isVisible
          ? scroller.scrollTop > exitThreshold
          : scroller.scrollTop > enterThreshold;
        if (next !== isVisible) applyVisibility(next);
      });
    };

    const attach = () => {
      scroller = resolveScroller();
      if (!scroller) {
        // The body is rendered as a sibling; allow a few frames in case it
        // mounts just after the header on first open.
        if (retries++ < 10) {
          rafId = requestAnimationFrame(attach);
        }
        return;
      }
      rafId = null;
      applyVisibility(scroller.scrollTop > enterThreshold);
      scroller.addEventListener('scroll', handleScroll, { passive: true });
    };

    attach();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      scroller?.removeEventListener('scroll', handleScroll);
    };
    // Re-subscribing per task keeps the mirrored name in sync with the scroll
    // position when switching tasks inside the open drawer.
  }, [enterThreshold, exitThreshold, name]);

  const decodedName = name ? decodeHtmlEntities(name) : '';

  return (
    <div ref={anchorRef} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
      <div
        ref={textRef}
        aria-hidden="true"
        style={{ visibility: 'hidden', opacity: 0, transition: 'opacity 150ms ease' }}
      >
        {decodedName && (
          <Tooltip title={decodedName} placement="bottomLeft">
            <Typography.Text
              ellipsis
              style={{ fontSize: 14, fontWeight: 600, maxWidth: '100%', display: 'block' }}
            >
              {decodedName}
            </Typography.Text>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
