// Update Notification Provider
// Provides global update notification management

import React from 'react';
import { useUpdateChecker } from '../../hooks/useUpdateChecker';
import UpdateNotification from './UpdateNotification';

interface UpdateNotificationProviderProps {
  children: React.ReactNode;
  checkInterval?: number;
  enableAutoCheck?: boolean;
}

const UpdateNotificationProvider: React.FC<UpdateNotificationProviderProps> = ({
  children,
  checkInterval = 5 * 60 * 1000, // 5 minutes
  enableAutoCheck = true
}) => {
  const {
    showUpdateNotification,
    setShowUpdateNotification,
    dismissUpdate
  } = useUpdateChecker({
    checkInterval,
    enableAutoCheck,
    showNotificationOnUpdate: true
  });

  const handleClose = () => {
    dismissUpdate();
  };

  const handleUpdate = () => {
    // The hardReload function in UpdateNotification will handle the actual update
    setShowUpdateNotification(false);
  };

  return (
    <>
      {children}
      <UpdateNotification
        visible={showUpdateNotification}
        onClose={handleClose}
        onUpdate={handleUpdate}
      />
    </>
  );
};

export default UpdateNotificationProvider;