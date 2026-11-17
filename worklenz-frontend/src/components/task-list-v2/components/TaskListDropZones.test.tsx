import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropSpacer } from './TaskListDropZones';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));

const columns = [
  { id: 'checkbox', label: '', width: '28px', isSticky: true },
  { id: 'title', label: '', width: '200px', isSticky: true },
];

describe('DropSpacer', () => {
  it('shows the drop indicator with the title aligned after sticky columns', () => {
    const { rerender } = render(<DropSpacer isVisible={false} visibleColumns={columns} />);
    expect(screen.queryByText('Drop here')).not.toBeInTheDocument();

    rerender(<DropSpacer isVisible visibleColumns={columns} />);
    expect(screen.getByText('Drop here').parentElement).toHaveStyle({ left: '28px' });
  });
});
