import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';

// Return the inline defaultValue (with {{count}} interpolated) so assertions read like the UI copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string; defaultValue_one?: string; defaultValue_other?: string; count?: number; what?: string }) => {
      const count = options?.count;
      const template =
        count === 1 ? options?.defaultValue_one ?? options?.defaultValue : options?.defaultValue_other ?? options?.defaultValue;
      return (template ?? '').replace('{{count}}', String(count ?? '')).replace('{{what}}', options?.what ?? '');
    },
  }),
}));

import { DueTag, LockedNote, MentionText, StatusTag, UnavailableBanner } from '@/components/v2';

const inDays = (n: number) => dayjs().add(n, 'day').format('YYYY-MM-DD');

describe('StatusTag', () => {
  it('uses the shared vocabulary for each kind', () => {
    render(
      <>
        <StatusTag kind="approval" status="awaiting" />
        <StatusTag kind="changeRequest" status="more_info" />
        <StatusTag kind="milestone" status="delayed" />
        <StatusTag kind="task" status="not_started" />
        <StatusTag kind="project" status="at_risk" />
        <StatusTag kind="role" status="viewer" />
      </>
    );
    ['Awaiting Approval', 'More Information Required', 'Delayed', 'Not started', 'At risk', 'Client Viewer'].forEach(label =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it('falls back to the raw status for an unknown value', () => {
    render(<StatusTag kind="approval" status="draft" />);
    expect(screen.getByText('draft')).toBeInTheDocument();
  });
});

describe('DueTag', () => {
  it('reads naturally across the range', () => {
    render(
      <>
        <DueTag date={inDays(-2)} />
        <DueTag date={inDays(-1)} />
        <DueTag date={inDays(0)} />
        <DueTag date={inDays(1)} />
        <DueTag date={inDays(5)} />
      </>
    );
    ['2 days overdue', '1 day overdue', 'Due today', 'Due tomorrow', 'Due in 5 days'].forEach(label =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
  });
});

describe('LockedNote', () => {
  it('explains a locked control as a note', () => {
    render(<LockedNote>Client Viewers can't comment.</LockedNote>);
    expect(screen.getByRole('note')).toHaveTextContent("Client Viewers can't comment.");
  });
});

describe('MentionText', () => {
  it('shows @First Last as a chip and leaves other text alone', () => {
    render(<MentionText text="@Alex Chen the staging site is up" />);
    expect(screen.getByText('@Alex Chen')).toBeInTheDocument();
    expect(screen.getByText('the staging site is up')).toBeInTheDocument();
  });

  it('never renders message text as HTML', () => {
    const { container } = render(<MentionText text={'<img src=x onerror=alert(1)> hi'} />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('UnavailableBanner', () => {
  it('names what could not be opened without saying whether it exists', () => {
    render(<UnavailableBanner what="task" />);
    expect(screen.getByText(/The task you opened isn't available/)).toBeInTheDocument();
  });
});
