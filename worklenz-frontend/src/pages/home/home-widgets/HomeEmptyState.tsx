import React from 'react';
import { theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { AddWidgetButton } from './AddWidgetButton';
import type { HomeLayout, HomeSectionId } from '../home-layout/homeLayout';

interface HomeEmptyStateProps {
  layout: HomeLayout;
  onAdd: (id: HomeSectionId) => void;
  isDragEnabled: boolean;
  /** A widget is being dragged out of the "Add widget" panel: this becomes the place to drop it. */
  isDragging: boolean;
  /** The dragged widget would land here. */
  isDropTarget: boolean;
}

/**
 * What the Home overview shows when no widget is on it (the greeting banner does not count): where
 * to get one. While a widget is dragged out of the "Add widget" panel it turns into the drop zone.
 * It stays mounted through the drag, with the button only hidden, because the panel being dragged
 * from belongs to that button.
 */
export const HomeEmptyState: React.FC<HomeEmptyStateProps> = ({
  layout,
  onAdd,
  isDragEnabled,
  isDragging,
  isDropTarget,
}) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  return (
    <div
      style={{
        flex: 1,
        minHeight: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        borderRadius: 10,
        border: isDragging
          ? `2px dashed ${isDropTarget ? token.colorPrimary : token.colorBorder}`
          : `1px solid ${token.colorBorderSecondary}`,
        background: isDropTarget ? token.colorPrimaryBg : token.colorFillQuaternary,
        transition: 'background 150ms, border-color 150ms',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color: token.colorText }}>
        {isDragging
          ? t('widgets.dropHere', { defaultValue: 'Drop a widget here' })
          : isDragEnabled
            ? t('widgets.empty.title', { defaultValue: 'Drag and drop new widgets' })
            : t('widgets.empty.titleNoDrag', { defaultValue: 'Add widgets to your Home page' })}
      </div>
      <div style={{ visibility: isDragging ? 'hidden' : 'visible' }}>
        <AddWidgetButton layout={layout} onAdd={onAdd} isDragEnabled={isDragEnabled} variant="empty-state" />
      </div>
    </div>
  );
};
