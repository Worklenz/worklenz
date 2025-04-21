type ThemeMode = 'light' | 'dark';

// this utility for toggle any colors with the theme
export const themeWiseColor = (defaultColor: string, darkColor: string, themeMode: ThemeMode) => {
  return themeMode === 'dark' ? darkColor : defaultColor;
};
