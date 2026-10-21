import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { theme } from '@/shared/antd-imports';
import { HomeWidgetProvider, type HomeWidgetActions } from './HomeWidgetContext';
import { isWidgetSurfaceTarget, WIDGET_ID_ATTRIBUTE } from './widgetInteraction';
import type { HomeColumn, HomeWidgetId } from '../home-layout/homeLayout';
import './home-widgets.css';

/**
 * A widget that stretches to fill its column never gets shorter than this, however crowded the
 * column or short the screen: tall enough for its header, its tabs and a couple of rows. Below it
 * the page scrolls instead.
 */
const FILL_MIN_HEIGHT = 240;

export interface HomeWidgetShellProps {
  id: HomeWidgetId;
  title: string;
  /** The column it sits in, or null on a small screen, where everything is one column. */
  column: HomeColumn | null;
  actions: HomeWidgetActions;
  /** Whether the widget can be grabbed. Off on small screens, where the menu moves widgets instead. */
  isDragEnabled: boolean;
  /** Stretches to fill the height left in its column. */
  isFilling: boolean;
  /** Draws the landing line above or below this widget while another is dragged over it. */
  dropIndicator: 'before' | 'after' | null;
  isJustAdded: boolean;
  children: React.ReactNode;
}

/**
 * Wraps one widget on the Home overview. It makes the widget draggable from its header and
 * whitespace (never from the data it shows), shows the grip while the pointer is on that surface,
 * and lets the widget's own header render the "..." menu through context.
 */
export const HomeWidgetShell: React.FC<HomeWidgetShellProps> = ({
  id,
  title,
  column,
  actions,
  isDragEnabled,
  isFilling,
  dropIndicator,
  isJustAdded,
  children,
}) => {
  const { token } = theme.useToken();
  const { setNodeRef, listeners, isDragging } = useDraggable({ id, disabled: !isDragEnabled });
  const [isOverSurface, setIsOverSurface] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  // A widget the user has just added may land below the fold; bring it into view.
  useEffect(() => {
    if (isJustAdded) nodeRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [isJustAdded]);

  // `mouseover` fires each time the pointer enters a different element, so this only changes
  // state at the boundary between whitespace and data. A React event from a portal (an open
  // dropdown) also reaches here; it is not part of the widget's DOM, so it counts as data.
  const handleMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
    const isInside = event.currentTarget.contains(event.target as Node);
    setIsOverSurface(isInside && isWidgetSurfaceTarget(event.target));
  };

  const contextValue = useMemo(() => ({ id, title, column, actions }), [id, title, column, actions]);

  const className = [
    'home-widget',
    isFilling ? 'home-widget--fill' : '',
    isDragEnabled && isOverSurface && !isDragging ? 'is-surface' : '',
    isDragging ? 'is-dragging' : '',
    isJustAdded ? 'is-just-added' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <HomeWidgetProvider value={contextValue}>
      <div
        ref={setRefs}
        {...{ [WIDGET_ID_ATTRIBUTE]: id }}
        {...listeners}
        className={className}
        onMouseOver={isDragEnabled ? handleMouseOver : undefined}
        onMouseLeave={isDragEnabled ? () => setIsOverSurface(false) : undefined}
        style={
          {
            // A fill widget takes whatever height its column has left (see `.home-widget--fill`). The
            // basis is `0px`, not `0%`: a percentage of the column's auto height falls back to the
            // content, which would stop the card from fitting the page and scrolling inside itself.
            flex: isFilling ? '1 1 0px' : '0 0 auto',
            minHeight: isFilling ? FILL_MIN_HEIGHT : undefined,
            minWidth: 0,
            '--home-widget-accent': token.colorPrimary,
            '--home-widget-accent-soft': token.colorPrimaryBorder,
            '--home-widget-grip': token.colorTextTertiary,
            '--home-widget-row-hover': token.colorFillTertiary,
          } as React.CSSProperties
        }
      >
        {children}
        {isDragEnabled && (
          <span className="home-widget__grip" aria-hidden>
            <GripIcon />
          </span>
        )}
        {dropIndicator && <span className={`home-widget__drop home-widget__drop--${dropIndicator}`} aria-hidden />}
      </div>
    </HomeWidgetProvider>
  );
};

/** Two rows of three dots. */
export const GripIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={(size * 10) / 16} viewBox="0 0 16 10" fill="currentColor" focusable="false" aria-hidden>
    {[2, 8, 14].flatMap(cx => [2, 8].map(cy => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} />))}
  </svg>
);
