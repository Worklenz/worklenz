import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setSession, getUserSession } from '../session-helper';

describe('session-helper UTF-8 round-trip', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    // setup.ts mocks localStorage as vi.fn()s; back them with an in-memory
    // store so setSession/getUserSession actually round-trip.
    store = {};
    vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => {
      store[k] = String(v);
    });
    vi.mocked(localStorage.getItem).mockImplementation((k: string) => (k in store ? store[k] : null));
  });

  it('round-trips a non-ASCII (Chinese) display name without mojibake', () => {
    setSession({ name: '測試小明', email: 'admin@worklenz.test' } as any);
    // Before the fix getUserSession used atob() only and returned 'æ¸¬è©¦å°æ'.
    expect(getUserSession()?.name).toBe('測試小明');
  });

  it('round-trips ASCII content unchanged', () => {
    setSession({ name: 'John Doe', email: 'john@example.com' } as any);
    const s = getUserSession();
    expect(s?.name).toBe('John Doe');
    expect(s?.email).toBe('john@example.com');
  });
});
