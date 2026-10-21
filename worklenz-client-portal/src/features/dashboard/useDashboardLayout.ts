import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import { useGetDashboardLayoutQuery, useResetDashboardLayoutMutation, useSaveDashboardLayoutMutation } from '@/store/api-v2';
import type { DashboardLayoutV2, DashboardWidgetInstance, DashboardWidgetType, ProjectsWidgetSettings } from '@/types/v2';
import { WIDGET_META, applyGeometry, moveWidget, normalizeProjectsSettings, reconcileLayout, type LayoutContext } from './layoutModel';

const CACHE_KEY = 'clientPortalDashboardLayout';

// The saved layout is mirrored in localStorage only so the first paint does not flash the default
// arrangement while the request is in flight. The server copy always wins.
const readCache = (userKey: string): DashboardLayoutV2 | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${userKey}`);
    return raw ? (JSON.parse(raw) as DashboardLayoutV2) : null;
  } catch {
    return null;
  }
};

const writeCache = (userKey: string, layout: DashboardLayoutV2 | null): void => {
  try {
    if (layout) localStorage.setItem(`${CACHE_KEY}:${userKey}`, JSON.stringify(layout));
    else localStorage.removeItem(`${CACHE_KEY}:${userKey}`);
  } catch {
    /* storage unavailable: the server copy still works */
  }
};

export interface DashboardLayoutApi {
  widgets: DashboardWidgetInstance[];
  isEditing: boolean;
  /** The draft differs from what is saved: leaving now would lose changes. */
  isDirty: boolean;
  /** The widget most recently added from Add widget, so the grid can scroll to and highlight it. */
  lastAdded: { type: DashboardWidgetType; at: number } | null;
  isSaving: boolean;
  startEditing: () => void;
  cancel: () => void;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  setGeometry: (items: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => void;
  hide: (type: DashboardWidgetType) => void;
  show: (type: DashboardWidgetType) => void;
  move: (type: DashboardWidgetType, direction: -1 | 1) => void;
  resize: (type: DashboardWidgetType, size: Partial<{ w: number; h: number }>) => void;
  updateProjectsSettings: (patch: Partial<ProjectsWidgetSettings>) => void;
}

/**
 * The dashboard arrangement: what is saved for this user, plus a draft while they customise. Nothing
 * is persisted until they press Save; Cancel throws the draft away.
 */
export const useDashboardLayout = (userKey: string, ctx: LayoutContext): DashboardLayoutApi => {
  const { t } = useTranslation();
  const query = useGetDashboardLayoutQuery();
  const [saveLayout, saveState] = useSaveDashboardLayoutMutation();
  const [resetLayout] = useResetDashboardLayoutMutation();
  const [draft, setDraft] = useState<DashboardLayoutV2 | null>(null);
  const [lastAdded, setLastAdded] = useState<DashboardLayoutApi['lastAdded']>(null);
  const { invoicesVisible } = ctx;

  const saved = useMemo(
    () => reconcileLayout(query.data ? query.data.layout : readCache(userKey), { invoicesVisible }),
    [query.data, userKey, invoicesVisible],
  );
  const current = draft ?? saved;

  const edit = useCallback((change: (widgets: DashboardWidgetInstance[]) => DashboardWidgetInstance[]) => {
    setDraft(previous => {
      if (!previous) return previous;
      const widgets = change(previous.widgets);
      return widgets === previous.widgets ? previous : { ...previous, widgets };
    });
  }, []);

  const isDirty = useMemo(() => draft !== null && JSON.stringify(draft.widgets) !== JSON.stringify(saved.widgets), [draft, saved]);

  const startEditing = useCallback(() => setDraft(saved), [saved]);
  const cancel = useCallback(() => {
    setDraft(null);
    setLastAdded(null);
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    try {
      await saveLayout(draft).unwrap();
      writeCache(userKey, draft);
      setDraft(null);
      message.success(t('dashboard.customize.saved', { defaultValue: 'Overview saved' }));
    } catch {
      message.error(t('dashboard.customize.saveFailed', { defaultValue: 'Could not save your overview. Try again.' }));
    }
  }, [draft, saveLayout, userKey, t]);

  const reset = useCallback(async () => {
    try {
      await resetLayout().unwrap();
      writeCache(userKey, null);
      setDraft(null);
      message.success(t('dashboard.customize.resetDone', { defaultValue: 'Overview reset to the default layout' }));
    } catch {
      message.error(t('dashboard.customize.resetFailed', { defaultValue: 'Could not reset your overview. Try again.' }));
    }
  }, [resetLayout, userKey, t]);

  const setGeometry = useCallback<DashboardLayoutApi['setGeometry']>(items => edit(widgets => applyGeometry(widgets, items)), [edit]);
  const hide = useCallback((type: DashboardWidgetType) => edit(widgets => widgets.map(item => (item.type === type ? { ...item, hidden: true } : item))), [edit]);
  const show = useCallback(
    (type: DashboardWidgetType) => {
      setLastAdded({ type, at: Date.now() });
      edit(widgets => {
        const bottom = widgets.filter(item => !item.hidden).reduce((max, item) => Math.max(max, item.y + item.h), 0);
        const meta = WIDGET_META[type];
        return widgets.map(item => (item.type === type ? { ...item, hidden: false, x: 0, y: bottom, w: meta.size.w, h: meta.size.h } : item));
      });
    },
    [edit],
  );
  const move = useCallback((type: DashboardWidgetType, direction: -1 | 1) => edit(widgets => moveWidget(widgets, type, direction)), [edit]);
  const resize = useCallback<DashboardLayoutApi['resize']>(
    (type, size) =>
      edit(widgets =>
        widgets.map(item => {
          if (item.type !== type) return item;
          const meta = WIDGET_META[type];
          const w = Math.max(meta.min.w, Math.min(12, size.w ?? item.w));
          return { ...item, w, x: Math.min(item.x, 12 - w), h: Math.max(meta.min.h, size.h ?? item.h) };
        }),
      ),
    [edit],
  );
  const updateProjectsSettings = useCallback(
    (patch: Partial<ProjectsWidgetSettings>) =>
      edit(widgets =>
        widgets.map(item => (item.type === 'projects' ? { ...item, settings: normalizeProjectsSettings({ ...item.settings, ...patch }) } : item)),
      ),
    [edit],
  );

  return {
    widgets: current.widgets,
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
    updateProjectsSettings,
  };
};
