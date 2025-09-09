import { React, Button, notification, theme, Badge } from '@/shared/antd-imports';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { StarOutlined, CloseOutlined, LockOutlined } from '@ant-design/icons';

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
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const isOwnerOrAdmin = useMemo(() => authService.isOwnerOrAdmin(), [authService]);
  
  // Theme-sensitive styling
  const isDark = themeMode === 'dark';
  const purpleColor = '#722ed1'; // Fallback purple color since colorPurple doesn't exist in GlobalToken
  
  const themeStyles = useMemo(() => ({
    // Enhanced opacity for dark mode to improve visibility
    tagBackgroundOpacity: isDark ? '25' : '20',
    tagBorderOpacity: isDark ? '60' : '50',
    shadowOpacity: isDark ? '35' : '25',
    
    // Adjusted glow effects for better visibility in dark mode
    starGlowOpacity: isDark ? '0.7' : '0.5',
    badgeShadowOpacity: isDark ? '0.5' : '0.3',
    
    // Enhanced backdrop blur and shadow for dark mode
    backdropBlur: isDark ? 'blur(12px)' : 'blur(8px)',
    containerShadowOpacity: isDark ? '30' : '20',
    
    // Better border visibility in dark mode
    borderOpacity: isDark ? '60' : '40',
    
    // Enhanced gradient backgrounds for better contrast
    containerBackground: isDark 
      ? `linear-gradient(135deg, #1f1f1f 0%, ${token.colorBgContainer} 50%, #2a2a2a 100%)`
      : `linear-gradient(135deg, ${token.colorBgElevated} 0%, ${token.colorFillQuaternary} 100%)`,
      
    descriptionBackground: isDark
      ? `linear-gradient(135deg, #2a2a2a 0%, #333333 100%)`
      : `linear-gradient(135deg, ${token.colorFillTertiary}20, ${token.colorFillQuaternary}10)`
  }), [isDark, token, purpleColor]);

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
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          fontWeight: 600,
          fontSize: '16px',
          color: token.colorText
        }}>
          <Badge 
            count="NEW" 
            style={{ 
              backgroundColor: '#FFD700',
              color: '#000',
              fontSize: '10px',
              fontWeight: 'bold',
              marginRight: 12,
              boxShadow: `0 2px 4px rgba(255, 215, 0, ${themeStyles.badgeShadowOpacity})`
            }}
          />
          <span style={{ 
            ...(isDark ? {
              // In dark mode, use solid color instead of gradient for better visibility
              color: token.colorPrimary,
              fontWeight: 700,
              fontSize: '18px',
              textShadow: `0 0 8px ${token.colorPrimary}40`
            } : {
              // In light mode, use gradient text
              background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorWarning})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontWeight: 700,
              fontSize: '18px'
            })
          }}>
            Business Plan
          </span>
        </div>
      ),
      description: (
        <div style={{ 
          color: token.colorText,
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          {/* Main description with enhanced styling */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start',
            marginBottom: 12,
            padding: '12px',
            background: themeStyles.descriptionBackground,
            borderRadius: '8px',
            border: `1px solid ${token.colorBorder}${themeStyles.borderOpacity}`
          }}>
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginRight: 12,
              minWidth: '24px'
            }}>
              <StarOutlined style={{ 
                color: token.colorWarning, 
                fontSize: '18px',
                filter: `drop-shadow(0 0 6px rgba(255, 193, 7, ${themeStyles.starGlowOpacity}))`,
                marginBottom: 4
              }} />
              <div style={{
                width: '2px',
                height: '20px',
                background: `linear-gradient(to bottom, ${token.colorWarning}, transparent)`,
                borderRadius: '1px'
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: 600,
                marginBottom: 6,
                color: token.colorText,
                fontSize: '15px'
              }}>
                Unlock powerful features to supercharge your team's productivity
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 12
              }}>
                {/* Advanced Analytics */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: `${token.colorWarning}${themeStyles.tagBackgroundOpacity}`,
                  color: token.colorWarning,
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: `2px solid ${token.colorWarning}${themeStyles.tagBorderOpacity}`,
                  gap: 6,
                  boxShadow: `0 2px 8px ${token.colorWarning}${themeStyles.shadowOpacity}`
                }}>
                  <LockOutlined style={{ fontSize: '12px' }} />
                  Advanced Analytics
                </div>
                
                {/* Reporting */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: `${token.colorError}${themeStyles.tagBackgroundOpacity}`,
                  color: token.colorError,
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: `2px solid ${token.colorError}${themeStyles.tagBorderOpacity}`,
                  gap: 6,
                  boxShadow: `0 2px 8px ${token.colorError}${themeStyles.shadowOpacity}`
                }}>
                  <LockOutlined style={{ fontSize: '12px' }} />
                  Reporting
                </div>
                
                {/* Workload Management */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: `${token.colorSuccess}${themeStyles.tagBackgroundOpacity}`,
                  color: token.colorSuccess,
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: `2px solid ${token.colorSuccess}${themeStyles.tagBorderOpacity}`,
                  gap: 6,
                  boxShadow: `0 2px 8px ${token.colorSuccess}${themeStyles.shadowOpacity}`
                }}>
                  <LockOutlined style={{ fontSize: '12px' }} />
                  Workload
                </div>
                
                {/* Roadmap */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: `${token.colorPrimary}${themeStyles.tagBackgroundOpacity}`,
                  color: token.colorPrimary,
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: `2px solid ${token.colorPrimary}${themeStyles.tagBorderOpacity}`,
                  gap: 6,
                  boxShadow: `0 2px 8px ${token.colorPrimary}${themeStyles.shadowOpacity}`
                }}>
                  <LockOutlined style={{ fontSize: '12px' }} />
                  Roadmap
                </div>
                
                {/* Client Portal */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: `${token.colorInfo}${themeStyles.tagBackgroundOpacity}`,
                  color: token.colorInfo,
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: `2px solid ${token.colorInfo}${themeStyles.tagBorderOpacity}`,
                  gap: 6,
                  boxShadow: `0 2px 8px ${token.colorInfo}${themeStyles.shadowOpacity}`
                }}>
                  <LockOutlined style={{ fontSize: '12px' }} />
                  Client Portal
                </div>
                
                {/* Project Finance */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: `${purpleColor}${themeStyles.tagBackgroundOpacity}`,
                  color: purpleColor,
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: `2px solid ${purpleColor}${themeStyles.tagBorderOpacity}`,
                  gap: 6,
                  boxShadow: `0 2px 8px ${purpleColor}${themeStyles.shadowOpacity}`
                }}>
                  <LockOutlined style={{ fontSize: '12px' }} />
                  Project Finance
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons with enhanced styling */}
          <div style={{ 
            marginTop: 16, 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{
              fontSize: '12px',
              color: token.colorTextTertiary,
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <LockOutlined style={{ fontSize: '10px' }} />
              Unlock all features
            </div>
            <div style={{ 
              display: 'flex',
              gap: 8
            }}>
              <Button 
                type="primary"
                size="small"
                onClick={onLearnMore}
                style={{ 
                  background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryHover})`,
                  border: 'none',
                  fontWeight: 600,
                  boxShadow: `0 4px 12px ${token.colorPrimary}${isDark ? '60' : '40'}`,
                  height: '36px',
                  paddingLeft: '20px',
                  paddingRight: '20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: isDark ? '#fff' : token.colorWhite
                }}
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
                  opacity: 0.8,
                  height: '36px',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              >
                {t('bizPlan.dismiss')}
              </Button>
            </div>
          </div>
        </div>
      ),
      placement: 'bottomRight',
      duration: 15,
      style: {
        background: themeStyles.containerBackground,
        border: `2px solid ${token.colorPrimary}`,
        borderRadius: token.borderRadius,
        boxShadow: `
          0 8px 32px ${token.colorPrimary}${themeStyles.containerShadowOpacity},
          0 4px 16px ${token.colorFillSecondary}40,
          inset 0 1px 0 ${token.colorBgContainer}
        `,
        backdropFilter: themeStyles.backdropBlur,
        maxWidth: '380px',
        minWidth: '320px'
      }
    });
  }, [dispatch, isOwnerOrAdmin, t, token, themeStyles]);

  return null;
};

export default BusinessPlanAnnouncement;


