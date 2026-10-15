import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App } from '@/shared/antd-imports';

type NavigateFn = (...args: unknown[]) => void;

/**
 * Asks before leaving while `when` is true. The app uses BrowserRouter (not a data router), so
 * react-router's useBlocker is unavailable: in-app navigation (links, the sidebar, programmatic
 * navigate) is intercepted by wrapping the router's push/replace, and closing or reloading the tab
 * uses the browser's own beforeunload prompt. The browser Back button cannot be intercepted here.
 */
export const useUnsavedChangesGuard = (when: boolean, onLeave: () => void): void => {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const { modal } = App.useApp();
  const { t } = useTranslation();
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  useEffect(() => {
    if (!when) return undefined;

    const target = navigator as unknown as { push: NavigateFn; replace: NavigateFn };
    const { push, replace } = target;
    let confirming = false;

    const guard =
      (original: NavigateFn): NavigateFn =>
      (...args) => {
        if (confirming) return;
        confirming = true;
        modal.confirm({
          title: t('dashboard.customize.leaveTitle', { defaultValue: 'Leave without saving?' }),
          content: t('dashboard.customize.leaveBody', { defaultValue: 'Your changes to the overview have not been saved and will be lost.' }),
          okText: t('dashboard.customize.leave', { defaultValue: 'Leave' }),
          cancelText: t('dashboard.customize.stay', { defaultValue: 'Stay' }),
          okButtonProps: { danger: true },
          onOk: () => {
            confirming = false;
            onLeaveRef.current();
            original(...args);
          },
          onCancel: () => {
            confirming = false;
          },
        });
      };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    target.push = guard(push);
    target.replace = guard(replace);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      target.push = push;
      target.replace = replace;
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [when, navigator, modal, t]);
};
