import { useMediaQuery } from 'react-responsive';

export const useResponsive = () => {
  // media queries from react-responsive package
  const isMobile = useMediaQuery({ query: '(max-width: 576px)' });
  const isTablet = useMediaQuery({ query: '(min-width: 576px)' });
  const isDesktop = useMediaQuery({ query: '(min-width: 1024px)' });

  return { isMobile, isTablet, isDesktop };
};
