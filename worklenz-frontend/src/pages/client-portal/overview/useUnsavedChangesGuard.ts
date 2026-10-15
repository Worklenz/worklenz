import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/shared/antd-imports';
import { OVERVIEW_NS } from './widgets/WidgetFrame';

/**
 * Asks before leaving while `when` is true. In-app navigation goes through the data router's
 * blocker; closing or reloading the tab uses the browser's own beforeunload prompt.
 */
export const useUnsavedChangesGuard = (when: boolean, onLeave: () => void): void => {
  const { t } = useTranslation(OVERVIEW_NS);
  const blocker = useBlocker(when);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    Modal.confirm({
      title: t('edit.leaveTitle', { defaultValue: 'Leave without saving?' }),
      content: t('edit.leaveBody', { defaultValue: 'Your changes to the overview have not been saved and will be lost.' }),
      okText: t('edit.leave', { defaultValue: 'Leave' }),
      cancelText: t('edit.stay', { defaultValue: 'Stay' }),
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
