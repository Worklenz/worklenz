import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeferredMount } from './DeferredMount';

describe('deferred dialogs', () => {
  it('skips initial setup, opens immediately, and preserves state while closing', () => {
    let mounts = 0;
    const Dialog = ({ isOpen }: { isOpen: boolean }) => {
      const [count, setCount] = useState(() => {
        mounts++;
        return 0;
      });
      return (
        <button hidden={!isOpen} onClick={() => setCount(value => value + 1)}>
          Count {count}
        </button>
      );
    };
    const dialog = (isOpen: boolean) => (
      <DeferredMount isOpen={isOpen}>
        <Dialog isOpen={isOpen} />
      </DeferredMount>
    );
    const { rerender } = render(dialog(false));
    expect(mounts).toBe(0);
    rerender(dialog(true));
    fireEvent.click(screen.getByRole('button', { name: 'Count 0' }));
    rerender(dialog(false));
    expect(screen.getByText('Count 1')).not.toBeVisible();
    rerender(dialog(true));
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeVisible();
    expect(mounts).toBe(1);
  });
});
