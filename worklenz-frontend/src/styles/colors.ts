// colors.ts
// PPM-OVERRIDE: Updated brand colors — primary blue #0061FF, dark #171719
export const colors = {
  white: '#fff',
  darkGray: '#171719',
  lightGray: '#707070',
  deepLightGray: '#d1d0d3',
  lightBeige: '#fde8b5',
  skyBlue: '#0061FF',
  midBlue: '#b9cef1',
  paleBlue: '#e6f7ff',
  vibrantOrange: '#f56a00',
  limeGreen: '#52c41a',
  lightGreen: '#c2e4d0',
  yellow: '#f8d914',
  transparent: 'transparent',
};

export const applyCssVariables = () => {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
};
