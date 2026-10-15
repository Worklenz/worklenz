import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownOutlined, UpOutlined } from '@/shared/antd-imports';

interface ScrollableRailProps {
  children: ReactNode;
  isDark: boolean;
  contentStyle?: CSSProperties;
  /** Space kept clear below the arrow (e.g. for a floating chat widget). */
  bottomInset?: number;
}

const SCROLL_STEP = 120;
const EDGE_THRESHOLD = 1;
const ARROW_HEIGHT = 28;

export const ScrollableRail = ({
  children,
  isDark,
  contentStyle,
  bottomInset = 0,
}: ScrollableRailProps) => {
  const { t } = useTranslation('reporting-sidebar');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > EDGE_THRESHOLD);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - EDGE_THRESHOLD);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);
    Array.from(el.children).forEach(child => resizeObserver.observe(child));
    return () => resizeObserver.disconnect();
  }, [updateScrollState]);

  const scrollByStep = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ top: direction * SCROLL_STEP, behavior: 'smooth' });
  };

  const arrowStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
  };

  // The bottom slot is always reserved. The top slot collapses while the up
  // arrow is hidden so the rail keeps its default spacing under the
  // expand/collapse toggle, and opens (rather than overlaying items) when the
  // arrow is needed.
  const slotStyle: CSSProperties = { height: ARROW_HEIGHT, flexShrink: 0 };
  const topSlotStyle: CSSProperties = {
    height: canScrollUp ? ARROW_HEIGHT : 0,
    flexShrink: 0,
    overflow: 'hidden',
    transition: 'height 0.15s ease',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        paddingBottom: bottomInset,
      }}
    >
      <div style={topSlotStyle}>
        {canScrollUp && (
          <button
            type="button"
            className="nav-rail-scroll-arrow nav-rail-scroll-arrow-up"
            style={arrowStyle}
            onClick={() => scrollByStep(-1)}
            aria-label={t('scrollUp', { defaultValue: 'Scroll up' })}
          >
            <UpOutlined style={{ fontSize: 14 }} />
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="nav-rail-scroll-hidden"
        style={{ ...contentStyle, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {children}
      </div>
      <div style={slotStyle}>
        {canScrollDown && (
          <button
            type="button"
            className="nav-rail-scroll-arrow"
            style={arrowStyle}
            onClick={() => scrollByStep(1)}
            aria-label={t('scrollDown', { defaultValue: 'Scroll down' })}
          >
            <DownOutlined style={{ fontSize: 14 }} />
          </button>
        )}
      </div>
    </div>
  );
};
