import React from 'react';
import {
  Button,
  Switch,
  Tooltip,
  Typography,
  theme,
  ArrowDownOutlined,
  ArrowUpOutlined,
  HolderOutlined,
} from '@/shared/antd-imports';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

// One row of the Customize dialog: an optional drag handle, a title, optional move up/down buttons,
// and a show/hide switch. Shared by the section list, the tab list and the greeting row.

const HANDLE_SLOT_WIDTH = 24;

interface ReorderControls {
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

interface CustomizeRowBaseProps {
  title: string;
  icon?: React.ReactNode;
  isVisible?: boolean;
  /** When false the switch is locked on and `lockedReason` explains why. */
  canHide?: boolean;
  lockedReason?: string;
  /** Omit for rows that can only be reordered, such as the sidebar items: no switch is shown. */
  onVisibleChange?: (visible: boolean) => void;
  reorder?: ReorderControls;
  /** Extra buttons placed between the move buttons and the switch. */
  extraActions?: React.ReactNode;
}

interface CustomizeRowViewProps extends CustomizeRowBaseProps {
  rowRef?: React.Ref<HTMLDivElement>;
  rowStyle?: React.CSSProperties;
  /** Drag handle; rows that can't be dragged get an empty slot so titles stay aligned. */
  dragHandle?: React.ReactNode;
}

const CustomizeRowView: React.FC<CustomizeRowViewProps> = ({
  title,
  icon,
  isVisible = true,
  canHide = true,
  lockedReason,
  onVisibleChange,
  reorder,
  extraActions,
  rowRef,
  rowStyle,
  dragHandle,
}) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();

  return (
    <div
      ref={rowRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        ...rowStyle,
      }}
    >
      {dragHandle ?? <span style={{ width: HANDLE_SLOT_WIDTH, flexShrink: 0 }} aria-hidden />}
      {icon && (
        <span aria-hidden style={{ display: 'flex', color: token.colorTextSecondary }}>
          {icon}
        </span>
      )}
      <Typography.Text ellipsis style={{ flex: 1, minWidth: 0, opacity: isVisible ? 1 : 0.5 }}>
        {title}
      </Typography.Text>

      {reorder && (
        <>
          <Tooltip title={t('customize.moveUp', { defaultValue: 'Move up' })}>
            <Button
              type="text"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={reorder.isFirst}
              aria-label={t('customize.moveUpNamed', { defaultValue: 'Move {{name}} up', name: title })}
              onClick={reorder.onMoveUp}
            />
          </Tooltip>
          <Tooltip title={t('customize.moveDown', { defaultValue: 'Move down' })}>
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={reorder.isLast}
              aria-label={t('customize.moveDownNamed', {
                defaultValue: 'Move {{name}} down',
                name: title,
              })}
              onClick={reorder.onMoveDown}
            />
          </Tooltip>
        </>
      )}
      {extraActions}
      {onVisibleChange && (
        <Tooltip title={canHide ? undefined : lockedReason}>
          <span>
            <Switch
              size="small"
              checked={isVisible}
              disabled={!canHide}
              aria-label={t('customize.showNamed', { defaultValue: 'Show {{name}}', name: title })}
              onChange={onVisibleChange}
            />
          </span>
        </Tooltip>
      )}
    </div>
  );
};

/** A row that can only be shown or hidden — it is not part of any drag-and-drop list. */
export const StaticCustomizeRow: React.FC<CustomizeRowBaseProps> = props => (
  <CustomizeRowView {...props} />
);

interface SortableCustomizeRowProps extends CustomizeRowBaseProps {
  id: string;
}

/** A row that can be dragged within its dnd-kit `SortableContext`. */
export const SortableCustomizeRow: React.FC<SortableCustomizeRowProps> = ({ id, ...props }) => {
  const { t } = useTranslation('home');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <CustomizeRowView
      {...props}
      rowRef={setNodeRef}
      rowStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      dragHandle={
        <Button
          ref={setActivatorNodeRef}
          type="text"
          size="small"
          icon={<HolderOutlined />}
          aria-label={t('customize.dragHandle', {
            defaultValue: 'Reorder {{name}}. Press space to pick up, then use the arrow keys.',
            name: props.title,
          })}
          style={{ cursor: 'grab', touchAction: 'none', width: HANDLE_SLOT_WIDTH, flexShrink: 0 }}
          {...attributes}
          {...listeners}
        />
      }
    />
  );
};
