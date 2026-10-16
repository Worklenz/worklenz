import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPortal } from '@/test/renderPortal';
import DashboardPage from '@/pages/v2/DashboardPage';

// The test setup reports matchMedia as never matching, i.e. a narrow (tablet or phone) screen.
describe('Overview on tablet and phone', () => {
  it('flows widgets in reading order with natural heights and no drag grid', async () => {
    const { container } = renderPortal(<DashboardPage />);
    expect(await screen.findByText('Needs your action')).toBeInTheDocument();

    expect(container.querySelector('.dashboard-stack')).toBeInTheDocument();
    expect(container.querySelector('.react-grid-layout')).not.toBeInTheDocument();

    // The three summary tiles share one evenly filled row instead of being stretched beside a card.
    const tileRow = container.querySelector('.dashboard-stack__tiles');
    expect(tileRow?.children).toHaveLength(3);

    const items = Array.from(container.querySelectorAll('.dashboard-stack__item'));
    expect(items[0]).toBe(tileRow);
    // Then the action cards, projects and activity, in the desktop order.
    const order = ['Needs your action', 'Upcoming milestones', 'Your projects', 'Recent activity'].map(title =>
      items.findIndex((item, index) => index > 0 && (item.textContent ?? '').includes(title)),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every(index => index > 0)).toBe(true);
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
  });

  it('keeps arranging a desktop feature: no Customise button on a narrow screen', async () => {
    renderPortal(<DashboardPage />);
    expect(await screen.findByText('Your projects')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Customise/ })).not.toBeInTheDocument();
  });
});
