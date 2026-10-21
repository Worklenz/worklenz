import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  addWidget,
  DEFAULT_HOME_LAYOUT,
  removeSection,
  setSectionHidden,
  type HomeLayout,
  type HomeWidgetId,
} from '../home-layout/homeLayout';
import { AddWidgetButton } from './AddWidgetButton';
import { HomeGreetingFrame } from './HomeGreetingFrame';
import { HomeWidgetBoard } from './HomeWidgetBoard';
import { HomeWidgetMenuButton } from './HomeWidgetMenuButton';

// No i18n instance in tests: resolve each key to its `defaultValue`, interpolating {{vars}}.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? ''),
  }),
}));

// A stand-in for a widget's own content: a header carrying the "..." menu, like the real ones.
const renderWidget = (id: HomeWidgetId) => (
  <div>
    <span>{`content of ${id}`}</span>
    <HomeWidgetMenuButton />
  </div>
);

/** Renders the board with its layout held in state, so a menu action is seen taking effect. */
const BoardHarness = ({
  initial,
  isDesktop = true,
  onChange,
}: {
  initial: HomeLayout;
  isDesktop?: boolean;
  onChange?: (layout: HomeLayout) => void;
}) => {
  const [layout, setLayout] = useState(initial);
  return (
    <HomeWidgetBoard
      layout={layout}
      isDesktop={isDesktop}
      justAddedId={null}
      renderWidget={renderWidget}
      onLayoutChange={next => {
        onChange?.(next);
        setLayout(next);
      }}
    />
  );
};

const shown = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-home-widget-id]')).map(el => el.getAttribute('data-home-widget-id'));

const column = (container: HTMLElement, name: 'main' | 'side') =>
  Array.from(container.querySelectorAll(`[data-home-column="${name}"] > [data-home-widget-id]`)).map(el =>
    el.getAttribute('data-home-widget-id')
  );

const openMenu = async (user: ReturnType<typeof userEvent.setup>, title: string) =>
  user.click(screen.getByRole('button', { name: `${title} options` }));

