import { describe, it, expect, beforeEach, vi } from 'vitest';
import themeReducer, {
  toggleTheme,
  setTheme,
  initializeTheme,
} from '../themeSlice';

describe('themeSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
    delete (window as any).__THEME_STATE__;
  });

  it('should return initial state with default mode and isInitialized false', () => {
    const state = themeReducer(undefined, { type: 'unknown' });
    expect(state).toHaveProperty('mode');
    expect(state.isInitialized).toBe(false);
  });

  it('should toggle theme from light to dark', () => {
    const initialState = { mode: 'light' as const, isInitialized: true };
    const nextState = themeReducer(initialState, toggleTheme());

    expect(nextState.mode).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('should toggle theme from dark to light', () => {
    const initialState = { mode: 'dark' as const, isInitialized: true };
    const nextState = themeReducer(initialState, toggleTheme());

    expect(nextState.mode).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should explicitly set theme to dark or light', () => {
    const initialState = { mode: 'light' as const, isInitialized: true };

    const darkState = themeReducer(initialState, setTheme('dark'));
    expect(darkState.mode).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    const lightState = themeReducer(darkState, setTheme('light'));
    expect(lightState.mode).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('should initialize theme from localStorage when not initialized', () => {
    localStorage.setItem('theme', 'dark');

    const initialState = { mode: 'light' as const, isInitialized: false };
    const nextState = themeReducer(initialState, initializeTheme());

    expect(nextState.isInitialized).toBe(true);
    expect(nextState.mode).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should not re-initialize if already initialized', () => {
    localStorage.setItem('theme', 'dark');

    const initialState = { mode: 'light' as const, isInitialized: true };
    const nextState = themeReducer(initialState, initializeTheme());

    expect(nextState.isInitialized).toBe(true);
    expect(nextState.mode).toBe('light'); // Unchanged because isInitialized is already true
  });
});
