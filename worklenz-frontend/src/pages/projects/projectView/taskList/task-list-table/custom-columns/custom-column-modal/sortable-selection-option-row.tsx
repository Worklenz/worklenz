import React from 'react';
import { Flex, theme } from '@/shared/antd-imports';
import { HolderOutlined } from '@/shared/antd-imports';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableSelectionOptionRowProps {
  id: string;
  dragHandleLabel: string;
  children: React.ReactNode;
}

/**
 * Shared drag-handle row for custom-column selection/label option editors.
 * Listeners stay on the handle so inputs remain editable while dragging.
 */
export const SortableSelectionOptionRow = ({
  id,
  dragHandleLabel,
  children,
}: SortableSelectionOptionRowProps) => {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <Flex gap={8} align="center">
        <span
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-label={dragHandleLabel}
          style={{
            display: 'inline-flex',
            cursor: isDragging ? 'grabbing' : 'grab',
            color: token.colorTextTertiary,
            touchAction: 'none',
            flexShrink: 0,
          }}
        >
          <HolderOutlined style={{ fontSize: 14 }} />
        </span>
        {children}
      </Flex>
    </div>
  );
};
