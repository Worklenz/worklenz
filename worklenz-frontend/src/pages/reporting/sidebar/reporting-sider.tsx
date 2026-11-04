import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import NavRail from '@/components/nav-rail/NavRail';
import { useNavPreferences } from '@/features/navigation/useNavPreferences';
import type { NavItem } from '@/features/navigation/nav-registry.types';
import { ReportingModePaddle } from '@/components/reporting/ReportingModePaddle';

const ReportingSider = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('reporting-sidebar');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';

  const { resolved, pin, unpin, isPinned, reorder, toggleCollapsed } = useNavPreferences('reporting');

  const activeKey = useMemo(() => {
    const afterWorklenzString = location.pathname?.split('/worklenz/reporting/')[1];
    return afterWorklenzString?.split('/')[0];
  }, [location.pathname]);

  const renderLabel = useCallback(
    (item: NavItem) => {
      if (typeof item.label === 'string') return item.label;
      return t(item.label.i18nKey, { defaultValue: item.label.defaultValue });
    },
    [t]
  );

  const renderGroupLabel = useCallback(
    (label: NavItem['label']) => {
      if (typeof label === 'string') return label;
      return t(label.i18nKey, { defaultValue: label.defaultValue });
    },
    [t]
  );

  const handleSelect = useCallback(
    (itemKey: string) => navigate(`/worklenz/reporting/${itemKey}`),
    [navigate]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ paddingTop: 12 }}>
        <ReportingModePaddle mode="classic" density="narrow" />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NavRail
          resolved={resolved}
          activeKey={activeKey || ''}
          isDark={isDark}
          onSelect={handleSelect}
          isPinned={isPinned}
          onPin={pin}
          onUnpin={unpin}
          onReorder={reorder}
          onToggleCollapse={toggleCollapsed}
          renderLabel={renderLabel}
          renderGroupLabel={renderGroupLabel}
        />
      </div>
    </div>
  );
};

export default ReportingSider;
