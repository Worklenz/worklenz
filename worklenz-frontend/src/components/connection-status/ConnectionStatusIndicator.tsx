import { useEffect, useState } from 'react';
import { useSocket } from '@/socket/socketContext';
import { Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

export const ConnectionStatusIndicator = () => {
  const { connected } = useSocket();
  const { t } = useTranslation('common');

  const [shouldShowOffline, setShouldShowOffline] = useState<boolean>(false);

  // Add a grace period before showing offline status to avoid flashes on refresh/reconnect
  useEffect(() => {
    // If reconnected, hide immediately and clear any pending timers
    if (connected) {
      setShouldShowOffline(false);
      return;
    }

    // When disconnected, wait for a delay before showing the offline indicator
    const timeoutId = window.setTimeout(() => {
      setShouldShowOffline(true);
    }, 10_000); // 10 seconds

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [connected]);

  // Only show indicator when disconnected AND the grace period has passed
  if (connected || !shouldShowOffline) return null;

  return (
    <Tooltip title={t('disconnected')} placement="bottom">
      <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-default">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          {t('offline', { defaultValue: 'Offline' })}
        </span>
      </div>
    </Tooltip>
  );
};
