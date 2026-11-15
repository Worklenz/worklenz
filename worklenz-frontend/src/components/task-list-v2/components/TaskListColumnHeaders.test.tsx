import React, { useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskListColumnHeaders } from './TaskListColumnHeaders';
import type { ColumnConfig } from '../constants/columns';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: { defaultValue: string; column?: string }) =>
      (options.defaultValue || key).replace('{{column}}', options.column || ''),
  }),
}));
vi.mock('./CustomColumnComponents', () => ({
  AddCustomColumnButton: () => <button>Add column</button>,
  CustomColumnHeader: () => <span>Custom column</span>,
}));

const columns: ColumnConfig[] = [
  {
    id: 'title',
    label: 'Task',
    width: '300px',
    minWidth: '200px',
    maxWidth: '400px',
    isSticky: true,
  },
  { id: 'priority', label: 'Priority', width: '120px', minWidth: '100px', maxWidth: '200px' },
];
const Fixture = ({ isBacklogMode = false }: { isBacklogMode?: boolean }) => {
  const outerScrollRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<Record<string, string>>({});
  return (
    <div ref={outerScrollRef} data-testid="scroll-container">
      <TaskListColumnHeaders
        visibleColumns={columns.map(column => ({
          ...column,
          width: widths[column.id] || column.width,
        }))}
        overColumnId={null}
        activeColumnId={null}
        columnSensors={[]}
        handleColumnDragStart={vi.fn()}
        handleColumnDragOver={vi.fn()}
        handleColumnDragEnd={vi.fn()}
        handleCustomColumnSettings={vi.fn()}
        columnWidths={widths}
        setColumnWidths={setWidths}
        outerScrollRef={outerScrollRef}
        contentScrollRef={contentScrollRef}
        isBacklogMode={isBacklogMode}
        isGuest={false}
      />
      <output data-testid="column-widths">{JSON.stringify(widths)}</output>
    </div>
  );
};

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.style.removeProperty('--col-width-title');
});

describe('task-list column headers', () => {
  it('resizes with arrow keys and Shift and clamps to configured limits', () => {
    render(<Fixture />);
    const handle = screen.getByRole('separator', { name: 'Resize Task column' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(document.documentElement.style.getPropertyValue('--col-width-title')).toBe('301px');
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(document.documentElement.style.getPropertyValue('--col-width-title')).toBe('291px');
    for (let n = 0; n < 20; n++) fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(handle).toHaveAttribute('aria-valuenow', '200');
    expect(screen.getByTestId('column-widths')).toHaveTextContent('200px');
  });

  it('positions mouse resize feedback relative to horizontal scroll and cleans up on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Fixture />);
    const parent = screen.getByTestId('scroll-container');
    parent.scrollLeft = 150;
    const handle = screen.getByRole('separator', { name: 'Resize Task column' });
    fireEvent.mouseDown(handle, { clientX: 300, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 350 });
    expect(document.documentElement.style.getPropertyValue('--col-width-title')).toBe('350px');
    expect(parent.querySelector<HTMLElement>('.column-resize-indicator')?.style.left).toBe('500px');
    unmount();
    expect(document.body).not.toHaveClass('column-resizing');
    expect(document.body.style.cursor).toBe('');
    fireEvent.mouseMove(document, { clientX: 380 });
    expect(document.documentElement.style.getPropertyValue('--col-width-title')).toBe('350px');
    act(() => vi.runAllTimers());
    expect(document.querySelector('.column-resize-tooltip')).toBeNull();
  });

  it('persists mouse width on release and removes transient resize feedback', () => {
    vi.useFakeTimers();
    render(<Fixture />);
    fireEvent.mouseDown(screen.getByRole('separator', { name: 'Resize Task column' }), {
      clientX: 300,
    });
    fireEvent.mouseMove(document, { clientX: 500 });
    fireEvent.mouseUp(document, { clientX: 500 });
    expect(screen.getByTestId('column-widths')).toHaveTextContent('400px');
    expect(document.body).not.toHaveClass('column-resizing');
    act(() => vi.runAllTimers());
    expect(document.querySelector('.column-resize-indicator')).toBeNull();
  });

  it('retains the Backlog restriction on adding custom columns', () => {
    const { rerender } = render(<Fixture />);
    expect(screen.getByRole('button', { name: 'Add column' })).toBeInTheDocument();
    rerender(<Fixture isBacklogMode />);
    expect(screen.queryByRole('button', { name: 'Add column' })).not.toBeInTheDocument();
  });
});
