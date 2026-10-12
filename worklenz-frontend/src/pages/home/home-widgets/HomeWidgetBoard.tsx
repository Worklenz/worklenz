import React, { useCallback, useRef } from 'react';
import { theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { HomeWidgetShell } from './HomeWidgetShell';
import { useHomeWidgetDnd } from './HomeWidgetDnd';
import type { HomeWidgetActions } from './HomeWidgetContext';
import { useBoardFillHeight } from './useBoardFillHeight';
import { HomeEmptyState } from './HomeEmptyState';
import { WIDGET_COLUMN_ATTRIBUTE } from './widgetInteraction';
import {
  getHomeWidget,
  getOtherAllowedColumn,
  getVisibleWidgetIds,
  moveWidgetToIndex,
  removeWidget,
  type HomeColumn,
  type HomeLayout,
  type HomeSectionId,
  type HomeWidgetId,
} from '../home-layout/homeLayout';
import './home-widgets.css';

const SIDE_COLUMN_WIDTH = 320;

export interface HomeWidgetBoardProps {
  layout: HomeLayout;
  isDesktop: boolean;
  onLayoutChange: (layout: HomeLayout) => void;
  renderWidget: (id: HomeWidgetId) => React.ReactNode;
  /** The widget that was just added: it is highlighted and scrolled into view. */
  justAddedId: HomeWidgetId | null;
  /** Adds a widget (or the greeting). With it, an empty page shows where to add widgets from. */
  onAddSection?: (id: HomeSectionId) => void;
}

/**
 * The widgets of the Home overview, in their one or two columns. On desktop each widget can be
 * dragged to a new place in either column (see HomeWidgetDnd); the "..." menu of every widget
 * sends it to the other column or removes it.
 */
export const HomeWidgetBoard: React.FC<HomeWidgetBoardProps> = ({
  layout,
  isDesktop,
  onLayoutChange,
  renderWidget,
  justAddedId,
  onAddSection,
}) => {
  const { t } = useTranslation('home');
  const { dragging, dropTarget, boardRef: dndBoardRef } = useHomeWidgetDnd();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const fillHeight = useBoardFillHeight(boardRef, isDesktop);

  // The drag layer needs the board's element to work out where a drop would land.
  const setBoardNode = useCallback(
    (node: HTMLDivElement | null) => {
      boardRef.current = node;
      dndBoardRef.current = node;
    },
    [dndBoardRef]
  );

  const titleOf = (id: HomeWidgetId) => {
    const widget = getHomeWidget(id);
    return t(widget.titleKey, { defaultValue: widget.titleDefault });
  };

  const visible: Record<HomeColumn, HomeWidgetId[]> = {
    main: getVisibleWidgetIds(layout, 'main'),
    side: getVisibleWidgetIds(layout, 'side'),
  };

  const buildActions = (id: HomeWidgetId): HomeWidgetActions => {
    const otherColumn = getOtherAllowedColumn(layout, id);
    return {
      otherColumn,
      canRemove: getHomeWidget(id).canHide,
      onMoveToOtherColumn: () => otherColumn && onLayoutChange(moveWidgetToIndex(layout, id, otherColumn, 0)),
      onRemove: () => onLayoutChange(removeWidget(layout, id)),
    };
  };

  const renderShell = (id: HomeWidgetId, column: HomeColumn | null) => (
    <HomeWidgetShell
      key={id}
      id={id}
      title={titleOf(id)}
      column={column}
      actions={buildActions(id)}
      isDragEnabled={isDesktop}
      isFilling={isDesktop && getHomeWidget(id).fillsHeight}
      dropIndicator={dropTarget?.targetId === id ? dropTarget.position : null}
      isJustAdded={justAddedId === id}
    >
      {renderWidget(id)}
    </HomeWidgetShell>
  );

  const isEmpty = visible.main.length === 0 && visible.side.length === 0;
  const emptyState = isEmpty && onAddSection && (
    <HomeEmptyState
      layout={layout}
      onAdd={onAddSection}
      isDragEnabled={isDesktop}
      isDragging={dragging !== null}
      isDropTarget={dropTarget?.column === 'main' && dropTarget.targetId === null}
    />
  );

  if (!isDesktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[...visible.main, ...visible.side].map(id => renderShell(id, null))}
        {emptyState}
      </div>
    );
  }

  // The side column is only there when it has something in it, or while a widget is being dragged
  // so there is somewhere to drop into.
  const showSideColumn = visible.side.length > 0 || dragging !== null;

  return (
    <div
      ref={setBoardNode}
      className={`home-board${dragging ? ' is-dragging' : ''}`}
      // Columns don't stretch to each other: a tall side column must not make the table taller too.
      style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}
    >
      <BoardColumn column="main" style={{ flex: 1, minWidth: 0, minHeight: fillHeight }}>
        {visible.main.map(id => renderShell(id, 'main'))}
        {emptyState}
      </BoardColumn>
      {showSideColumn && (
        <BoardColumn
          column="side"
          style={{ width: SIDE_COLUMN_WIDTH, minWidth: SIDE_COLUMN_WIDTH, minHeight: fillHeight }}
        >
          {visible.side.map(id => renderShell(id, 'side'))}
          {visible.side.length === 0 && (
            <EmptyColumnDropZone isTarget={dropTarget?.column === 'side' && dropTarget.targetId === null} />
          )}
        </BoardColumn>
      )}
    </div>
  );
};

interface BoardColumnProps {
  column: HomeColumn;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const BoardColumn: React.FC<BoardColumnProps> = ({ column, style, children }) => (
  <div
    {...{ [WIDGET_COLUMN_ATTRIBUTE]: column }}
    style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}
  >
    {children}
  </div>
);

/** What an empty side column shows while a widget is being dragged: somewhere to drop it. */
const EmptyColumnDropZone: React.FC<{ isTarget: boolean }> = ({ isTarget }) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  return (
    <div
      aria-hidden
      style={{
        flex: 1,
        minHeight: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        textAlign: 'center',
        borderRadius: 10,
        border: `2px dashed ${isTarget ? token.colorPrimary : token.colorBorder}`,
        background: isTarget ? token.colorPrimaryBg : 'transparent',
        color: token.colorTextSecondary,
        transition: 'background 150ms, border-color 150ms',
      }}
    >
      {t('widgets.dropHere', { defaultValue: 'Drop a widget here' })}
    </div>
  );
};
