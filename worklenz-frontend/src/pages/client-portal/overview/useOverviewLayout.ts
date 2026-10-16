import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import {
  useGetOverviewLayoutQuery,
  useResetOverviewLayoutMutation,
  useSaveOverviewLayoutMutation,
} from '@/api/client-portal/portal-overview-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import type { OverviewLayout, OverviewWidgetInstance, OverviewWidgetKey } from '@/types/client-portal/v2/overview';
import { GRID_COLS, WIDGET_META, applyGeometry, moveWidget, reconcileLayout } from './overview-layout';
import { OVERVIEW_NS } from './widgets/WidgetFrame';

export interface OverviewLayoutApi {
  widgets: OverviewWidgetInstance[];
  isLoading: boolean;
  isEditing: boolean;
  /** The draft differs from what is saved: leaving now would lose changes. */
  isDirty: boolean;
  /** The widget most recently added from Add widget, so the grid can scroll to and highlight it. */
  lastAdded: { key: OverviewWidgetKey; at: number } | null;
  isSaving: boolean;
  startEditing: () => void;
  cancel: () => void;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  setGeometry: (items: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => void;
  hide: (key: OverviewWidgetKey) => void;
  show: (key: OverviewWidgetKey) => void;
  move: (key: OverviewWidgetKey, direction: -1 | 1) => void;
  resize: (key: OverviewWidgetKey, size: Partial<{ w: number; h: number }>) => void;
}

/**
 * The overview arrangement: what is saved for this user, plus a draft while they customise. Nothing
 * is persisted until they press Save; Cancel throws the draft away.
 */
export const useOverviewLayout = (): OverviewLayoutApi => {
  const { t } = useTranslation(OVERVIEW_NS);
  const query = useGetOverviewLayoutQuery();
  const [saveLayout, saveState] = useSaveOverviewLayoutMutation();
  const [resetLayout] = useResetOverviewLayoutMutation();
  const [draft, setDraft] = useState<OverviewLayout | null>(null);
  const [lastAdded, setLastAdded] = useState<OverviewLayoutApi['lastAdded']>(null);

  const saved = useMemo(() => reconcileLayout(query.data?.body.layout), [query.data?.body.layout]);
  const current = draft ?? saved;

  const edit = useCallback((change: (widgets: OverviewWidgetInstance[]) => OverviewWidgetInstance[]) => {
    setDraft(previous => {
      if (!previous) return previous;
      const widgets = change(previous.widgets);
      return widgets === previous.widgets ? previous : { ...previous, widgets };
    });
  }, []);

  const isDirty = useMemo(
    () => draft !== null && JSON.stringify(draft.widgets) !== JSON.stringify(saved.widgets),
    [draft, saved]
  );

  const startEditing = useCallback(() => setDraft(saved), [saved]);
  const cancel = useCallback(() => {
    setDraft(null);
    setLastAdded(null);
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    try {
      await saveLayout(draft).unwrap();
      setDraft(null);
      setLastAdded(null);
      message.success(t('edit.saved', { defaultValue: 'Overview saved' }));
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('edit.saveFailed', { defaultValue: 'Could not save the layout.' })));
    }
  }, [draft, saveLayout, t]);

  const reset = useCallback(async () => {
    try {
      await resetLayout().unwrap();
      setDraft(null);
      setLastAdded(null);
      message.success(t('edit.resetDone', { defaultValue: 'Overview reset to the default layout' }));
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('edit.resetFailed', { defaultValue: 'Could not reset the layout.' })));
    }
  }, [resetLayout, t]);

  const setGeometry = useCallback<OverviewLayoutApi['setGeometry']>(
    items => edit(widgets => applyGeometry(widgets, items)),
    [edit]
  );
  const hide = useCallback(
    (key: OverviewWidgetKey) => edit(widgets => widgets.map(item => (item.key === key ? { ...item, hidden: true } : item))),
    [edit]
  );
  const show = useCallback(
    (key: OverviewWidgetKey) => {
      setLastAdded({ key, at: Date.now() });
      edit(widgets => {
        const bottom = widgets.filter(item => !item.hidden).reduce((max, item) => Math.max(max, item.y + item.h), 0);
        const meta = WIDGET_META[key];
        return widgets.map(item =>
          item.key === key ? { ...item, hidden: false, x: 0, y: bottom, w: meta.size.w, h: meta.size.h } : item
        );
      });
    },
    [edit]
  );
  const move = useCallback(
    (key: OverviewWidgetKey, direction: -1 | 1) => edit(widgets => moveWidget(widgets, key, direction)),
    [edit]
  );
  const resize = useCallback<OverviewLayoutApi['resize']>(
    (key, size) =>
      edit(widgets =>
        widgets.map(item => {
          if (item.key !== key) return item;
          const meta = WIDGET_META[key];
          const w = Math.max(meta.min.w, Math.min(GRID_COLS, size.w ?? item.w));
          return { ...item, w, x: Math.min(item.x, GRID_COLS - w), h: Math.max(meta.min.h, size.h ?? item.h) };
        })
      ),
    [edit]
  );

  return {
    widgets: current.widgets,
    isLoading: query.isLoading,
    isEditing: draft !== null,
    isDirty,
    lastAdded,
    isSaving: saveState.isLoading,
    startEditing,
    cancel,
    save,
    reset,
    setGeometry,
    hide,
    show,
    move,
    resize,
  };
};
