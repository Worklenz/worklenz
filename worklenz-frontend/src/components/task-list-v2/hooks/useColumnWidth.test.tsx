import { StrictMode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useColumnWidth } from './useColumnWidth';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('style');
  vi.restoreAllMocks();
});

describe('shared column widths', () => {
  it('retains non-pixel width support without measuring each row', () => {
    document.documentElement.style.setProperty('--col-width-labels', '20rem');
    const measure = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320);
    const { result } = renderHook(() => [useColumnWidth('labels'), useColumnWidth('labels')]);
    expect(result.current).toEqual([320, 320]);
    expect(measure).toHaveBeenCalledTimes(1);
  });
  it('does not observe or measure empty label cells and activates when labels arrive', () => {
    document.documentElement.style.setProperty('--col-width-labels', '210px');
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const computedStyle = vi.spyOn(window, 'getComputedStyle');
    const { result, rerender } = renderHook(({ enabled }) => useColumnWidth('labels', enabled), {
      initialProps: { enabled: false },
    });
    expect(observe).not.toHaveBeenCalled();
    expect(computedStyle).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(result.current).toBe(210);
    expect(observe).toHaveBeenCalledTimes(1);
  });
  it('shares an observer and avoids computed styles for inline pixel widths', async () => {
    document.documentElement.style.setProperty('--col-width-labels', '180px');
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const computedStyle = vi.spyOn(window, 'getComputedStyle');
    const { result, unmount } = renderHook(() => [
      useColumnWidth('labels'),
      useColumnWidth('labels'),
    ]);
    expect(result.current).toEqual([180, 180]);
    expect(observe).toHaveBeenCalledTimes(1);
    const widthObserver = observe.mock.contexts[0];

    act(() => document.documentElement.style.setProperty('--col-width-labels', '240px'));
    await waitFor(() => expect(result.current).toEqual([240, 240]));
    expect(computedStyle).not.toHaveBeenCalled();
    unmount();
    // waitFor also creates its own observer; count only the shared width observer.
    expect(disconnect.mock.contexts.filter(instance => instance === widthObserver)).toHaveLength(1);
  });

  it('keeps other columns unchanged and follows a changed column id', async () => {
    document.documentElement.style.setProperty('--col-width-labels', '180px');
    document.documentElement.style.setProperty('--col-width-phase', '120px');
    const { result, rerender } = renderHook(({ columnId }) => useColumnWidth(columnId), {
      initialProps: { columnId: 'labels' },
    });
    act(() => document.documentElement.style.setProperty('--col-width-phase', '250px'));
    expect(result.current).toBe(180);
    rerender({ columnId: 'phase' });
    expect(result.current).toBe(250);
    act(() => document.documentElement.style.setProperty('--col-width-phase', '310.5px'));
    await waitFor(() => expect(result.current).toBe(310.5));
  });

  it('works through Strict Mode cleanup and remounts with a fresh width', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    document.documentElement.style.setProperty('--col-width-labels', '180px');
    const first = renderHook(() => useColumnWidth('labels'), { wrapper });
    expect(first.result.current).toBe(180);
    first.unmount();
    document.documentElement.style.setProperty('--col-width-labels', '290px');
    const second = renderHook(() => useColumnWidth('labels'), { wrapper });
    expect(second.result.current).toBe(290);
  });
});
