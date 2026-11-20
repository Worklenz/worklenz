import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropSpacer, GroupDropZone, InsertTaskDivider } from './TaskListDropIndicators';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || 'Drop here',
  }),
}));

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

describe('TaskListDropIndicators', () => {
  const visibleColumns = [
    { id: 'dragHandle', label: '', width: '20px', isSticky: true },
    { id: 'checkbox', label: '', width: '28px', isSticky: true },
    { id: 'title', label: 'Title', width: '300px', isSticky: true },
    { id: 'priority', label: 'Priority', width: '100px', isSticky: false },
  ];

  describe('DropSpacer', () => {
    it('returns null when isVisible is false', () => {
      const { container } = render(
        <DropSpacer isVisible={false} visibleColumns={visibleColumns} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders drop spacer with Drop here label in title column', () => {
      render(<DropSpacer isVisible={true} visibleColumns={visibleColumns} />);
      expect(screen.getByText('Drop here')).toBeInTheDocument();
    });
  });

  describe('GroupDropZone', () => {
    it('renders children and applies active styles', () => {
      const { container, rerender } = render(
        <GroupDropZone groupId="g-1" isActive={false}>
          <span>Group Content</span>
        </GroupDropZone>
      );
      expect(screen.getByText('Group Content')).toBeInTheDocument();
      expect(container.firstChild).not.toHaveClass('ring-2');

      rerender(
        <GroupDropZone groupId="g-1" isActive={true}>
          <span>Group Content</span>
        </GroupDropZone>
      );
      expect(container.firstChild).toHaveClass('ring-2');
    });
  });

  describe('InsertTaskDivider', () => {
    it('returns null when isVisible is false or isNearGroupHeader is true', () => {
      const { container: c1 } = render(
        <InsertTaskDivider
          isVisible={false}
          isNearGroupHeader={false}
          title="Insert Task"
          onInsert={vi.fn()}
        />
      );
      expect(c1.firstChild).toBeNull();

      const { container: c2 } = render(
        <InsertTaskDivider
          isVisible={true}
          isNearGroupHeader={true}
          title="Insert Task"
          onInsert={vi.fn()}
        />
      );
      expect(c2.firstChild).toBeNull();
    });

    it('renders button and triggers onInsert on click', () => {
      const onInsert = vi.fn();
      render(
        <InsertTaskDivider
          isVisible={true}
          isNearGroupHeader={false}
          title="Insert Task"
          onInsert={onInsert}
        />
      );

      const button = screen.getByRole('button', { name: 'Insert Task' });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(onInsert).toHaveBeenCalled();
    });
  });
});
