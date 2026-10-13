import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
  type MouseSensorOptions,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { GripIcon } from './HomeWidgetShell';
import { HOME_WIDGET_ICONS } from './widgetIcons';
import {
  isWidgetDragSourceTarget,
  isWidgetSurfaceTarget,
  parseDragId,
  resolveDropTarget,
  WIDGET_COLUMN_ATTRIBUTE,
  WIDGET_ID_ATTRIBUTE,
  type DragSource,
  type DropTarget,
  type MeasuredColumn,
} from './widgetInteraction';
import {
  addWidget,
  getHomeWidget,
  moveWidgetRelativeTo,
  type HomeColumn,
  type HomeLayout,
  type HomeWidgetId,
} from '../home-layout/homeLayout';
import './home-widgets.css';

/** How far the pointer must move before a press becomes a drag, so a plain click never drags. */
const DRAG_START_DISTANCE = 6;
const GHOST_MIN_WIDTH = 220;
const GHOST_MAX_WIDTH = 320;
/** Where on the ghost the pointer sits, measured from its top-left corner. */
const GHOST_GRAB = { x: 24, y: 20 };

/**
 * The stock mouse sensor, except that a press only starts a drag on a widget's header or
 * whitespace, or on a row of the "Add widget" menu. Pressing on data (a row, a number, a button)
 * is left to behave as a normal click.
 */
class WidgetMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent: event }: React.MouseEvent, { onActivation }: MouseSensorOptions): boolean => {
        if (event.button !== 0) return false;
        if (!isWidgetSurfaceTarget(event.target) && !isWidgetDragSourceTarget(event.target)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/** Puts the ghost's grab point under the pointer, whatever the size of whatever was picked up. */
const snapGhostToPointer: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  const start = activatorEvent ? getEventCoordinates(activatorEvent) : null;
  if (!start || !draggingNodeRect) return transform;
  return {
    ...transform,
    x: transform.x + (start.x - draggingNodeRect.left) - GHOST_GRAB.x,
    y: transform.y + (start.y - draggingNodeRect.top) - GHOST_GRAB.y,
  };
};

const isSameDropTarget = (a: DropTarget | null, b: DropTarget | null): boolean =>
  a === b || (!!a && !!b && a.column === b.column && a.targetId === b.targetId && a.position === b.position);

interface DragState {
  widgetId: HomeWidgetId;
  source: DragSource;
}

interface HomeWidgetDndValue {
  /** What is being dragged, and where from; null when nothing is. */
  dragging: DragState | null;
  /** Where it would land if dropped now, or null when nowhere (or nowhere new). */
  dropTarget: DropTarget | null;
  /** The board registers its element here, so drops can be worked out from where its columns are. */
  boardRef: MutableRefObject<HTMLElement | null>;
}

// Without a provider (a test, or a page that has no dragging) nothing is ever being dragged.
const HomeWidgetDndContext = createContext<HomeWidgetDndValue>({
  dragging: null,
  dropTarget: null,
  boardRef: { current: null },
});

export const useHomeWidgetDnd = (): HomeWidgetDndValue => useContext(HomeWidgetDndContext);

interface HomeWidgetDndProps {
  layout: HomeLayout;
  /** Whether dragging is on at all. Off on small screens, where the page is one column. */
  isEnabled: boolean;
  onLayoutChange: (layout: HomeLayout) => void;
  /** A widget was dragged out of the "Add widget" menu onto the page. */
  onWidgetAdded: (id: HomeWidgetId) => void;
  children: React.ReactNode;
}

/**
 * Everything about dragging Home widgets. It wraps both the board and the toolbar's "Add widget"
 * menu, so one drag can start in either: a widget already on the page is moved to where it is
 * dropped, and a widget picked up from the menu is added to the page where it is dropped.
 *
 * Where a widget would land is worked out from the live position of the columns and widgets on
 * screen, so it stays right while the page scrolls under the pointer.
 */
export const HomeWidgetDnd: React.FC<HomeWidgetDndProps> = ({
  layout,
  isEnabled,
  onLayoutChange,
  onWidgetAdded,
  children,
}) => {
  const { t } = useTranslation('home');
  const boardRef = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [ghostWidth, setGhostWidth] = useState(GHOST_MAX_WIDTH);

  const dragSensors = useSensors(useSensor(WidgetMouseSensor, { activationConstraint: { distance: DRAG_START_DISTANCE } }));
  const noSensors = useSensors();

  const titleOf = useCallback(
    (id: HomeWidgetId) => {
      const widget = getHomeWidget(id);
      return t(widget.titleKey, { defaultValue: widget.titleDefault });
    },
    [t]
  );

  const measureColumns = (): MeasuredColumn[] =>
    Array.from(boardRef.current?.querySelectorAll<HTMLElement>(`[${WIDGET_COLUMN_ATTRIBUTE}]`) ?? []).map(element => ({
      column: element.getAttribute(WIDGET_COLUMN_ATTRIBUTE) as HomeColumn,
      rect: element.getBoundingClientRect(),
      widgets: Array.from(element.children)
        .filter(child => child.hasAttribute(WIDGET_ID_ATTRIBUTE))
        .map(child => ({
          id: child.getAttribute(WIDGET_ID_ATTRIBUTE) as HomeWidgetId,
          rect: child.getBoundingClientRect(),
        })),
    }));

  /**
   * Where the dragged widget would land now, or null when nowhere. A widget already on the page
   * that would land exactly where it already is has nowhere new to go either; one from the menu
   * always has somewhere to go, since it is not on the page yet.
   */
  const computeDropTarget = ({ active, activatorEvent, delta }: DragMoveEvent | DragEndEvent): DropTarget | null => {
    const drag = parseDragId(active.id);
    const start = getEventCoordinates(activatorEvent);
    if (!drag || !start) return null;
    const target = resolveDropTarget(
      { x: start.x + delta.x, y: start.y + delta.y },
      measureColumns(),
      drag.widgetId,
      getHomeWidget(drag.widgetId).allowedColumns
    );
    if (!target) return null;
    if (drag.source === 'menu') return target;
    return moveWidgetRelativeTo(layout, drag.widgetId, target.column, target.targetId, target.position) === layout
      ? null
      : target;
  };

  const endDrag = () => {
    document.body.classList.remove('home-widget-dragging');
    setDragging(null);
    setDropTarget(null);
  };

  // Never leave the page stuck in the dragging cursor, e.g. if the page is left mid-drag.
  useEffect(() => () => document.body.classList.remove('home-widget-dragging'), []);

  const handleDragStart = ({ active }: DragStartEvent) => {
    const drag = parseDragId(active.id);
    if (!drag) return;
    document.body.classList.add('home-widget-dragging');
    setDragging(drag);
    const width = active.rect.current.initial?.width ?? GHOST_MAX_WIDTH;
    setGhostWidth(Math.min(Math.max(width, GHOST_MIN_WIDTH), GHOST_MAX_WIDTH));
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const target = computeDropTarget(event);
    setDropTarget(previous => (isSameDropTarget(previous, target) ? previous : target));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const drag = parseDragId(event.active.id);
    const target = computeDropTarget(event);
    endDrag();
    if (!drag || !target) return;

    if (drag.source === 'board') {
      onLayoutChange(moveWidgetRelativeTo(layout, drag.widgetId, target.column, target.targetId, target.position));
      return;
    }
    // From the menu: put it on the page, then move it to where it was dropped.
    onLayoutChange(
      moveWidgetRelativeTo(addWidget(layout, drag.widgetId), drag.widgetId, target.column, target.targetId, target.position)
    );
    onWidgetAdded(drag.widgetId);
  };

  // Screen readers get the widget's name, not its internal id.
  const nameOf = (id: string | number): string | undefined => {
    const drag = parseDragId(id);
    return drag ? titleOf(drag.widgetId) : undefined;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const name = nameOf(active.id);
      return name && t('widgets.drag.pickedUp', { defaultValue: 'Picked up {{name}}.', name });
    },
    onDragEnd: ({ active }) => {
      const name = nameOf(active.id);
      return name && t('widgets.drag.dropped', { defaultValue: 'Dropped {{name}}.', name });
    },
    onDragCancel: ({ active }) => {
      const name = nameOf(active.id);
      return name && t('widgets.drag.cancelled', { defaultValue: 'Moving {{name}} was cancelled.', name });
    },
    onDragOver: () => undefined,
    onDragMove: () => undefined,
  };

