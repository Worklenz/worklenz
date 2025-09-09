import { React, Button, notification, theme } from '@/shared/antd-imports';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { StarOutlined, RocketOutlined, CloseOutlined } from '@ant-design/icons';

const STORAGE_KEY = 'wlz_bizplan_announce_seen_v1';
const SNOOZE_KEY = 'wlz_bizplan_announce_snooze_until_v1';
const END_DATE = new Date('2025-09-20T23:59:59Z').getTime(); // 2 weeks from now

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
  const { token } = theme.useToken();

  const isOwnerOrAdmin = useMemo(() => authService.isOwnerOrAdmin(), [authService]);

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    if (getHasSeen()) return;
    
    // Don't show notification after end date
    if (Date.now() > END_DATE) return;

    const snoozeUntil = getSnoozeUntil();
    if (snoozeUntil && Date.now() < snoozeUntil) return;

    const key = 'bizplan_announcement';

    const onLearnMore = () => {
      markSeen();
      notification.destroy(key);
      dispatch(toggleUpgradeModal());
    };

    const onDismiss = () => {
      // When dismissed, set snooze for 2 days (remind me later functionality)
      setSnoozeForDays(2);
      notification.destroy(key);
    };

    notification.open({
      key,
      message: (
        <span style={{ color: token.colorText }}>
          <RocketOutlined style={{ color: token.colorPrimary, marginRight: 8 }} /> 
          {t('bizPlan.title')}
        </span>
      ),
      description: (
        <div style={{ color: token.colorTextSecondary }}>
          <StarOutlined style={{ color: token.colorWarning, marginRight: 8 }} /> 
          {t('bizPlan.desc')}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Button 
              type="primary"
              size="small"
              onClick={onLearnMore}
              style={{ marginRight: 8 }}
            >
              {t('bizPlan.learnMore')}
            </Button>
            <Button 
              type="text"
              size="small"
              onClick={onDismiss}
              icon={<CloseOutlined />}
              style={{ 
                color: token.colorTextSecondary,
                opacity: 1 
              }}
            >
              {t('bizPlan.dismiss')}
            </Button>
          </div>
        </div>
      ),
      placement: 'bottomRight',
      duration: 12,
      style: {
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorder}`,
      }
    });
  }, [dispatch, isOwnerOrAdmin, t, token]);

  return null;
};

export default BusinessPlanAnnouncement;