describe('HomeWidgetBoard', () => {
  it('lays the visible widgets out in their two columns, leaving hidden ones off', () => {
    const layout = setSectionHidden(DEFAULT_HOME_LAYOUT, 'progress-donut', true);
    const { container } = render(<BoardHarness initial={layout} />);
    expect(column(container, 'main')).toEqual(['stat-cards', 'priorities']);
    expect(column(container, 'side')).toEqual(['todo']);
  });

  it('gives every widget a "..." menu named after it', () => {
    render(<BoardHarness initial={addWidget(DEFAULT_HOME_LAYOUT, 'continue')} />);
    for (const title of ['Task priorities', 'Summary cards', 'My progress', 'Continue where you left off']) {
      expect(screen.getByRole('button', { name: `${title} options` })).toBeInTheDocument();
    }
  });

  it('offers only "move to the other column" and "Remove widget", never Move up or Move down', async () => {
    const user = userEvent.setup();
    render(<BoardHarness initial={DEFAULT_HOME_LAYOUT} />);

    await openMenu(user, 'My progress');
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Move to main area',
      'Remove widget',
    ]);
    expect(screen.queryByRole('menuitem', { name: /Move up|Move down/ })).toBeNull();
  });

  it('offers just "Remove widget", with nothing to separate it from, to a widget that cannot change column', async () => {
    const user = userEvent.setup();
    render(<BoardHarness initial={DEFAULT_HOME_LAYOUT} />);

    await openMenu(user, 'Summary cards');
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Remove widget']);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('shows Remove widget as a red danger action with a trash icon, not a cross', async () => {
    const user = userEvent.setup();
    render(<BoardHarness initial={DEFAULT_HOME_LAYOUT} />);

    await openMenu(user, 'My progress');
    const remove = screen.getByRole('menuitem', { name: /Remove widget/ });
    expect(remove).toHaveClass('ant-dropdown-menu-item-danger');
    expect(remove.querySelector('.anticon-delete')).not.toBeNull();
    expect(remove.querySelector('.anticon-close')).toBeNull();
    // Decorative: the item is still just "Remove widget" to assistive tech.
    expect(remove.querySelector('.anticon-delete')).toHaveAttribute('aria-hidden', 'true');
  });

  it('sends a widget to the other column from its menu', async () => {
    const user = userEvent.setup();
    const { container } = render(<BoardHarness initial={DEFAULT_HOME_LAYOUT} />);

    await openMenu(user, 'My todo list');
    await user.click(screen.getByRole('menuitem', { name: /Move to main area/ }));

    expect(column(container, 'main')).toEqual(['todo', 'stat-cards', 'priorities']);
    expect(column(container, 'side')).toEqual(['progress-donut']);
  });

  it('takes an optional widget off the page when it is removed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<BoardHarness initial={addWidget(DEFAULT_HOME_LAYOUT, 'continue')} onChange={onChange} />);
    expect(shown(container)).toContain('continue');

    await openMenu(user, 'Continue where you left off');
    await user.click(screen.getByRole('menuitem', { name: /Remove widget/ }));

    expect(shown(container)).not.toContain('continue');
    expect(onChange.mock.calls[0][0]).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('only hides a core widget when it is removed, so it can come back where it was', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BoardHarness initial={DEFAULT_HOME_LAYOUT} onChange={onChange} />);

    await openMenu(user, 'My progress');
    await user.click(screen.getByRole('menuitem', { name: /Remove widget/ }));

    expect(onChange.mock.calls[0][0].hidden).toEqual(['progress-donut']);
    expect(onChange.mock.calls[0][0].columns).toEqual(DEFAULT_HOME_LAYOUT.columns);
  });

  it('removes Task priorities like any other widget: hidden, so it can come back where it was', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<BoardHarness initial={DEFAULT_HOME_LAYOUT} onChange={onChange} />);

    await openMenu(user, 'Task priorities');
    const remove = screen.getByRole('menuitem', { name: /Remove widget/ });
    expect(remove).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(remove);

    expect(onChange.mock.calls[0][0].hidden).toEqual(['priorities']);
    expect(onChange.mock.calls[0][0].columns).toEqual(DEFAULT_HOME_LAYOUT.columns);
    expect(shown(container)).not.toContain('priorities');
  });

  it('stacks everything in one column on a small screen, with the menu still there and no grip', async () => {
    const user = userEvent.setup();
    const { container } = render(<BoardHarness initial={DEFAULT_HOME_LAYOUT} isDesktop={false} />);

    expect(container.querySelector('[data-home-column]')).toBeNull();
    expect(shown(container)).toEqual(['stat-cards', 'priorities', 'progress-donut', 'todo']);
    expect(container.querySelector('.home-widget__grip')).toBeNull();

    await openMenu(user, 'My progress');
    await user.click(screen.getByRole('menuitem', { name: /Remove widget/ }));
    expect(shown(container)).toEqual(['stat-cards', 'priorities', 'todo']);
  });

  it('shows the grip on every widget of a desktop board', () => {
    const { container } = render(<BoardHarness initial={DEFAULT_HOME_LAYOUT} />);
    expect(container.querySelectorAll('.home-widget__grip')).toHaveLength(4);
  });

  it('marks the pointer as on the drag surface over whitespace but not over data', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HomeWidgetBoard
        layout={DEFAULT_HOME_LAYOUT}
        isDesktop
        justAddedId={null}
        onLayoutChange={() => {}}
        renderWidget={id => (
          <div>
            <h3>{`title of ${id}`}</h3>
            <ul data-widget-data>
              <li>{`row of ${id}`}</li>
            </ul>
          </div>
        )}
      />
    );
    const widget = container.querySelector('[data-home-widget-id="progress-donut"]') as HTMLElement;

    await user.hover(within(widget).getByText('title of progress-donut'));
    expect(widget).toHaveClass('is-surface');

    await user.hover(within(widget).getByText('row of progress-donut'));
    expect(widget).not.toHaveClass('is-surface');

    await user.hover(within(widget).getByText('title of progress-donut'));
    expect(widget).toHaveClass('is-surface');

    await user.unhover(widget);
    expect(widget).not.toHaveClass('is-surface');
  });
});

