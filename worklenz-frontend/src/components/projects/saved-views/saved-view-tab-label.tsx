import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DeleteOutlined,
  Dropdown,
  EditOutlined,
  EllipsisOutlined,
  Flex,
  Input,
  Modal,
  message,
} from '@/shared/antd-imports';
import type { InputRef, MenuProps } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  deleteSavedView,
  setRenamingViewId,
  updateSavedView,
} from '@/features/projects/singleProject/saved-views/saved-views.slice';
import { IProjectSavedView } from '@/types/project/project-saved-views.types';

const NAME_MAX_LENGTH = 100;

interface SavedViewTabLabelProps {
  view: IProjectSavedView;
  projectId: string;
  isActive: boolean;
  canEdit: boolean;
  onDeleted: (viewId: string) => void;
}

/** Label of a saved view tab: its name, an inline rename input, and a Rename/Delete menu. */
export const SavedViewTabLabel: React.FC<SavedViewTabLabelProps> = ({
  view,
  projectId,
  isActive,
  canEdit,
  onDeleted,
}) => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const isRenaming = useAppSelector(
    state => canEdit && state.savedViewsReducer.renamingViewId === view.id
  );
  const [draftName, setDraftName] = useState(view.name);
  const inputRef = useRef<InputRef>(null);
  // Enter commits and unmounts the input, which also fires blur; only the first one counts.
  const hasFinishedRenameRef = useRef(false);

  useEffect(() => {
    if (!isRenaming) return;
    hasFinishedRenameRef.current = false;
    setDraftName(view.name);
    // Wait for the input to mount, then select the name so typing replaces it.
    const frame = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [isRenaming, view.name]);

  const finishRename = useCallback(
    (shouldSave: boolean) => {
      if (hasFinishedRenameRef.current) return;
      hasFinishedRenameRef.current = true;
      dispatch(setRenamingViewId(null));
      const name = draftName.trim();
      if (!shouldSave || !name || name === view.name) return;
      dispatch(updateSavedView({ projectId, viewId: view.id, body: { name } }))
        .unwrap()
        .catch(error =>
          message.error(
            typeof error === 'string'
              ? error
              : t('savedViewRenameFailed', { defaultValue: 'Could not rename the view' })
          )
        );
    },
    [dispatch, draftName, projectId, t, view.id, view.name]
  );

  const confirmDelete = useCallback(() => {
    Modal.confirm({
      title: t('deleteSavedViewTitle', {
        defaultValue: 'Delete "{{name}}"?',
        name: view.name,
      }),
      content: t('deleteSavedViewContent', {
        defaultValue: 'This tab will be removed for everyone in the project. Tasks are not affected.',
      }),
      okText: t('deleteSavedViewOk', { defaultValue: 'Delete' }),
      okType: 'danger',
      cancelText: t('cancel', { defaultValue: 'Cancel' }),
      onOk: async () => {
        try {
          await dispatch(deleteSavedView({ projectId, viewId: view.id })).unwrap();
          onDeleted(view.id);
        } catch (error) {
          message.error(
            typeof error === 'string'
              ? error
              : t('savedViewDeleteFailed', { defaultValue: 'Could not delete the view' })
          );
        }
      },
    });
  }, [dispatch, onDeleted, projectId, t, view.id, view.name]);

  const menu: MenuProps = {
    items: [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: t('renameSavedView', { defaultValue: 'Rename' }),
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        danger: true,
        label: t('deleteSavedView', { defaultValue: 'Delete tab' }),
      },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      if (key === 'rename') dispatch(setRenamingViewId(view.id));
      if (key === 'delete') confirmDelete();
    },
  };

  if (isRenaming) {
    return (
      <Input
        ref={inputRef}
        size="small"
        value={draftName}
        maxLength={NAME_MAX_LENGTH}
        aria-label={t('savedViewNameLabel', { defaultValue: 'Tab name' })}
        style={{ width: Math.min(Math.max(draftName.length, 6) + 4, 32) + 'ch' }}
        onChange={event => setDraftName(event.target.value)}
        onBlur={() => finishRename(true)}
        // The tab bar handles arrow keys, Enter and clicks itself; keep them inside the input.
        onClick={event => event.stopPropagation()}
        onMouseDown={event => event.stopPropagation()}
        onKeyDown={event => {
          event.stopPropagation();
          if (event.key === 'Enter') finishRename(true);
          if (event.key === 'Escape') finishRename(false);
        }}
      />
    );
  }

  return (
    <Flex align="center" gap={4}>
      <span
        style={{ fontWeight: 500, fontSize: '13px' }}
        onDoubleClick={() => canEdit && dispatch(setRenamingViewId(view.id))}
      >
        {view.name}
      </span>
      {canEdit && isActive && (
        <Dropdown menu={menu} trigger={['click']} placement="bottomLeft">
          <Button
            type="text"
            size="small"
            className="borderless-icon-btn"
            icon={<EllipsisOutlined style={{ fontSize: 12 }} />}
            aria-label={t('savedViewOptions', { defaultValue: 'Tab options' })}
            style={{ padding: '2px', minWidth: 'auto', height: 'auto', lineHeight: 1 }}
            onClick={event => event.stopPropagation()}
          />
        </Dropdown>
      )}
    </Flex>
  );
};
