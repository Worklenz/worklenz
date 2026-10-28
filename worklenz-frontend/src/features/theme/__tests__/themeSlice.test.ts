import { describe, it, expect, beforeEach, vi } from 'vitest';
import themeReducer, {
  toggleTheme,
  setTheme,
  initializeTheme,
  applyThemeToDocument,
  toggleThemeWithTransition,
  themeDomSyncMiddleware,
} from '../themeSlice';

describe('themeSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
    delete (window as any).__THEME_STATE__;
    delete (document as any).startViewTransition;
  });

  it('should return initial state with default mode and isInitialized false', () => {
    const state = themeReducer(undefined, { type: 'unknown' });
    expect(state).toHaveProperty('mode');
    expect(state.isInitialized).toBe(false);
  });

  it('should toggle theme from light to dark (pure reducer)', () => {
    const initialState = { mode: 'light' as const, isInitialized: true };
    const nextState = themeReducer(initialState, toggleTheme());

    expect(nextState.mode).toBe('dark');
    // Reducers must stay pure - DOM/localStorage sync belongs to the middleware.
    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should toggle theme from dark to light (pure reducer)', () => {
    const initialState = { mode: 'dark' as const, isInitialized: true };
    const nextState = themeReducer(initialState, toggleTheme());

    expect(nextState.mode).toBe('light');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('should explicitly set theme to dark or light', () => {
    const initialState = { mode: 'light' as const, isInitialized: true };

    const darkState = themeReducer(initialState, setTheme('dark'));
    expect(darkState.mode).toBe('dark');

    const lightState = themeReducer(darkState, setTheme('light'));
    expect(lightState.mode).toBe('light');
  });

  it('should initialize theme from localStorage when not initialized', () => {
    localStorage.setItem('theme', 'dark');

    const initialState = { mode: 'light' as const, isInitialized: false };
    const nextState = themeReducer(initialState, initializeTheme());

    expect(nextState.isInitialized).toBe(true);
    expect(nextState.mode).toBe('dark');
  });

  it('should not re-initialize if already initialized', () => {
    localStorage.setItem('theme', 'dark');

    const initialState = { mode: 'light' as const, isInitialized: true };
    const nextState = themeReducer(initialState, initializeTheme());

    expect(nextState.isInitialized).toBe(true);
    expect(nextState.mode).toBe('light'); // Unchanged because isInitialized is already true
  });

  it('should synchronously apply classes and data-theme attributes to documentElement and body', () => {
    applyThemeToDocument('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.body.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.body.classList.contains('light')).toBe(false);
    expect((window as any).__THEME_STATE__).toBe('dark');

    applyThemeToDocument('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.body.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.body.classList.contains('light')).toBe(true);
    expect((window as any).__THEME_STATE__).toBe('light');
  });

  it('should sync DOM and localStorage through the theme middleware', () => {
    const state = { mode: 'dark' as const, isInitialized: true };
    const store = { getState: () => ({ themeReducer: state }) };
    const next = vi.fn((a: unknown) => a);

    themeDomSyncMiddleware(store as any)(next)(toggleTheme());

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should sync DOM through the middleware when the theme initializes', () => {
    localStorage.setItem('theme', 'dark');
    const state = { mode: 'dark' as const, isInitialized: true };
    const store = { getState: () => ({ themeReducer: state }) };
    const next = vi.fn((a: unknown) => a);

    themeDomSyncMiddleware(store as any)(next)(initializeTheme());

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should cross-fade via startViewTransition while freezing CSS transitions during capture', async () => {
    const dispatchMock = vi.fn();
    let resolveFinished!: () => void;
    const finished = new Promise<void>(resolve => {
      resolveFinished = resolve;
    });
    const startViewTransitionMock = vi.fn((cb: () => void) => {
      cb();
      return { finished };
    });
    (document as any).startViewTransition = startViewTransitionMock;

    toggleThemeWithTransition(dispatchMock);

    expect(startViewTransitionMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('theme-switching')).toBe(true);

    resolveFinished();
    await finished;

    expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
  });

  it('should fallback to direct dispatch when startViewTransition is unavailable', () => {
    const dispatchMock = vi.fn();

    toggleThemeWithTransition(dispatchMock);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
  });

  it('should switch instantly without view transition for reduced-motion users', () => {
    vi.useFakeTimers();
    try {
      const dispatchMock = vi.fn();
      const startViewTransitionMock = vi.fn();
      (document as any).startViewTransition = startViewTransitionMock;
      window.matchMedia = ((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as any;

      toggleThemeWithTransition(dispatchMock);

      expect(startViewTransitionMock).not.toHaveBeenCalled();
      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(document.documentElement.classList.contains('theme-switching')).toBe(true);

      vi.advanceTimersByTime(300);
      expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