  const value = useMemo(() => ({ dragging, dropTarget, boardRef }), [dragging, dropTarget]);

  return (
    <HomeWidgetDndContext.Provider value={value}>
      <DndContext
        sensors={isEnabled ? dragSensors : noSensors}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={endDrag}
      >
        {children}
        <DragOverlay
          dropAnimation={null}
          // Under the pointer, but never partly off the edge of the window (the side column is at the edge).
          modifiers={[snapGhostToPointer, restrictToWindowEdges]}
          style={{ width: ghostWidth, height: 'auto' }}
        >
          {dragging && <WidgetGhost id={dragging.widgetId} title={titleOf(dragging.widgetId)} />}
        </DragOverlay>
      </DndContext>
    </HomeWidgetDndContext.Provider>
  );
};

/** What follows the pointer while a widget is dragged: a compact card, however big the widget is. */
const WidgetGhost: React.FC<{ id: HomeWidgetId; title: string }> = ({ id, title }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        border: `1px solid ${token.colorPrimary}`,
        background: token.colorBgElevated,
        boxShadow: token.boxShadowSecondary,
        color: token.colorText,
      }}
    >
      <span aria-hidden style={{ display: 'flex', color: token.colorTextTertiary }}>
        <GripIcon />
      </span>
      <span aria-hidden style={{ display: 'flex', color: token.colorPrimary }}>
        {HOME_WIDGET_ICONS[id]}
      </span>
      <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
        {title}
      </Typography.Text>
    </div>
  );
};
