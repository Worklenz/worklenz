// src/services/notification/notificationMiddleware.ts

import { Middleware } from '@reduxjs/toolkit';
import { showAlert, hideAlert } from './alertSlice';
import alertService from './alertService';

export const notificationMiddleware: Middleware = store => next => action => {
  if (showAlert.match(action)) {
    const notification: any = action.payload;
    // Show notification using service
    alertService.error(notification.title, notification.message, notification.duration);

    // Auto-remove notification after duration
    if (notification.duration !== 0) {
      setTimeout(
        () => {
          store.dispatch(hideAlert(notification.id));
        },
        (notification.duration || store.getState().notification.config.duration) * 1000
      );
    }
  }

  return next(action);
};
