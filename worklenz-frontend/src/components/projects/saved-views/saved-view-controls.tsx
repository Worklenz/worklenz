import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Dropdown,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  Tooltip,
  message,
} from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  createSavedView,
  revertSavedView,
  saveActiveSavedView,
  selectActiveSavedView,
  selectCurrentSavedViewConfig,
  selectSavedViews,
} from '@/features/projects/singleProject/saved-views/saved-views.slice';
import {
  areSavedViewConfigsEqual,
  hasSavedViewCriteria,
  nextSavedViewName,
  toSavedViewTabKey,
} from '@/features/projects/singleProject/saved-views/saved-view-config';

/**
 * "Save view" for the Task List toolbar. On the List tab it offers to save the current filters,
 * sort and grouping as a new project tab; on a saved view tab it appears once the view has
 * unsaved changes, with "Save as a new tab" and "Revert to last save" in its menu.
 */
export const SavedViewControls: React.FC = () => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const isGuest = useAppSelector(state => state.projectReducer.project?.is_guest === true);
  const views = useAppSelector(selectSavedViews);
  const activeView = useAppSelector(selectActiveSavedView);
  const currentConfig = useAppSelector(selectCurrentSavedViewConfig);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(
    () => !!activeView && !areSavedViewConfigsEqual(currentConfig, activeView.config),
    [activeView, currentConfig]
  );

  const saveAsNewTab = useCallback(async () => {
    if (!projectId || isSaving) return;
    setIsSaving(true);
    try {
      const name = nextSavedViewName(
        t('savedViewDefaultName', { defaultValue: 'List' }),
        views.map(view => view.name)
      );
      const view = await dispatch(createSavedView({ projectId, name })).unwrap();
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', toSavedViewTabKey(view.id));
      setSearchParams(nextParams, { replace: true });
    } catch (error) {
      message.error(
        typeof error === 'string'
          ? error
          : t('savedViewSaveFailed', { defaultValue: 'Could not save the view' })
      );
    } finally {
      setIsSaving(false);
    }
  }, [dispatch, isSaving, projectId, searchParams, setSearchParams, t, views]);

  const saveActiveView = useCallback(async () => {
    if (!projectId || isSaving) return;
    setIsSaving(true);
    try {
      await dispatch(saveActiveSavedView({ projectId })).unwrap();
      message.success(t('savedViewSaved', { defaultValue: 'View saved' }));
    } catch (error) {
      message.error(
        typeof error === 'string'
          ? error
          : t('savedViewSaveFailed', { defaultValue: 'Could not save the view' })
      );
    } finally {
      setIsSaving(false);
    }
  }, [dispatch, isSaving, projectId, t]);

  const menu = useMemo<MenuProps>(
    () => ({
      items: [
        {
          key: 'save-as-new-tab',
          icon: <PlusOutlined />,
          label: t('saveAsNewTab', { defaultValue: 'Save as a new tab' }),
        },
        {
          key: 'revert',
          icon: <ReloadOutlined />,
          label: t('revertToLastSave', { defaultValue: 'Revert to last save' }),
        },
      ],
      onClick: ({ key }) => {
        if (key === 'save-as-new-tab') void saveAsNewTab();
        if (key === 'revert' && projectId) void dispatch(revertSavedView({ projectId }));
      },
    }),
    [dispatch, projectId, saveAsNewTab, t]
  );

  if (isGuest || !projectId) return null;

  if (activeView) {
    if (!isDirty) return null;
    return (
      <Dropdown.Button
        size="small"
        menu={menu}
        loading={isSaving}
        onClick={saveActiveView}
        trigger={['click']}
        placement="bottomRight"
        buttonsRender={([leftButton, rightButton]) => [
          leftButton,
          React.cloneElement(rightButton as React.ReactElement<{ 'aria-label'?: string }>, {
            'aria-label': t('saveViewOptions', { defaultValue: 'More save options' }),
          }),
        ]}
      >
        <SaveOutlined />
        {t('saveView', { defaultValue: 'Save view' })}
      </Dropdown.Button>
    );
  }

  if (!hasSavedViewCriteria(currentConfig)) return null;

  return (
    <Tooltip
      title={t('saveAsNewTabHint', {
        defaultValue: 'Keep these filters, sort and grouping as a new project tab',
      })}
    >
      <Button size="small" icon={<PlusOutlined />} loading={isSaving} onClick={saveAsNewTab}>
        {t('saveAsNewTab', { defaultValue: 'Save as a new tab' })}
      </Button>
    </Tooltip>
  );
};
