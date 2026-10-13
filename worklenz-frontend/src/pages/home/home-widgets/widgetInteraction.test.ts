import { describe, expect, it } from 'vitest';
import {
  isWidgetDataTarget,
  isWidgetDragSourceTarget,
  isWidgetSurfaceTarget,
  parseDragId,
  resolveDropTarget,
  toMenuDragId,
  WIDGET_DATA_ATTRIBUTE,
  WIDGET_DRAG_SOURCE_ATTRIBUTE,
  WIDGET_ID_ATTRIBUTE,
  type MeasuredColumn,
} from './widgetInteraction';

const html = (markup: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host;
};

describe('isWidgetDataTarget', () => {
  it('treats anything marked as data, and anything inside it, as data', () => {
    const host = html(`<div ${WIDGET_DATA_ATTRIBUTE}><span><b id="deep">42</b></span></div><p id="plain">hi</p>`);
    expect(isWidgetDataTarget(host.querySelector('#deep'))).toBe(true);
    expect(isWidgetDataTarget(host.querySelector('[data-widget-data]'))).toBe(true);
    expect(isWidgetDataTarget(host.querySelector('#plain'))).toBe(false);
  });

  it.each([
    '<button id="t">x</button>',
    '<a id="t" href="/x">x</a>',
    '<input id="t" />',
    '<textarea id="t"></textarea>',
    '<select id="t"></select>',
    '<label id="t">x</label>',
    '<div id="t" role="button">x</div>',
    '<div id="t" role="tab">x</div>',
    '<div id="t" role="checkbox">x</div>',
    '<div id="t" contenteditable="true">x</div>',
  ])('treats an interactive control as data: %s', markup => {
    expect(isWidgetDataTarget(html(markup).querySelector('#t'))).toBe(true);
  });

  it('treats a plain link without an href, and non-editable content, as whitespace', () => {
    expect(isWidgetDataTarget(html('<a id="t">x</a>').querySelector('#t'))).toBe(false);
    expect(isWidgetDataTarget(html('<div id="t" contenteditable="false">x</div>').querySelector('#t'))).toBe(false);
  });

  it('is false for anything that is not an element', () => {
    expect(isWidgetDataTarget(null)).toBe(false);
    expect(isWidgetDataTarget(document)).toBe(false);
  });
});

describe('isWidgetSurfaceTarget', () => {
  const widget = html(`
    <div ${WIDGET_ID_ATTRIBUTE}="todo">
      <h3 id="header">Title</h3>
      <div id="whitespace"></div>
      <ul ${WIDGET_DATA_ATTRIBUTE} id="data"><li id="row">row</li></ul>
      <button id="action">menu</button>
    </div>
    <div id="outside"></div>`);

  it('is true for a header and for whitespace inside a widget', () => {
    expect(isWidgetSurfaceTarget(widget.querySelector('#header'))).toBe(true);
    expect(isWidgetSurfaceTarget(widget.querySelector('#whitespace'))).toBe(true);
    expect(isWidgetSurfaceTarget(widget.querySelector('[data-home-widget-id]'))).toBe(true);
  });

  it('is false for data and controls inside the widget', () => {
    expect(isWidgetSurfaceTarget(widget.querySelector('#data'))).toBe(false);
    expect(isWidgetSurfaceTarget(widget.querySelector('#row'))).toBe(false);
    expect(isWidgetSurfaceTarget(widget.querySelector('#action'))).toBe(false);
  });

  it('is false outside any widget, such as a dropdown portalled to the body', () => {
    expect(isWidgetSurfaceTarget(widget.querySelector('#outside'))).toBe(false);
  });
});

describe('isWidgetDragSourceTarget', () => {
  const menu = html(`
    <ul role="menu">
      <li role="menuitem" id="row"><div ${WIDGET_DRAG_SOURCE_ATTRIBUTE}><span id="text">Team members</span></div></li>
      <li role="menuitem" id="other"><span id="plain">Greeting banner</span></li>
    </ul>`);

  it('is true for a draggable row and anything inside it', () => {
    expect(isWidgetDragSourceTarget(menu.querySelector(`[${WIDGET_DRAG_SOURCE_ATTRIBUTE}]`))).toBe(true);
    expect(isWidgetDragSourceTarget(menu.querySelector('#text'))).toBe(true);
  });

  it('is false for a row that is not draggable, and for anything that is not an element', () => {
    expect(isWidgetDragSourceTarget(menu.querySelector('#plain'))).toBe(false);
    expect(isWidgetDragSourceTarget(menu.querySelector('#other'))).toBe(false);
    expect(isWidgetDragSourceTarget(null)).toBe(false);
  });
});

