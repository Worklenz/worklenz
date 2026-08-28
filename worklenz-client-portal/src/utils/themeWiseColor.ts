export const themeWiseColor = (
  lightColor: string,
  darkColor: string,
  themeMode: 'light' | 'dark'
): string => {
  return themeMode === 'light' ? lightColor : darkColor;
};