import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/shared/antd-imports';

/**
 * Asks before leaving while `when` is true. The app uses a data router (createBrowserRouter), so
 * in-app navigation goes through react-router's own blocker; closing or reloading the tab falls
 * back to the browser's beforeunload prompt, which the blocker cannot cover.
 */
export const useUnsavedChangesGuard = (when: boolean, onLeave: () => void, i18nNamespace?: string): void => {
  const { t } = useTranslation(i18nNamespace);
  const blocker = useBlocker(when);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    Modal.confirm({
      title: t('dashboardGrid.leaveTitle', { defaultValue: 'Leave without saving?' }),
      content: t('dashboardGrid.leaveBody', {
        defaultValue: 'Your changes have not been saved and will be lost.',
      }),
      okText: t('dashboardGrid.leave', { defaultValue: 'Leave' }),
      cancelText: t('dashboardGrid.stay', { defaultValue: 'Stay' }),
      okButtonProps: { danger: true },
      onOk: () => {
        onLeave();
        blocker.proceed();
      },
      onCancel: () => blocker.reset(),
    });
  }, [blocker, onLeave, t]);

  useEffect(() => {
    if (!when) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);
};