describe('HomeWidgetBoard with no widgets', () => {
  const nothingShown = ['stat-cards', 'priorities', 'progress-donut', 'todo'].reduce(
    (layout, id) => setSectionHidden(layout, id as HomeWidgetId, true),
    DEFAULT_HOME_LAYOUT
  );
  const renderEmpty = (props: { isDesktop?: boolean; onAddSection?: (id: string) => void } = {}) =>
    render(
      <HomeWidgetBoard
        layout={nothingShown}
        isDesktop={props.isDesktop ?? true}
        justAddedId={null}
        renderWidget={renderWidget}
        onLayoutChange={() => {}}
        onAddSection={props.onAddSection ?? (() => {})}
      />
    );

  it('shows where to add widgets from, with the greeting banner not counting as one', () => {
    renderEmpty();
    expect(screen.getByText('Drag and drop new widgets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add widgets' })).toBeInTheDocument();
  });

  it('does not talk of dragging on a small screen', () => {
    renderEmpty({ isDesktop: false });
    expect(screen.queryByText('Drag and drop new widgets')).toBeNull();
    expect(screen.getByText('Add widgets to your Home page')).toBeInTheDocument();
  });

  it('is not there while any widget is', () => {
    render(
      <HomeWidgetBoard
        layout={setSectionHidden(nothingShown, 'todo', false)}
        isDesktop
        justAddedId={null}
        renderWidget={renderWidget}
        onLayoutChange={() => {}}
        onAddSection={() => {}}
      />
    );
    expect(screen.queryByText('Drag and drop new widgets')).toBeNull();
  });

  it('opens the same Add panel, and adds what is pressed', async () => {
    const user = userEvent.setup();
    const onAddSection = vi.fn();
    renderEmpty({ onAddSection });
    await user.click(screen.getByRole('button', { name: 'Add widgets' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Add Task priorities' }));
    expect(onAddSection).toHaveBeenCalledWith('priorities');
  });
});

describe('HomeGreetingFrame', () => {
  it('gives the greeting banner a "..." menu whose only action is Remove widget', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <HomeGreetingFrame onRemove={onRemove}>
        <div>Good afternoon</div>
      </HomeGreetingFrame>
    );
    expect(screen.getByText('Good afternoon')).toBeInTheDocument();

    await openMenu(user, 'Greeting banner');
    const items = screen.getAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual(['Remove widget']);
    expect(items[0]).not.toHaveAttribute('aria-disabled', 'true');

    await user.click(items[0]);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('is not a drag surface: no grip, and nothing to pick it up by', () => {
    const { container } = render(
      <HomeGreetingFrame onRemove={() => {}}>
        <div>Good afternoon</div>
      </HomeGreetingFrame>
    );
    expect(container.querySelector('.home-widget__grip')).toBeNull();
    expect(container.querySelector('[data-home-widget-id]')).toBeNull();
  });
});

describe('AddWidgetButton', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Add widget' }));
  const rows = () => screen.getAllByRole('listitem');
  const addButton = (name: string) => screen.getByRole('button', { name: `Add ${name}` });

  it('lists the widgets in a panel rather than a menu, each with its own Add button', async () => {
    const user = userEvent.setup();
    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add widget' })).toHaveAttribute('aria-expanded', 'false');
    await open(user);

    expect(screen.getByRole('button', { name: 'Add widget' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(rows()).toHaveLength(4);
    for (const name of ["Team members", 'Tasks assigned by me', 'Comments mentioning me', 'Continue where you left off']) {
      expect(addButton(name)).toHaveTextContent('Add');
    }
  });

  it('offers the greeting banner first once it has been removed, and adds it back with its Add button', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddWidgetButton layout={removeSection(DEFAULT_HOME_LAYOUT, 'greeting')} onAdd={onAdd} />);
    await open(user);

    expect(rows()).toHaveLength(5);
    expect(rows()[0].textContent).toContain('Greeting banner');
    expect(rows()[0].textContent).toContain("today's date");

    await user.click(addButton('Greeting banner'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('greeting');
  });

  it('adds nothing when a widget name, description or row is clicked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={onAdd} isDragEnabled />);
    await open(user);

    await user.click(screen.getByText('Team members'));
    await user.click(screen.getByText(/See who is on your team/));
    await user.click(rows()[0]);
    await user.dblClick(screen.getByText('Continue where you left off'));

    expect(onAdd).not.toHaveBeenCalled();
    // The panel is still there to read from.
    expect(rows()).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Add widget' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('carries keyboard focus into the panel when it opens, and back to the button on Escape', async () => {
    const user = userEvent.setup();
    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Add widget' });

    await user.click(trigger);
    await waitFor(() => expect(addButton('Team members')).toHaveFocus());

    await user.keyboard('{Tab}');
    expect(addButton('Tasks assigned by me')).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(trigger).toHaveFocus();
  });

  it('adds with the keyboard too, and puts focus back on the button', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={onAdd} />);
    const trigger = screen.getByRole('button', { name: 'Add widget' });

    await user.click(trigger);
    await waitFor(() => expect(addButton('Team members')).toHaveFocus());
    await user.keyboard('{Tab}{Enter}');

    expect(onAdd).toHaveBeenCalledWith('assigned-by-me');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('adds only the widget whose Add button is pressed, and then closes', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={onAdd} />);
    await open(user);

    await user.click(addButton('Continue where you left off'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('continue');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add widget' })).toHaveAttribute('aria-expanded', 'false'));
  });

  it('makes each widget draggable, and says so, only when dragging is on', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={() => {}} isDragEnabled />);
    await open(user);

    expect(screen.getByText('Press Add, or drag a widget onto your page.')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-home-widget-drag-source]')).toHaveLength(4);
    // The hint is not a row, so there are still exactly the four widgets to pick from.
    expect(rows()).toHaveLength(4);
    unmount();

    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={() => {}} isDragEnabled={false} />);
    await open(user);
    expect(screen.queryByText('Press Add, or drag a widget onto your page.')).toBeNull();
    expect(document.querySelectorAll('[data-home-widget-drag-source]')).toHaveLength(0);
  });

  it('keeps the Add button outside the part that is dragged, so pressing it can never start a drag', async () => {
    const user = userEvent.setup();
    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={() => {}} isDragEnabled />);
    await open(user);

    for (const row of rows()) {
      const handle = row.querySelector('[data-home-widget-drag-source]') as HTMLElement;
      expect(handle).not.toBeNull();
      expect(handle.querySelector('button')).toBeNull();
      expect(within(row).getByRole('button').closest('[data-home-widget-drag-source]')).toBeNull();
    }
  });

  it('never makes the greeting banner draggable: it is added at the top, not placed', async () => {
    const user = userEvent.setup();
    render(
      <AddWidgetButton layout={removeSection(DEFAULT_HOME_LAYOUT, 'greeting')} onAdd={() => {}} isDragEnabled />
    );
    await open(user);

    const [greeting, ...widgets] = rows();
    expect(greeting.querySelector('[data-home-widget-drag-source]')).toBeNull();
    // It can still be added, with its button.
    expect(within(greeting).getByRole('button', { name: 'Add Greeting banner' })).toBeInTheDocument();
    for (const widget of widgets) expect(widget.querySelector('[data-home-widget-drag-source]')).not.toBeNull();
  });

  it('does not offer the greeting banner while it is on the page', async () => {
    const user = userEvent.setup();
    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={() => {}} />);
    await open(user);

    expect(rows()).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Add Greeting banner/ })).toBeNull();
  });

  it('lists every widget that is not on the page, with what it does', async () => {
    const user = userEvent.setup();
    render(<AddWidgetButton layout={DEFAULT_HOME_LAYOUT} onAdd={() => {}} />);
    await open(user);

    const items = rows().map(item => item.textContent);
    expect(items).toHaveLength(4);
    expect(items[0]).toContain('Team members');
    expect(items[1]).toContain('Tasks assigned by me');
    expect(items[2]).toContain('Comments mentioning me');
    expect(items[2]).toContain('@mentioned you');
    expect(items[3]).toContain('Continue where you left off');
  });

  it('offers a core widget again once it has been hidden', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddWidgetButton layout={setSectionHidden(DEFAULT_HOME_LAYOUT, 'todo', true)} onAdd={onAdd} />);
    await open(user);

    expect(rows()[0].textContent).toContain('My todo list');
    await user.click(addButton('My todo list'));
    expect(onAdd).toHaveBeenCalledWith('todo');
  });

  it('says so when there is nothing left to add', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const everything = (['team-members', 'assigned-by-me', 'mentions', 'continue'] as const).reduce(
      addWidget,
      DEFAULT_HOME_LAYOUT
    );
    render(<AddWidgetButton layout={everything} onAdd={onAdd} isDragEnabled />);
    await open(user);

    expect(screen.getByText('Every widget is already on your Home page.')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByText('Press Add, or drag a widget onto your page.')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
