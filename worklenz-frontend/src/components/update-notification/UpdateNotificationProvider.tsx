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
  enableAutoCheck = true,
}) => {
  // Temporarily disable the "new update available" reload popup.
  const enableUpdateNotificationPopup = false;

  const { showUpdateNotification, setShowUpdateNotification, dismissUpdate } = useUpdateChecker({
    checkInterval,
    enableAutoCheck,
    showNotificationOnUpdate: enableUpdateNotificationPopup,
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
      {enableUpdateNotificationPopup && (
        <UpdateNotification
          visible={showUpdateNotification}
          onClose={handleClose}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
};

export default UpdateNotificationProvider;
