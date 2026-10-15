import { theme } from '@/shared/antd-imports';
import type { ThemeConfig } from 'antd';

/** Height of buttons, inputs and selects in the client portal; custom controls beside them use it too. */
export const PORTAL_CONTROL_HEIGHT = 36;

export const getThemeConfig = (
  currentTheme: 'light' | 'dark',
  primaryColor?: string | null
): ThemeConfig => {
  // Branding colours surfaces and accents only; the core text colour must stay neutral.
  const coreTextColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)';
  return {
  algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: primaryColor || '#1890ff',
    borderRadius: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    colorBgLayout: currentTheme === 'dark' ? '#141414' : '#f5f5f5',
    colorBgContainer: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
    colorText: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
    colorTextSecondary: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
    colorBorder: currentTheme === 'dark' ? '#424242' : '#d9d9d9',
    colorBorderSecondary: currentTheme === 'dark' ? '#303030' : '#f0f0f0',
    colorFillSecondary: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    colorFillTertiary: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
  },
  components: {
    Layout: {
      siderBg: currentTheme === 'dark' ? '#141414' : '#ffffff',
      headerBg: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
      bodyBg: currentTheme === 'dark' ? '#141414' : '#f5f5f5',
    },
    Menu: {
      colorBgContainer: 'transparent',
      itemBg: 'transparent',
      itemSelectedBg: 'var(--portal-brand-tint)',
      itemHoverBg: 'var(--portal-brand-tint-soft)',
      itemSelectedColor: coreTextColor,
      itemHoverColor: coreTextColor,
      itemColor: coreTextColor,
      itemMarginBlock: 4,
      itemMarginInline: 8,
      itemPaddingInline: 16,
      itemBorderRadius: 6,
    },
    Tabs: {
      itemColor: coreTextColor,
      itemHoverColor: coreTextColor,
      itemActiveColor: coreTextColor,
      itemSelectedColor: coreTextColor,
    },
    Segmented: {
      itemSelectedColor: coreTextColor,
    },
    Card: {
      borderRadiusLG: 8,
      paddingLG: 24,
    },
    Button: {
      borderRadius: 6,
      controlHeight: PORTAL_CONTROL_HEIGHT,
    },
    Input: {
      borderRadius: 6,
      controlHeight: PORTAL_CONTROL_HEIGHT,
    },
    Select: {
      borderRadius: 6,
      controlHeight: PORTAL_CONTROL_HEIGHT,
      optionSelectedColor: coreTextColor,
    },
    Table: {
      borderRadius: 8,
      headerBg: currentTheme === 'dark' ? '#1f1f1f' : '#fafafa',
    },
    Statistic: {
      contentFontSize: 28,
    },
    Typography: {
      titleMarginBottom: 0,
      titleMarginTop: 0,
    },
  },
  };
};
