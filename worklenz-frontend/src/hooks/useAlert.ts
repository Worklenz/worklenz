// src/hooks/useAlert.ts
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { alertService } from '@/services/alerts/alertService';
import { showAlert } from '@/services/alerts/alertSlice';
import { AlertType } from '@/types/alert.types';

export const useAlert = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const show = (type: AlertType, title: string, message: string, duration?: number) => {
    // Update Redux state
    dispatch(showAlert({ type, title, message, duration }));
    // Show alert via service
    alertService[type](title, message, duration);
  };

  return {
    success: (title: string, message: string, duration?: number) =>
      show('success', title, message, duration),
    error: (title: string, message: string, duration?: number) =>
      show('error', title, message, duration),
    info: (title: string, message: string, duration?: number) =>
      show('info', title, message, duration),
    warning: (title: string, message: string, duration?: number) =>
      show('warning', title, message, duration),
    clearAll: alertService.clearAll,
  };
};
