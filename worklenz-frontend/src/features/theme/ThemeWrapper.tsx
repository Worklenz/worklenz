import { ConfigProvider, theme } from '@/shared/antd-imports';
import React, { useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { initializeTheme } from './themeSlice';
import { colors } from '../../styles/colors';

type ChildrenProp = {
  children: React.ReactNode;
};

const ThemeWrapper = memo(({ children }: ChildrenProp) => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isInitialized = useAppSelector(state => state.themeReducer.isInitialized);
  const configRef = useRef<HTMLDivElement>(null);

  // Memoize theme configuration to prevent unnecessary re-renders
  const themeConfig = useMemo(
    () => ({
      algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      components: {
        Layout: {
          colorBgLayout: themeMode === 'dark' ? colors.darkGray : colors.white,
          headerBg: themeMode === 'dark' ? colors.darkGray : colors.white,
        },
        Menu: {
          colorBgContainer: colors.transparent,
        },
        Table: {
          rowHoverBg: themeMode === 'dark' ? '#000' : '#edebf0',
        },
        Select: {
          controlHeight: 32,
        },
      },
      token: {
        borderRadius: 4,
      },
    }),
    [themeMode]
  );

  // Memoize the theme class name
  const themeClassName = useMemo(() => `theme-${themeMode}`, [themeMode]);

  // Memoize the media query change handler
  const handleMediaQueryChange = useCallback(
    (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        dispatch(initializeTheme());
      }
    },
    [dispatch]
  );

  // Initialize theme after mount
  useEffect(() => {
    if (!isInitialized) {
      dispatch(initializeTheme());
    }
  }, [dispatch, isInitialized]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    mediaQuery.addEventListener('change', handleMediaQueryChange);
    return () => mediaQuery.removeEventListener('change', handleMediaQueryChange);
  }, [handleMediaQueryChange]);

  // Add CSS transition classes to prevent flash
  useEffect(() => {
    if (configRef.current) {
      configRef.current.style.transition = 'background-color 0.3s ease';
    }
  }, []);

  return (
    <div ref={configRef} className={themeClassName}>
      <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>
    </div>
  );
});

ThemeWrapper.displayName = 'ThemeWrapper';

export default ThemeWrapper;
