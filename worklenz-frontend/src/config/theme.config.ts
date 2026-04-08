import { theme } from '@/shared/antd-imports';
import type { ThemeConfig } from 'antd';

export const getThemeConfig = (currentTheme: 'light' | 'dark'): ThemeConfig => ({
  algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    colorBgLayout: currentTheme === 'dark' ? '#141414' : '#f5f5f5',
    colorBgContainer: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
    colorText: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
    colorTextSecondary:
      currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
    colorBorder: currentTheme === 'dark' ? '#424242' : '#d9d9d9',
    colorBorderSecondary: currentTheme === 'dark' ? '#303030' : '#f0f0f0',
    colorFillSecondary:
      currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    colorFillTertiary:
      currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
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
      itemSelectedBg: currentTheme === 'dark' ? 'rgba(24, 144, 255, 0.15)' : '#e6f4ff',
      itemHoverBg: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
      itemSelectedColor: '#1890ff',
      itemColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
      itemMarginBlock: 4,
      itemMarginInline: 8,
      itemPaddingInline: 16,
      itemBorderRadius: 6,
    },
    Card: {
      borderRadiusLG: 8,
      paddingLG: 24,
    },
    Segmented: {
      itemSelectedBg: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
      itemSelectedColor: currentTheme === 'dark' ? '#ffffff' : 'rgba(0, 0, 0, 0.88)',
      itemHoverBg: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
      itemColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)',
      trackBg: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
      trackPadding: 2,
      borderRadius: 6,
      borderRadiusSM: 4,
    },
    Button: {
      borderRadius: 6,
      controlHeight: 36,
    },
    Input: {
      borderRadius: 6,
      controlHeight: 36,
    },
    Select: {
      borderRadius: 6,
      controlHeight: 36,
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
});
