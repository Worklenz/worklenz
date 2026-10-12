import React, { useCallback } from 'react';
import {
  Button,
  Flex,
  Tooltip,
  Typography,
  theme,
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from '@/shared/antd-imports';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { SortableCustomizeRow, StaticCustomizeRow } from './CustomizeRow';
import {
  findWidgetColumn,
  getHomeWidget,
  getOtherAllowedColumn,
  HOME_COLUMNS,
  HOME_GREETING_ID,
  isGreetingVisible,
  isHomeWidgetId,
  moveWidgetToIndex,
  setSectionHidden,
  shiftWidget,
  type HomeColumn,
  type HomeLayout,
  type HomeWidgetId,
} from './homeLayout';

interface CustomizeLayoutPanelProps {
  layout: HomeLayout;
  onChange: (layout: HomeLayout) => void;
}

const columnDropId = (column: HomeColumn) => `column:${column}`;

export const CustomizeLayoutPanel: React.FC<CustomizeLayoutPanelProps> = ({ layout, onChange }) => {
  const { t } = useTranslation('home');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnOf = useCallback(
    (id: string | number): HomeColumn | null => {
      if (id === columnDropId('main')) return 'main';
      if (id === columnDropId('side')) return 'side';
      return isHomeWidgetId(id) ? findWidgetColumn(layout, id) : null;
    },
    [layout]
  );

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !isHomeWidgetId(active.id)) return;
    const from = columnOf(active.id);
    const to = columnOf(over.id);
    if (!from || !to || from === to) return;
    const overIndex = isHomeWidgetId(over.id)
      ? layout.columns[to].indexOf(over.id)
      : layout.columns[to].length;
    onChange(moveWidgetToIndex(layout, active.id, to, overIndex));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || !isHomeWidgetId(active.id) || !isHomeWidgetId(over.id) || active.id === over.id) {
      return;
    }
    const column = columnOf(active.id);
    if (!column || column !== columnOf(over.id)) return;
    onChange(moveWidgetToIndex(layout, active.id, column, layout.columns[column].indexOf(over.id)));
  };

  const greetingTitle = t('customize.widgets.greeting', { defaultValue: 'Greeting banner' });

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t('customize.description', {
          defaultValue:
            'Drag sections to reorder them, or use the arrow buttons. Turn a section off to hide it from your Home page.',
        })}
      </Typography.Paragraph>

      <section aria-label={t('customize.topSection', { defaultValue: 'Top of page' })}>
        <SectionHeading>{t('customize.topSection', { defaultValue: 'Top of page' })}</SectionHeading>
        <StaticCustomizeRow
          title={greetingTitle}
          isVisible={isGreetingVisible(layout)}
          canHide
          onVisibleChange={visible => onChange(setSectionHidden(layout, HOME_GREETING_ID, !visible))}
        />
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Flex vertical gap={16}>
          {HOME_COLUMNS.map(column => (
            <ColumnList key={column} column={column} layout={layout} onChange={onChange} />
          ))}
        </Flex>
      </DndContext>
    </Flex>
  );
};

const SectionHeading: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
    {children}
  </Typography.Text>
);

interface ColumnListProps {
  column: HomeColumn;
  layout: HomeLayout;
  onChange: (layout: HomeLayout) => void;
}

const ColumnList: React.FC<ColumnListProps> = ({ column, layout, onChange }) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column) });
  const ids = layout.columns[column];

  const heading =
    column === 'main'
      ? t('customize.mainColumn', { defaultValue: 'Main area' })
      : t('customize.sideColumn', { defaultValue: 'Side panel' });

  return (
    <section aria-label={heading}>
      <SectionHeading>{heading}</SectionHeading>
      <div
        ref={setNodeRef}
        style={{
          minHeight: 56,
          padding: 8,
          borderRadius: 8,
          border: `1px dashed ${isOver ? token.colorPrimary : token.colorBorderSecondary}`,
          background: isOver ? token.colorPrimaryBg : 'transparent',
          transition: 'background 150ms, border-color 150ms',
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Flex vertical gap={8}>
            {ids.length === 0 && (
              <Typography.Text type="secondary" style={{ padding: 8, fontSize: 12 }}>
                {t('customize.emptyColumn', { defaultValue: 'Drop a section here' })}
              </Typography.Text>
            )}
            {ids.map(id => (
              <WidgetRow key={id} id={id} layout={layout} onChange={onChange} />
            ))}
          </Flex>
        </SortableContext>
      </div>
    </section>
  );
};

interface WidgetRowProps {
  id: HomeWidgetId;
  layout: HomeLayout;
  onChange: (layout: HomeLayout) => void;
}

const WidgetRow: React.FC<WidgetRowProps> = ({ id, layout, onChange }) => {
  const { t } = useTranslation('home');
  const widget = getHomeWidget(id);
  const title = t(widget.titleKey, { defaultValue: widget.titleDefault });
  const column = findWidgetColumn(layout, id);
  const index = layout.columns[column].indexOf(id);
  const otherColumn = getOtherAllowedColumn(layout, id);

  const moveLabel =
    otherColumn === 'side'
      ? t('customize.moveToSide', { defaultValue: 'Move to side panel' })
      : t('customize.moveToMain', { defaultValue: 'Move to main area' });

  return (
    <SortableCustomizeRow
      id={id}
      title={title}
      isVisible={!layout.hidden.includes(id)}
      canHide={widget.canHide}
      lockedReason={t('customize.cannotHide', { defaultValue: "This section can't be hidden." })}
      onVisibleChange={visible => onChange(setSectionHidden(layout, id, !visible))}
      reorder={{
        isFirst: index === 0,
        isLast: index === layout.columns[column].length - 1,
        onMoveUp: () => onChange(shiftWidget(layout, id, -1)),
        onMoveDown: () => onChange(shiftWidget(layout, id, 1)),
      }}
      extraActions={
        otherColumn && (
          <Tooltip title={moveLabel}>
            <Button
              type="text"
              size="small"
              icon={otherColumn === 'side' ? <ArrowRightOutlined /> : <ArrowLeftOutlined />}
              aria-label={`${moveLabel}: ${title}`}
              onClick={() => onChange(moveWidgetToIndex(layout, id, otherColumn, 0))}
            />
          </Tooltip>
        )
      }
    />
  );
};
