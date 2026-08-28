import { theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';

const { useToken } = theme;

// antd's default Tooltip renders a dark chip regardless of app theme, which reads as a
// mismatched box against light-mode chrome — same fix as NavRailItem/PlannerLeftSidebar
// use, shared here so every surface (including the top navbar) matches.
export const useTooltipTheme = () => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { token } = useToken();
  const isDark = themeMode === 'dark';

  const tooltipProps = {
    color: isDark ? undefined : '#fff',
    styles: isDark
      ? undefined
      : { body: { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' } },
  };

  return { tooltipProps, isDark, token };
};
