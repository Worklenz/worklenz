import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Checkbox, Dropdown, Input, Tooltip } from '@/shared/antd-imports';
import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { Editor as TiptapEditor } from '@tiptap/core';
import { MutableRefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  IDocumentNode,
  IDocumentSection,
  IListItem,
  IListSection,
  ISectionDocument,
  ITextSection,
  SectionKind,
  createSection,
} from '@/types/project/project-documents.types';

import DocsInlineEditor, { MentionHandlers } from './docs-inline-editor';

interface DocsSectionListProps {
  focusRequest?: { fieldKey: string } | null;
  projectId: string;
  content: ISectionDocument;
  handlersRef: MutableRefObject<MentionHandlers>;
  onChange: (content: ISectionDocument) => void;
  onActivity: (editor: TiptapEditor) => void;
}

const SECTION_KINDS: SectionKind[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'numberedList',
  'checklist',
  'quote',
  'code',
  'divider',
];

const isTextSection = (section: IDocumentSection): section is ITextSection =>
  section.type === 'paragraph' || section.type === 'heading' || section.type === 'quote';

const isListSection = (section: IDocumentSection): section is IListSection =>
  section.type === 'bulletList' || section.type === 'numberedList' || section.type === 'checklist';

const DocsSectionList = ({
  focusRequest,
  projectId,
  content,
  handlersRef,
  onChange,
  onActivity,
}: DocsSectionListProps) => {
  const { t } = useTranslation('project-view-docs');
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (focusRequest) setFocusId(focusRequest.fieldKey);
  }, [focusRequest]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const sections = content.sections;

  const publish = (next: IDocumentSection[]) => {
    onChange({ version: 1, sections: next });
  };

  const kindLabel = (kind: SectionKind) => {
    const labels: Record<SectionKind, string> = {
      paragraph: t('paragraph', { defaultValue: 'Paragraph' }),
      heading1: t('heading1', { defaultValue: 'Heading 1' }),
      heading2: t('heading2', { defaultValue: 'Heading 2' }),
      heading3: t('heading3', { defaultValue: 'Heading 3' }),
      bulletList: t('bulletList', { defaultValue: 'Bullet list' }),
      numberedList: t('numberedList', { defaultValue: 'Numbered list' }),
      checklist: t('taskList', { defaultValue: 'To-do list' }),
      quote: t('quote', { defaultValue: 'Quote' }),
      code: t('code', { defaultValue: 'Code' }),
      divider: t('divider', { defaultValue: 'Divider' }),
    };
    return labels[kind];
  };

  const insertAt = (index: number, kind: SectionKind) => {
    const section = createSection(kind);
    const next = sections.slice();
    next.splice(index, 0, section);
    publish(next);
    if (isListSection(section)) setFocusId(section.items[0]?.id || section.id);
    else if (section.type !== 'divider') setFocusId(section.id);
  };

  const replaceSection = (section: IDocumentSection) => {
    publish(sections.map(item => (item.id === section.id ? section : item)));
  };

  const removeSection = (sectionId: string) => {
    const index = sections.findIndex(section => section.id === sectionId);
    const previous = index > 0 ? sections[index - 1] : null;
    publish(sections.filter(section => section.id !== sectionId));
    if (!previous) {
      setFocusId(null);
      return;
    }
    if (isListSection(previous)) setFocusId(previous.items[previous.items.length - 1]?.id || null);
    else if (previous.type !== 'divider' && previous.type !== 'code') setFocusId(previous.id);
  };

  const splitText = (sectionId: string, before: IDocumentNode[], after: IDocumentNode[]) => {
    const index = sections.findIndex(section => section.id === sectionId);
    const current = sections[index];
    if (!current || !isTextSection(current)) return;
    const created = createSection('paragraph');
    if (created.type !== 'paragraph') return;
    created.content = after;
    const next = sections.slice();
    next[index] = { ...current, content: before };
    next.splice(index + 1, 0, created);
    publish(next);
    setFocusId(created.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (!overId || overId === event.active.id) return;
    const from = sections.findIndex(section => section.id === event.active.id);
    const to = sections.findIndex(section => section.id === overId);
    if (from < 0 || to < 0) return;
    publish(arrayMove(sections, from, to));
  };

  const menu = (index: number) => ({
    items: SECTION_KINDS.map(kind => ({ key: kind, label: kindLabel(kind) })),
    onClick: ({ key }: { key: string }) => insertAt(index, key as SectionKind),
  });

  return (
    <div className="docs-sections">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(section => section.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section, index) => (
            <div key={section.id}>
              <SectionInsert label={t('addSectionHere', { defaultValue: 'Add a section here' })} menu={menu(index)} />
              <SectionRow
                section={section}
                projectId={projectId}
                focusId={focusId}
                handlersRef={handlersRef}
                onActivity={onActivity}
                onReplace={replaceSection}
                onRemove={() => removeSection(section.id)}
                onSplitText={splitText}
                onFocusTarget={setFocusId}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 ? (
        <p className="docs-sections-empty">{t('emptySections', { defaultValue: 'Add a section to start writing.' })}</p>
      ) : null}

      <Dropdown menu={menu(sections.length)} trigger={['click']}>
        <Button type="dashed" icon={<PlusOutlined />} className="docs-add-section" aria-label={t('addSection', { defaultValue: 'Add a section' })}>
          {t('addSection', { defaultValue: 'Add a section' })}
        </Button>
      </Dropdown>
    </div>
  );
};

