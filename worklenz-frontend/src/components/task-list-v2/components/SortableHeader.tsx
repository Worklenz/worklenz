import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ColumnConfig } from '../constants/columns';

export const SortableHeader: React.FC<{
  column: Pick<ColumnConfig, 'id' | 'width'>;
  isDropTarget: boolean;
  children: (params: {
    attributes: ReturnType<typeof useSortable>['attributes'];
    listeners: ReturnType<typeof useSortable>['listeners'];
    setActivatorNodeRef: (element: HTMLElement | null) => void;
    isDragging: boolean;
  }) => React.ReactNode;
}> = React.memo(({ column, isDropTarget, children }) => {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    // Disable the automatic scaling that dnd-kit applies during drag
    animateLayoutChanges: () => false,
  });

  // Get the actual pixel width from the column object, not CSS variable
  const explicitWidth = column.width; // This is already a string like "120px"

  // Remove scale from transform to prevent width changes during drag
  const transformWithoutScale = transform
    ? {
        ...transform,
        scaleX: 1,
        scaleY: 1,
      }
    : null;

  const style = {
    transform: transformWithoutScale ? CSS.Transform.toString(transformWithoutScale) : undefined,
    transition,
    zIndex: isDragging ? 25 : undefined,
    willChange: isDragging ? 'transform' : undefined,
    // Use explicit pixel width, not CSS variable, to prevent width changes during drag
    width: explicitWidth,
    minWidth: explicitWidth,
    maxWidth: explicitWidth,
    flexShrink: 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-column-id={column.id}
      className={isDropTarget ? 'column-drop-target' : undefined}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
});
