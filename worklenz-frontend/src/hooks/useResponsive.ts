import { useDebouncedMediaQuery } from './useDebouncedMediaQuery';

export const useResponsive = () => {
  // Use debounced media queries to prevent rapid re-renders during window resize
  // This helps prevent errors when components re-render too quickly
  const isMobile = useDebouncedMediaQuery({ query: '(max-width: 576px)' });
  const isTablet = useDebouncedMediaQuery({ query: '(min-width: 576px)' });
  const isDesktop = useDebouncedMediaQuery({ query: '(min-width: 1024px)' });

  return { isMobile, isTablet, isDesktop };
};
