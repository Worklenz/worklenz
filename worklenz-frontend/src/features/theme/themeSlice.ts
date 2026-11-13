import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';
import { flushSync } from 'react-dom';

type ThemeType = 'light' | 'dark';

interface ThemeState {
  mode: ThemeType;
  isInitialized: boolean;
}

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const getPreloadedTheme = (): ThemeType => {
  if (!isBrowser) return 'light';
  const storedTheme = (window as any).__THEME_STATE__;
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  return getThemeModeFromLocalStorage();
};

const getSystemTheme = (): ThemeType =>
  !isBrowser
    ? 'light'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

const getThemeModeFromLocalStorage = (): ThemeType => {
  if (!isBrowser) return 'light';
  try {
    return (localStorage.getItem('theme') as ThemeType) || getSystemTheme();
  } catch {
    return 'light';
  }
};

/**
 * Applies the theme to the DOM synchronously: `light`/`dark` classes and the
 * `data-theme` attribute on both <html> and <body>, plus `color-scheme` and
 * the theme-color meta tag. Everything lands in one style recalc so CSS rules
 * keyed off `.dark` (Tailwind) and `[data-theme]` switch at the same instant.
 */
export const applyThemeToDocument = (themeMode: ThemeType): void => {
  if (!isBrowser) return;

  const root = document.documentElement;
  const oppositeTheme = themeMode === 'dark' ? 'light' : 'dark';
  const themeColor = themeMode === 'dark' ? '#181818' : '#ffffff';

  [root, document.body].forEach(element => {
    element.classList.remove(oppositeTheme);
    element.classList.add(themeMode);
    element.setAttribute('data-theme', themeMode);
  });

  root.style.colorScheme = themeMode;

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);

  (window as any).__THEME_STATE__ = themeMode;
};

const persistThemeMode = (themeMode: ThemeType): void => {
  try {
    localStorage.setItem('theme', themeMode);
  } catch (error) {
    console.error('Failed to save theme to localStorage:', error);
  }
  applyThemeToDocument(themeMode);
};

const initialState: ThemeState = {
  mode: getPreloadedTheme(),
  isInitialized: false,
};

const themeSlice = createSlice({
  name: 'themeReducer',
  initialState,
  reducers: {
    toggleTheme: (state: ThemeState) => {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
    },
    setTheme: (state: ThemeState, action: PayloadAction<ThemeType>) => {
      state.mode = action.payload;
    },
    initializeTheme: (state: ThemeState) => {
      if (!state.isInitialized) {
        state.mode = getThemeModeFromLocalStorage();
        state.isInitialized = true;
      }
    },
  },
});

export const { toggleTheme, setTheme, initializeTheme } = themeSlice.actions;

/**
 * Keeps the DOM (html/body classes, data-theme, color-scheme) and
 * localStorage in sync with the store. Runs synchronously inside dispatch,
 * so the class flip lands in the same frame as the React commit — including
 * inside document.startViewTransition() update callbacks.
 */
export const themeDomSyncMiddleware: Middleware = store => next => action => {
  const result = next(action);

  if (
    toggleTheme.match(action) ||
    setTheme.match(action) ||
    initializeTheme.match(action)
  ) {
    const mode = (store.getState() as { themeReducer?: ThemeState }).themeReducer?.mode;
    if (mode === 'light' || mode === 'dark') {
      persistThemeMode(mode);
    }
  }

  return result;
};

/** Class applied while a view transition is animating. */
const THEME_SWITCHING_CLASS = 'theme-switching';

let themeTransitionCounter = 0;

const supportsViewTransitions = (): boolean =>
  typeof (document as any).startViewTransition === 'function';

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Executes a theme toggle with the View Transitions API when supported.
 *
 * Two things keep the cross-fade artifact-free:
 * 1. flushSync commits the entire React tree (including Ant Design's
 *    re-computed styles) before the "new" snapshot is captured.
 * 2. The `theme-switching` class freezes element-level CSS transitions
 *    during the capture, so the snapshot already shows final colors and the
 *    live DOM does not "pop" when the transition finishes.
 *
 * Browsers without the API fall back to a plain dispatch, where the CSS
 * variable-driven surfaces morph together over 200ms.
 */
export const toggleThemeWithTransition = (dispatch: (action: any) => void): void => {
  if (!isBrowser || !supportsViewTransitions()) {
    dispatch(toggleTheme());
    return;
  }

  const root = document.documentElement;

  if (prefersReducedMotion()) {
    // Skip the animation entirely: freeze transitions while the class flip
    // commits, then unfreeze shortly after. The colors change instantly.
    root.classList.add(THEME_SWITCHING_CLASS);
    dispatch(toggleTheme());
    window.setTimeout(() => root.classList.remove(THEME_SWITCHING_CLASS), 300);
    return;
  }

  root.classList.add(THEME_SWITCHING_CLASS);
  const transitionId = ++themeTransitionCounter;
  const removeSwitchingClass = () => {
    // Only the most recent toggle may unfreeze transitions; a rapid second
    // toggle is still capturing and would otherwise capture mid-transition.
    if (themeTransitionCounter === transitionId) {
      root.classList.remove(THEME_SWITCHING_CLASS);
    }
  };

  try {
    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        dispatch(toggleTheme());
      });
    });

    if (transition && typeof transition.finished?.then === 'function') {
      transition.finished.then(removeSwitchingClass, removeSwitchingClass);
    } else {
      // Defensive fallback for non-conforming implementations.
      window.setTimeout(removeSwitchingClass, 300);
    }
  } catch (error) {
    // Never leave the page stuck with frozen transitions.
    removeSwitchingClass();
    dispatch(toggleTheme());
  }
};

export default themeSlice.reducer;
