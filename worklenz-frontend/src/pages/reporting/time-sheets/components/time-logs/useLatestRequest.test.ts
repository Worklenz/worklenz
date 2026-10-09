import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { IServerResponse } from '@/types/common.types';
import { useLatestRequest } from './useLatestRequest';

vi.mock('@/utils/errorLogger', () => ({ default: { error: vi.fn() } }));

interface IBody {
  value: string;
}

const ok = (value: string): IServerResponse<IBody> => ({
  done: true,
  body: { value },
  title: '',
  message: '',
});
const refused = (): IServerResponse<IBody> => ({
  done: false,
  body: null as unknown as IBody,
  title: '',
  message: '',
});

/** A promise the test settles by hand, to control the order responses arrive in. */
const deferred = () => {
  let resolve: (value: IServerResponse<IBody>) => void = () => undefined;
  const promise = new Promise<IServerResponse<IBody>>(r => (resolve = r));
  return { promise, resolve };
};

const OPTIONS = { enabled: true, errorLabel: 'test error' };

describe('useLatestRequest', () => {
  it('is loading from the very first render, then holds the body', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok('first'));
    const { result } = renderHook(() => useLatestRequest({ q: 1 }, fetcher, OPTIONS));

    // no frame of "nothing loaded and not loading" before the effect starts the request
    expect(result.current.loading).toBe(true);
    expect(result.current.body).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.body).toEqual({ value: 'first' });
    expect(result.current.failed).toBe(false);
    expect(fetcher).toHaveBeenCalledWith({ q: 1 });
  });

  it('reloads when the contents of the request change — not when only its identity does', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok('x'));
    const { result, rerender } = renderHook(
      ({ request }) => useLatestRequest(request, fetcher, OPTIONS),
      {
        initialProps: { request: { q: 1 } },
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ request: { q: 1 } }); // a new object with the same contents
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ request: { q: 2 } });
    // loading on the very render the request changed — the old body is kept meanwhile
    expect(result.current.loading).toBe(true);
    expect(result.current.body).toEqual({ value: 'x' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith({ q: 2 });
  });

  it('drops a response that arrives after a newer request was issued', async () => {
    const slow = deferred();
    const fast = deferred();
    const fetcher = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const { result, rerender } = renderHook(
      ({ request }) => useLatestRequest(request, fetcher, OPTIONS),
      {
        initialProps: { request: { q: 'a' } },
      }
    );
    rerender({ request: { q: 'ab' } });

    await act(async () => {
      fast.resolve(ok('newer'));
    });
    await waitFor(() => expect(result.current.body).toEqual({ value: 'newer' }));

    await act(async () => {
      slow.resolve(ok('older'));
    });
    expect(result.current.body).toEqual({ value: 'newer' });
  });

  it('sends nothing while disabled, and loads once enabled', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok('later'));
    const { result, rerender } = renderHook(
      ({ enabled }) => useLatestRequest({ q: 1 }, fetcher, { ...OPTIONS, enabled }),
      { initialProps: { enabled: false } }
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);

    rerender({ enabled: true });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.body).toEqual({ value: 'later' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('drops a response that arrives after it was disabled', async () => {
    const pending = deferred();
    const fetcher = vi.fn().mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(
      ({ enabled }) => useLatestRequest({ q: 1 }, fetcher, { ...OPTIONS, enabled }),
      { initialProps: { enabled: true } }
    );
    rerender({ enabled: false });
    await act(async () => {
      pending.resolve(ok('too late'));
    });
    expect(result.current.body).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('reports a refused response as a failure with no body, and recovers on reload', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(refused()).mockResolvedValueOnce(ok('recovered'));
    const { result } = renderHook(() => useLatestRequest({ q: 1 }, fetcher, OPTIONS));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.body).toBeNull();
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.body).toEqual({ value: 'recovered' });
  });

  it('reports a thrown error as a failure with no stale body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok('fine'))
      .mockRejectedValueOnce(new Error('boom'));
    const { result, rerender } = renderHook(
      ({ request }) => useLatestRequest(request, fetcher, OPTIONS),
      {
        initialProps: { request: { q: 1 } },
      }
    );
    await waitFor(() => expect(result.current.body).toEqual({ value: 'fine' }));

    rerender({ request: { q: 2 } });
    await waitFor(() => expect(result.current.failed).toBe(true));
    // never a stale figure next to an error
    expect(result.current.body).toBeNull();
  });

  it('is not "failed" while the next request after a failure is on its way', async () => {
    const next = deferred();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(
      ({ request }) => useLatestRequest(request, fetcher, OPTIONS),
      {
        initialProps: { request: { q: 1 } },
      }
    );
    await waitFor(() => expect(result.current.failed).toBe(true));

    rerender({ request: { q: 2 } });
    expect(result.current.failed).toBe(false);
    expect(result.current.loading).toBe(true);
    await act(async () => {
      next.resolve(ok('fine'));
    });
    await waitFor(() => expect(result.current.body).toEqual({ value: 'fine' }));
  });
});
