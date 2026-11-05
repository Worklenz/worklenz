import { useCallback, useEffect, useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useLatestAnalyticsSeriesRequest } from './useLatestAnalyticsSeriesRequest';

it('keeps the latest series when responses arrive out of order, including A to B to A', async () => {
  const pending: Array<(value: string) => void> = [];
  const { result, rerender } = renderHook(({ filter }) => {
    const [data, setData] = useState('');
    const begin = useLatestAnalyticsSeriesRequest(filter);
    const load = useCallback(async () => {
      const isCurrent = begin();
      const response = await new Promise<string>(resolve => pending.push(resolve));
      if (isCurrent()) setData(response);
    }, [begin, filter]);
    useEffect(() => { void load(); }, [load]);
    return data;
  }, { initialProps: { filter: 'A' } });
  rerender({ filter: 'B' });
  rerender({ filter: 'A' });
  await act(async () => pending[2]('latest A'));
  await act(async () => pending[0]('old A'));
  await act(async () => pending[1]('old B'));
  expect(result.current).toBe('latest A');
});

it('invalidates pending responses on unmount and newer retries', () => {
  const hook = renderHook(() => useLatestAnalyticsSeriesRequest('same'));
  const first = hook.result.current();
  const second = hook.result.current();
  expect(first()).toBe(false);
  expect(second()).toBe(true);
  hook.unmount();
  expect(second()).toBe(false);
});
