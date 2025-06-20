import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ThemeType = 'light' | 'dark';

interface ThemeState {
  mode: ThemeType;
  isInitialized: boolean;
}

const isBrowser = typeof window !== 'undefined';

const getPreloadedTheme = (): ThemeType =>
  !isBrowser ? 'light' : (window as any).__THEME_STATE__ || 'light';

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

const updateDocumentTheme = (themeMode: ThemeType): void => {
  if (!isBrowser) return;

  const root = document.documentElement;
  const oppositeTheme = themeMode === 'dark' ? 'light' : 'dark';
  const themeColor = themeMode === 'dark' ? '#181818' : '#ffffff';

  [root, document.body].forEach(element => {
    element.classList.remove(oppositeTheme);
    element.classList.add(themeMode);
  });

  root.style.colorScheme = themeMode;

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);

  (window as any).__THEME_STATE__ = themeMode;
};

const saveThemeModeToLocalStorage = (themeMode: ThemeType): void => {
  if (!isBrowser) return;
  try {
    localStorage.setItem('theme', themeMode);
    updateDocumentTheme(themeMode);
  } catch (error) {
    console.error('Failed to save theme to localStorage:', error);
  }
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
      saveThemeModeToLocalStorage(state.mode);
    },
    setTheme: (state: ThemeState, action: PayloadAction<ThemeType>) => {
      state.mode = action.payload;
      saveThemeModeToLocalStorage(state.mode);
    },
    initializeTheme: (state: ThemeState) => {
      if (!state.isInitialized) {
        state.mode = getThemeModeFromLocalStorage();
        state.isInitialized = true;
        updateDocumentTheme(state.mode);
      }
    },
  },
});

export const { toggleTheme, setTheme, initializeTheme } = themeSlice.actions;
export default themeSlice.reducer;