describe('drag ids', () => {
  it('reads a widget on the page by its own id', () => {
    expect(parseDragId('todo')).toEqual({ widgetId: 'todo', source: 'board' });
    expect(parseDragId('progress-donut')).toEqual({ widgetId: 'progress-donut', source: 'board' });
  });

  it('reads a menu row by its prefixed id', () => {
    expect(parseDragId(toMenuDragId('mentions'))).toEqual({ widgetId: 'mentions', source: 'menu' });
  });

  it('tells the same widget apart depending on where it was picked up', () => {
    expect(toMenuDragId('todo')).not.toBe('todo');
    expect(parseDragId(toMenuDragId('todo'))?.source).toBe('menu');
    expect(parseDragId('todo')?.source).toBe('board');
  });

  it('rejects ids that are not widgets, including the greeting banner, which is never dragged', () => {
    expect(parseDragId('nope')).toBeNull();
    expect(parseDragId(toMenuDragId('greeting'))).toBeNull();
    expect(parseDragId('add:')).toBeNull();
    expect(parseDragId(7)).toBeNull();
  });
});

describe('resolveDropTarget', () => {
  const rect = (top: number, bottom: number, left: number, right: number) => ({ top, bottom, left, right });
  // main: x 0-600, stat-cards 0-100, priorities 112-612. side: x 616-936, progress 0-200, todo 212-300.
  const columns: MeasuredColumn[] = [
    {
      column: 'main',
      rect: rect(0, 612, 0, 600),
      widgets: [
        { id: 'stat-cards', rect: rect(0, 100, 0, 600) },
        { id: 'priorities', rect: rect(112, 612, 0, 600) },
      ],
    },
    {
      column: 'side',
      rect: rect(0, 612, 616, 936),
      widgets: [
        { id: 'progress-donut', rect: rect(0, 200, 616, 936) },
        { id: 'todo', rect: rect(212, 300, 616, 936) },
      ],
    },
  ];
  const BOTH = ['main', 'side'] as const;

  it('lands before a widget when the pointer is in its upper half, after it in the lower half', () => {
    expect(resolveDropTarget({ x: 700, y: 20 }, columns, 'continue', BOTH)).toEqual({
      column: 'side',
      targetId: 'progress-donut',
      position: 'before',
    });
    expect(resolveDropTarget({ x: 700, y: 180 }, columns, 'continue', BOTH)).toEqual({
      column: 'side',
      targetId: 'progress-donut',
      position: 'after',
    });
  });

  it('picks the nearest widget when the pointer is in the gap between two', () => {
    expect(resolveDropTarget({ x: 700, y: 204 }, columns, 'continue', BOTH)).toMatchObject({
      targetId: 'progress-donut',
      position: 'after',
    });
    expect(resolveDropTarget({ x: 700, y: 209 }, columns, 'continue', BOTH)).toMatchObject({
      targetId: 'todo',
      position: 'before',
    });
  });

  it('lands after the last widget when the pointer is below the column', () => {
    expect(resolveDropTarget({ x: 700, y: 900 }, columns, 'continue', BOTH)).toEqual({
      column: 'side',
      targetId: 'todo',
      position: 'after',
    });
  });

  it('lands before the first widget when the pointer is above the column', () => {
    expect(resolveDropTarget({ x: 100, y: -40 }, columns, 'continue', BOTH)).toEqual({
      column: 'main',
      targetId: 'stat-cards',
      position: 'before',
    });
  });

  it('never targets the widget being dragged', () => {
    // Pointer is over the dragged widget itself: the nearest other widget is used instead.
    const result = resolveDropTarget({ x: 700, y: 250 }, columns, 'todo', BOTH);
    expect(result).toMatchObject({ column: 'side', targetId: 'progress-donut', position: 'after' });
  });

  it('lands at the end of a column with nothing else in it', () => {
    const emptySide: MeasuredColumn[] = [columns[0], { column: 'side', rect: rect(0, 612, 616, 936), widgets: [] }];
    expect(resolveDropTarget({ x: 700, y: 50 }, emptySide, 'continue', BOTH)).toEqual({
      column: 'side',
      targetId: null,
      position: 'after',
    });
    const onlySelf: MeasuredColumn[] = [columns[0], { ...columns[1], widgets: [columns[1].widgets[1]] }];
    expect(resolveDropTarget({ x: 700, y: 50 }, onlySelf, 'todo', BOTH)).toMatchObject({ targetId: null });
  });

  it('snaps to the nearest column across the gap between columns, but not from far away', () => {
    expect(resolveDropTarget({ x: 608, y: 50 }, columns, 'continue', BOTH)?.column).toBe('main');
    expect(resolveDropTarget({ x: 612, y: 50 }, columns, 'continue', BOTH)?.column).toBe('side');
    expect(resolveDropTarget({ x: 1200, y: 50 }, columns, 'continue', BOTH)).toBeNull();
    expect(resolveDropTarget({ x: -80, y: 50 }, columns, 'continue', BOTH)).toBeNull();
  });

  it('returns nothing for a column the widget may not sit in', () => {
    expect(resolveDropTarget({ x: 700, y: 50 }, columns, 'priorities', ['main'])).toBeNull();
    expect(resolveDropTarget({ x: 100, y: 50 }, columns, 'priorities', ['main'])).not.toBeNull();
  });

  it('returns nothing when there are no columns', () => {
    expect(resolveDropTarget({ x: 10, y: 10 }, [], 'todo', BOTH)).toBeNull();
  });
});
