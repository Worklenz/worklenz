import { ConfigProvider, theme } from 'antd';
import React, { useEffect, useRef } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { initializeTheme } from './themeSlice';
import { colors } from '../../styles/colors';

type ChildrenProp = {
  children: React.ReactNode;
};

const ThemeWrapper = ({ children }: ChildrenProp) => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isInitialized = useAppSelector(state => state.themeReducer.isInitialized);
  const configRef = useRef<HTMLDivElement>(null);

  // Initialize theme after mount
  useEffect(() => {
    if (!isInitialized) {
      dispatch(initializeTheme());
    }
  }, [dispatch, isInitialized]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        dispatch(initializeTheme());
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [dispatch]);

  // Add CSS transition classes to prevent flash
  useEffect(() => {
    if (configRef.current) {
      configRef.current.style.transition = 'background-color 0.3s ease';
    }
  }, []);

  return (
    <div ref={configRef} className={`theme-${themeMode}`}>
      <ConfigProvider
        theme={{
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
        }}
      >
        {children}
      </ConfigProvider>
    </div>
  );
};

export default ThemeWrapper;
