import { ConfigProvider } from '@/shared/antd-imports';
import React, { useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { initializeTheme } from './themeSlice';
import { getThemeConfig } from '@/config/theme.config';

// Import dayjs locales
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import 'dayjs/locale/pt';
import 'dayjs/locale/sq';
import 'dayjs/locale/de';
import 'dayjs/locale/zh-cn';

// Import Ant Design locales
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import ptPT from 'antd/locale/pt_PT';
import deDE from 'antd/locale/de_DE';
import zhCN from 'antd/locale/zh_CN';

type ChildrenProp = {
  children: React.ReactNode;
};

const ThemeWrapper = memo(({ children }: ChildrenProp) => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const language = useAppSelector(state => state.localesReducer.lng);
  const isInitialized = useAppSelector(state => state.themeReducer.isInitialized);
  const configRef = useRef<HTMLDivElement>(null);

  // Language mapping for dayjs
  const DAYJS_LOCALE_MAP: Record<string, string> = {
    en: 'en',
    es: 'es',
    pt: 'pt',
    alb: 'sq',
    de: 'de',
    zh_cn: 'zh-cn',
  };

  // Language mapping for Ant Design
  const ANT_LOCALE_MAP: Record<string, any> = {
    en: enUS,
    es: esES,
    pt: ptPT,
    alb: enUS, // Albanian not available in Ant Design
    de: deDE,
    zh_cn: zhCN,
  };

  // Memoize theme configuration to prevent unnecessary re-renders
  const themeConfig = useMemo(() => getThemeConfig(themeMode), [themeMode]);

  // Memoize Ant Design locale
  const antLocale = useMemo(() => ANT_LOCALE_MAP[language] || enUS, [language]);

  // Set dayjs locale whenever language changes
  useEffect(() => {
    const dayjsLocale = DAYJS_LOCALE_MAP[language] || 'en';
    dayjs.locale(dayjsLocale);
  }, [language]);

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
      <ConfigProvider theme={themeConfig} locale={antLocale}>
        {children}
      </ConfigProvider>
    </div>
  );
});

ThemeWrapper.displayName = 'ThemeWrapper';

export default ThemeWrapper;
