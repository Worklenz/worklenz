import React from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getUserSession } from '@/utils/session-helper';
import { getLanguageFromLocalStorage } from '@/utils/language-utils';
import { formatDate } from '@/utils/dateUtils';
import { useAppSelector } from '@/hooks/useAppSelector';
import { theme } from '@/shared/antd-imports';

const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' => {
  const h = dayjs().hour();
  if (h < 12) return 'morning';
  if (h < 16) return 'afternoon';
  return 'evening';
};

const TIME_META = {
  morning: {
    icon: '☀️',
    lightBg:   'linear-gradient(135deg, rgba(255,200,60,.13) 0%, rgba(255,140,0,.07) 100%)',
    lightBorder: 'rgba(255,180,40,.2)',
    darkBg:    'linear-gradient(135deg, rgba(255,200,60,.08) 0%, rgba(255,140,0,.04) 100%)',
    darkBorder: 'rgba(255,180,40,.12)',
  },
  afternoon: {
    icon: '🌤️',
    lightBg:   'linear-gradient(135deg, rgba(22,119,255,.09) 0%, rgba(82,196,26,.05) 100%)',
    lightBorder: 'rgba(22,119,255,.16)',
    darkBg:    'linear-gradient(135deg, rgba(22,119,255,.12) 0%, rgba(82,196,26,.06) 100%)',
    darkBorder: 'rgba(22,119,255,.2)',
  },
  evening: {
    icon: '🌅',
    lightBg:   'linear-gradient(135deg, rgba(255,100,50,.11) 0%, rgba(180,60,220,.07) 100%)',
    lightBorder: 'rgba(220,80,60,.18)',
    darkBg:    'linear-gradient(135deg, rgba(255,100,50,.1) 0%, rgba(180,60,220,.06) 100%)',
    darkBorder: 'rgba(220,80,60,.15)',
  },
};

const getGreetingLabel = (tod: 'morning' | 'afternoon' | 'evening'): string => {
  const lang = getLanguageFromLocalStorage();
  const map: Record<string, Record<string, string>> = {
    en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    es: { morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches' },
    pt: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' },
    de: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend' },
    zh_cn: { morning: '早上好', afternoon: '下午好', evening: '晚上好' },
  };
  return (map[lang] || map.en)[tod] || map.en[tod];
};

const GreetingWithTime: React.FC = () => {
  const userDetails = getUserSession();
  const firstName   = userDetails?.name?.split(' ')[0] || '';
  const tod         = getTimeOfDay();
  const meta        = TIME_META[tod];
  const label       = getGreetingLabel(tod);
  const themeMode   = useAppSelector(state => state.themeReducer.mode);
  const isDark      = themeMode === 'dark';
  const { token }   = theme.useToken();
  const { t }       = useTranslation('home');

  const dateStr = formatDate(dayjs(), 'dddd, MMMM D, YYYY');

  return (
    <div
      style={{
        padding: '12px 18px',
        borderRadius: 12,
        background: isDark ? meta.darkBg   : meta.lightBg,
        border:     `1px solid ${isDark ? meta.darkBorder : meta.lightBorder}`,
        flex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
        <div>
          <div style={{
            fontSize: 11,
            color: token.colorTextSecondary,
            marginBottom: 2,
            letterSpacing: 0.2,
          }}>
            {dateStr}
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.3,
            margin: '0 0 2px',
            color: token.colorText,
          }}>
            {label}, {firstName}
          </div>
          <div style={{
            fontSize: 12,
            color: token.colorTextSecondary,
          }}>
             {t('greeting.attentionToday', { defaultValue: 'Here is what needs your attention today.' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GreetingWithTime;
