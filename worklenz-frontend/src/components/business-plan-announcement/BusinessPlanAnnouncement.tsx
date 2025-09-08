import { React, Button, notification, ConfigProvider } from '@/shared/antd-imports';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';

const STORAGE_KEY = 'wlz_bizplan_announce_seen_v1';
const SNOOZE_KEY = 'wlz_bizplan_announce_snooze_until_v1';

const getHasSeen = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
};

const markSeen = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch (_) {}
};

const getSnoozeUntil = (): number | null => {
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch (_) {
    return null;
  }
};

const setSnoozeForDays = (days: number): void => {
  try {
    const now = Date.now();
    const until = now + days * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(SNOOZE_KEY, String(until));
  } catch (_) {}
};

export const BusinessPlanAnnouncement = () => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const isOwnerOrAdmin = useMemo(() => authService.isOwnerOrAdmin(), [authService]);

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    if (getHasSeen()) return;

    const snoozeUntil = getSnoozeUntil();
    if (snoozeUntil && Date.now() < snoozeUntil) return;

    const key = 'bizplan_announcement';

    const onLearnMore = () => {
      markSeen();
      notification.destroy(key);
      dispatch(toggleUpgradeModal());
    };

    const onDismiss = () => {
      markSeen();
      notification.destroy(key);
    };

    const onRemindTomorrow = () => {
      setSnoozeForDays(1);
      notification.destroy(key);
    };

    notification.open({
      key,
      message: t('bizPlan.title'),
      description: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{t('bizPlan.desc')}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button type="link" size="small" onClick={onLearnMore}>
              {t('bizPlan.learnMore')}
            </Button>
            <Button size="small" onClick={onRemindTomorrow}>
              {t('bizPlan.remindLater')}
            </Button>
            <Button size="small" onClick={onDismiss}>
              {t('bizPlan.dismiss')}
            </Button>
          </div>
        </div>
      ),
      placement: 'bottomRight',
      duration: 8,
      role: 'status',
      style: {
        marginRight: 16,
        marginBottom: 16,
        maxWidth: 480,
        background: themeMode === 'dark' ? colors.darkGray : '#fff',
        color: themeMode === 'dark' ? '#f0f0f0' : '#000',
        border: 'none',
        borderRadius: 12,
        boxShadow:
          themeMode === 'dark'
            ? '0 8px 24px rgba(0,0,0,0.45)'
            : '0 8px 24px rgba(0,0,0,0.12)',
        padding: 12,
      },
    });
  }, [dispatch, isOwnerOrAdmin, t, themeMode]);

  return null;
};

export default BusinessPlanAnnouncement;


