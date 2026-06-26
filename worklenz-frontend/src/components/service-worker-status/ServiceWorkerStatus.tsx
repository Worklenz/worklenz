// Service Worker Status Component
// Shows offline status and provides cache management controls

import React from 'react';
import { Badge, Button, Space, Tooltip, message } from '@/shared/antd-imports';
import {
  WifiOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@/shared/antd-imports';
import { useServiceWorker } from '../../utils/serviceWorkerRegistration';

interface ServiceWorkerStatusProps {
  minimal?: boolean; // Show only basic offline indicator
  showControls?: boolean; // Show cache management controls
}

const ServiceWorkerStatus: React.FC<ServiceWorkerStatusProps> = ({
  minimal = false,
  showControls = false,
}) => {
  const { isOffline, swManager, clearCache, forceUpdate, getVersion } = useServiceWorker();
  const [swVersion, setSwVersion] = React.useState<string>('');
  const [isClearing, setIsClearing] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Get service worker version on mount
  React.useEffect(() => {
    if (getVersion) {
      const versionPromise = getVersion();
      if (versionPromise) {
        versionPromise
          .then(version => {
            setSwVersion(version);
          })
          .catch(() => {
            // Ignore errors when getting version
          });
      }
    }
  }, [getVersion]);

  const handleClearCache = async () => {
    if (!clearCache) return;

    setIsClearing(true);
    try {
      const success = await clearCache();
      if (success) {
        message.success('Cache cleared successfully');
      } else {
        message.error('Failed to clear cache');
      }
    } catch (error) {
      message.error('Error clearing cache');
    } finally {
      setIsClearing(false);
    }
  };

  const handleForceUpdate = async () => {
    if (!forceUpdate) return;

    setIsUpdating(true);
    try {
      await forceUpdate();
      message.success('Application will reload with updates');
    } catch (error) {
      message.error('Failed to update application');
      setIsUpdating(false);
    }
  };

  // Minimal version - just show offline status
  if (minimal) {
    return (
      <Tooltip title={isOffline ? 'You are offline' : 'You are online'}>
        <Badge status={isOffline ? 'error' : 'success'} text={isOffline ? 'Offline' : 'Online'} />
      </Tooltip>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOffline ? (
            <DisconnectOutlined style={{ color: '#ff4d4f' }} />
          ) : (
            <WifiOutlined style={{ color: '#52c41a' }} />
          )}
          <span style={{ fontSize: '14px' }}>{isOffline ? 'Offline Mode' : 'Online'}</span>
          {swVersion && <span style={{ fontSize: '12px', color: '#8c8c8c' }}>v{swVersion}</span>}
        </div>

        {/* Information */}
        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
          {isOffline
            ? 'App is running from cache. Changes will sync when online.'
            : 'App is cached for offline use. Ready to work anywhere!'}
        </div>

        {/* Controls */}
        {showControls && swManager && (
          <Space size="small">
            <Tooltip title="Clear all cached data">
              <Button
                size="small"
                icon={<DeleteOutlined />}
                loading={isClearing}
                onClick={handleClearCache}
              >
                Clear Cache
              </Button>
            </Tooltip>

            <Tooltip title="Check for updates and reload">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={isUpdating}
                onClick={handleForceUpdate}
              >
                Update App
              </Button>
            </Tooltip>
          </Space>
        )}
      </Space>
    </div>
  );
};

export default ServiceWorkerStatus;
