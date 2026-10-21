import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canWriteDocsSearch, useDocsSearchReplace } from './docs-search-guard';

const life = {
  disposed: false,
  pathname: '/worklenz/projects/docs',
  requiresDocsTab: false,
};

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('canWriteDocsSearch', () => {
  it('allows a replace while the docs page is still current', () => {
    window.history.pushState({}, '', '/worklenz/projects/docs?doc=page');
    expect(canWriteDocsSearch({ ...life, pathname: '/worklenz/projects/docs' })).toBe(true);
  });

  it('ignores a replace after unmount', () => {
    window.history.pushState({}, '', '/worklenz/projects/docs');
    expect(canWriteDocsSearch({ ...life, pathname: '/worklenz/projects/docs', disposed: true })).toBe(false);
  });

  it('ignores a replace after the pathname leaves the page', () => {
    window.history.pushState({}, '', '/worklenz/projects/all-projects');
    expect(canWriteDocsSearch({ ...life, pathname: '/worklenz/projects/docs' })).toBe(false);
  });

  it('ignores a replace after the project docs tab changes', () => {
    window.history.pushState({}, '', '/worklenz/projects/project?tab=tasks-list');
    expect(
      canWriteDocsSearch({
        disposed: false,
        pathname: '/worklenz/projects/project',
        requiresDocsTab: true,
      })
    ).toBe(false);
  });
});

describe('useDocsSearchReplace', () => {
  it('keeps the replace callback stable when setSearchParams changes', () => {
    window.history.pushState({}, '', '/worklenz/projects/docs');
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ setSearchParams }) => useDocsSearchReplace(setSearchParams),
      { initialProps: { setSearchParams: first } }
    );
    const stable = result.current;

    rerender({ setSearchParams: second });

    expect(result.current).toBe(stable);
    const next = new URLSearchParams('doc=page');
    result.current(next);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(next, { replace: true });
  });
});
