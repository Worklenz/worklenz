import { useSocket } from '@/socket/socketContext';
import { Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

export const ConnectionStatusIndicator = () => {
  const { connected } = useSocket();
  const { t } = useTranslation('common');

  // Only show indicator when disconnected
  if (connected) return null;

  return (
    <Tooltip title={t('disconnected')} placement="bottom">
      <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-default">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          {t('offline')}
        </span>
      </div>
    </Tooltip>
  );
};