interface SectionInsertProps {
  label: string;
  menu: {
    items: Array<{ key: string; label: string }>;
    onClick: (info: { key: string }) => void;
  };
}

const SectionInsert = ({ label, menu }: SectionInsertProps) => (
  <div className="docs-section-insert">
    <Dropdown menu={menu} trigger={['click']}>
      <Tooltip title={label}>
        <button type="button" className="docs-section-insert-btn" aria-label={label}>
          <PlusOutlined />
        </button>
      </Tooltip>
    </Dropdown>
  </div>
);

interface SectionRowProps {
  section: IDocumentSection;
  projectId: string;
  focusId: string | null;
  handlersRef: MutableRefObject<MentionHandlers>;
  onActivity: (editor: TiptapEditor) => void;
  onReplace: (section: IDocumentSection) => void;
  onRemove: () => void;
  onSplitText: (sectionId: string, before: IDocumentNode[], after: IDocumentNode[]) => void;
  onFocusTarget: (id: string) => void;
}

const SectionRow = ({
  section,
  projectId,
  focusId,
  handlersRef,
  onActivity,
  onReplace,
  onRemove,
  onSplitText,
  onFocusTarget,
}: SectionRowProps) => {
  const { t } = useTranslation('project-view-docs');
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const headingClass = section.type === 'heading' ? `is-h${section.level || 1}` : '';

  return (
    <div
      ref={setNodeRef}
      className={['docs-section', section.type === 'quote' ? 'is-quote' : '', headingClass].filter(Boolean).join(' ')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Tooltip title={t('dragSection', { defaultValue: 'Drag to reorder section' })}>
        <button
          type="button"
          className="docs-section-handle"
          aria-label={t('dragSection', { defaultValue: 'Drag to reorder section' })}
          {...attributes}
          {...listeners}
        >
          <HolderOutlined />
        </button>
      </Tooltip>
      <div className="docs-section-body">
        {section.type === 'heading' ? (
          <div className="docs-heading-levels" role="group" aria-label={t('heading', { defaultValue: 'Heading' })}>
            {([1, 2, 3] as const).map(level => (
              <button
                key={level}
                type="button"
                className={section.level === level ? 'is-active' : ''}
                aria-label={t(level === 1 ? 'heading1' : level === 2 ? 'heading2' : 'heading3', {
                  defaultValue: `Heading ${level}`,
                })}
                aria-pressed={section.level === level}
                onClick={() => onReplace({ ...section, level })}
              >
                H{level}
              </button>
            ))}
          </div>
        ) : null}
        {isTextSection(section) ? (
          <DocsInlineEditor
            fieldKey={section.id}
            projectId={projectId}
            content={section.content}
            placeholder={
              section.type === 'heading'
                ? t('heading', { defaultValue: 'Heading' })
                : section.type === 'quote'
                  ? t('quote', { defaultValue: 'Quote' })
                  : t('placeholder', { defaultValue: "Write, '@' for members, '#' for tasks" })
            }
            ariaLabel={t('pageBody', { defaultValue: 'Page content' })}
            className="docs-inline"
            autoFocus={focusId === section.id}
            handlersRef={handlersRef}
            onChange={inline => onReplace({ ...section, content: inline })}
            onSplit={(before, after) => onSplitText(section.id, before, after)}
            onEmptyBackspace={onRemove}
            onActivity={onActivity}
          />
        ) : null}
        {isListSection(section) ? (
          <ListSectionBody
            section={section}
            projectId={projectId}
            focusId={focusId}
            handlersRef={handlersRef}
            onActivity={onActivity}
            onReplace={onReplace}
            onFocusTarget={onFocusTarget}
            onRemoveSection={onRemove}
          />
        ) : null}
        {section.type === 'code' ? (
          <Input.TextArea
            value={section.text}
            autoSize={{ minRows: 3, maxRows: 16 }}
            className="docs-code-input"
            aria-label={t('code', { defaultValue: 'Code' })}
            placeholder={t('codePlaceholder', { defaultValue: 'Write code' })}
            autoFocus={focusId === section.id}
            onChange={event => onReplace({ ...section, text: event.target.value })}
          />
        ) : null}
        {section.type === 'divider' ? <hr className="docs-section-divider" /> : null}
      </div>
      <Tooltip title={t('removeSection', { defaultValue: 'Remove section' })}>
        <button
          type="button"
          className="docs-section-remove"
          aria-label={t('removeSection', { defaultValue: 'Remove section' })}
          onClick={onRemove}
        >
          <DeleteOutlined />
        </button>
      </Tooltip>
    </div>
  );
};

interface ListSectionBodyProps {
  section: IListSection;
  projectId: string;
  focusId: string | null;
  handlersRef: MutableRefObject<MentionHandlers>;
  onActivity: (editor: TiptapEditor) => void;
  onReplace: (section: IDocumentSection) => void;
  onFocusTarget: (id: string) => void;
  onRemoveSection: () => void;
}

const ListSectionBody = ({
  section,
  projectId,
  focusId,
  handlersRef,
  onActivity,
  onReplace,
  onFocusTarget,
  onRemoveSection,
}: ListSectionBodyProps) => {
  const { t } = useTranslation('project-view-docs');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const updateItems = (items: IListItem[], focusItemId?: string) => {
    onReplace({ ...section, items });
    if (focusItemId) onFocusTarget(focusItemId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (!overId || overId === event.active.id) return;
    const from = section.items.findIndex(item => item.id === event.active.id);
    const to = section.items.findIndex(item => item.id === overId);
    if (from < 0 || to < 0) return;
    updateItems(arrayMove(section.items, from, to));
  };

  const splitItem = (itemId: string, before: IDocumentNode[], after: IDocumentNode[]) => {
    const index = section.items.findIndex(item => item.id === itemId);
    const current = section.items[index];
    if (!current) return;
    const created: IListItem = {
      id: crypto.randomUUID(),
      content: after,
      ...(section.type === 'checklist' ? { checked: false } : {}),
    };
    const next = section.items.slice();
    next[index] = { ...current, content: before };
    next.splice(index + 1, 0, created);
    updateItems(next, created.id);
  };

  const removeItem = (itemId: string) => {
    if (section.items.length === 1) {
      onRemoveSection();
      return;
    }
    const index = section.items.findIndex(item => item.id === itemId);
    const previous = section.items[index - 1];
    updateItems(
      section.items.filter(item => item.id !== itemId),
      previous?.id
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={section.items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <div className={section.type === 'numberedList' ? 'docs-list is-numbered' : 'docs-list'} role="list">
          {section.items.map((item, index) => (
            <ListItemRow
              key={item.id}
              item={item}
              index={index}
              section={section}
              projectId={projectId}
              focusId={focusId}
              handlersRef={handlersRef}
              onActivity={onActivity}
              onChange={next => updateItems(section.items.map(current => (current.id === item.id ? next : current)))}
              onSplit={(before, after) => splitItem(item.id, before, after)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      </SortableContext>
      <button
        type="button"
        className="docs-add-item"
        onClick={() => {
          const created: IListItem = {
            id: crypto.randomUUID(),
            content: [],
            ...(section.type === 'checklist' ? { checked: false } : {}),
          };
          updateItems([...section.items, created], created.id);
        }}
      >
        <PlusOutlined />
        {t('addListItem', { defaultValue: 'Add item' })}
      </button>
    </DndContext>
  );
};

interface ListItemRowProps {
  item: IListItem;
  index: number;
  section: IListSection;
  projectId: string;
  focusId: string | null;
  handlersRef: MutableRefObject<MentionHandlers>;
  onActivity: (editor: TiptapEditor) => void;
  onChange: (item: IListItem) => void;
  onSplit: (before: IDocumentNode[], after: IDocumentNode[]) => void;
  onRemove: () => void;
}

const ListItemRow = ({
  item,
  index,
  section,
  projectId,
  focusId,
  handlersRef,
  onActivity,
  onChange,
  onSplit,
  onRemove,
}: ListItemRowProps) => {
  const { t } = useTranslation('project-view-docs');
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      className="docs-list-item"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Tooltip title={t('dragListItem', { defaultValue: 'Drag to reorder item' })}>
        <button
          type="button"
          className="docs-section-handle"
          aria-label={t('dragListItem', { defaultValue: 'Drag to reorder item' })}
          {...attributes}
          {...listeners}
        >
          <HolderOutlined />
        </button>
      </Tooltip>
      {section.type === 'checklist' ? (
        <Checkbox
          checked={item.checked === true}
          aria-label={t('toggleItem', { defaultValue: 'Toggle to-do' })}
          onChange={event => onChange({ ...item, checked: event.target.checked })}
        />
      ) : (
        <span className="docs-list-marker" aria-hidden="true">
          {section.type === 'numberedList' ? `${index + 1}.` : '•'}
        </span>
      )}
      <DocsInlineEditor
        fieldKey={item.id}
        projectId={projectId}
        content={item.content}
        placeholder={t('listItem', { defaultValue: 'List item' })}
        ariaLabel={t('listItem', { defaultValue: 'List item' })}
        className="docs-inline docs-inline-item"
        autoFocus={focusId === item.id}
        handlersRef={handlersRef}
        onChange={inline => onChange({ ...item, content: inline })}
        onSplit={onSplit}
        onEmptyBackspace={onRemove}
        onActivity={onActivity}
      />
      <Tooltip title={t('removeListItem', { defaultValue: 'Remove item' })}>
        <button
          type="button"
          className="docs-section-remove"
          aria-label={t('removeListItem', { defaultValue: 'Remove item' })}
          onClick={onRemove}
        >
          <DeleteOutlined />
        </button>
      </Tooltip>
    </div>
  );
};

export default DocsSectionList;
