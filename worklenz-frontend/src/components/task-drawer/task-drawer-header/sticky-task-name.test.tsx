import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { StickyTaskName } from './sticky-task-name';

/* -------------------------------------------------------------------------- */
/* rAF harness                                                                */
/* -------------------------------------------------------------------------- */
/**
 * We replace requestAnimationFrame with a controllable queue. Tests flush it
 * deterministically via flushRaf() instead of racing the real frame loop.
 * cancelAnimationFrame deletes from the same queue so we can assert cleanup.
 */
let rafQueue: Map<number, FrameRequestCallback>;
let rafNextId: number;

function flushRaf() {
  const pending = Array.from(rafQueue.entries());
  rafQueue.clear();
  for (const [, cb] of pending) cb(performance.now());
}

/* -------------------------------------------------------------------------- */
/* jsdom helpers                                                              */
/* -------------------------------------------------------------------------- */
/**
 * jsdom does not implement layout, so HTMLElement.scrollTop always reads 0.
 * We install a backing store on the scroller so the component's
 * `scroller.scrollTop` reads/writes behave like a real scrollable element.
 */
function installScrollTop(el: HTMLElement) {
  let top = 0;
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: v => {
      top = v;
    },
  });
}

function getScroller(): HTMLElement {
  return document.querySelector('.ant-drawer-body') as HTMLElement;
}

/**
 * The mirror div is the only node in the tree with aria-hidden="true".
 * Query it fresh each time so the assertions always target the current DOM.
 */
function getMirror(container: HTMLElement): HTMLElement {
  return container.querySelector('[aria-hidden="true"]') as HTMLElement;
}

/* -------------------------------------------------------------------------- */
/* Setup / teardown                                                           */
/* -------------------------------------------------------------------------- */
beforeAll(() => {
  // antd Tooltip (and friends) probe matchMedia during render. jsdom has no
  // implementation, so stub it once for the whole file.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

beforeEach(() => {
  rafQueue = new Map();
  rafNextId = 0;

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    const id = ++rafNextId;
    rafQueue.set(id, cb);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    rafQueue.delete(id);
  });

  // The drawer shell the component looks up via closest() / querySelector().
  document.body.innerHTML = `
    <div class="ant-drawer-content-wrapper">
      <div class="ant-drawer-body"></div>
    </div>
  `;

  installScrollTop(getScroller());
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/* -------------------------------------------------------------------------- */
/* Test helpers                                                               */
/* -------------------------------------------------------------------------- */
type RenderOpts = {
  name?: string | null;
  enterThreshold?: number;
  exitThreshold?: number;
};

function renderSticky(opts: RenderOpts = {}) {
  const scroller = getScroller();
  const utils = render(<StickyTaskName {...opts} />, { container: scroller });
  // Flush the first attach() rAF in case the mount effect deferred the
  // listener registration (it does when the drawer body mounts late).
  act(() => {
    flushRaf();
  });
  return { ...utils, scroller };
}

/**
 * Simulate a scroll: set scrollTop, dispatch the event the component listens
 * for, then flush the rAF that handler scheduled.
 */
function scrollTo(scroller: HTMLElement, top: number) {
  scroller.scrollTop = top;
  act(() => {
    scroller.dispatchEvent(new Event('scroll'));
  });
  act(() => {
    flushRaf();
  });
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */
describe('StickyTaskName', () => {
  it('starts hidden before the user scrolls', () => {
    const { container } = renderSticky({ name: 'My Task' });
    const mirror = getMirror(container);

    expect(mirror).toBeTruthy();
    expect(mirror.style.visibility).toBe('hidden');
    expect(mirror.style.opacity).toBe('0');
  });

  it('renders nothing inside the mirror when name is empty', () => {
    const { container } = renderSticky({ name: null });
    const mirror = getMirror(container);

    expect(mirror.textContent).toBe('');
    expect(mirror.style.visibility).toBe('hidden');
  });

  it('becomes visible once scrollTop passes enterThreshold', () => {
    const { container, scroller } = renderSticky({
      name: 'My Task',
      enterThreshold: 70,
      exitThreshold: 30,
    });

    scrollTo(scroller, 100);

    const mirror = getMirror(container);
    expect(mirror.style.visibility).toBe('visible');
    expect(mirror.style.opacity).toBe('1');
  });

  it('stays hidden at exactly the enterThreshold boundary', () => {
    const { container, scroller } = renderSticky({
      name: 'My Task',
      enterThreshold: 70,
      exitThreshold: 30,
    });

    // scrollTop === enterThreshold, and the check is `> enterThreshold`.
    scrollTo(scroller, 70);

    expect(getMirror(container).style.visibility).toBe('hidden');
  });

  it('keeps the name visible inside the hysteresis band (exit..enter)', () => {
    const { container, scroller } = renderSticky({
      name: 'My Task',
      enterThreshold: 70,
      exitThreshold: 30,
    });

    scrollTo(scroller, 100);
    expect(getMirror(container).style.visibility).toBe('visible');

    // Below enterThreshold but still above exitThreshold: hysteresis keeps it
    // visible instead of flickering back to hidden.
    scrollTo(scroller, 50);
    expect(getMirror(container).style.visibility).toBe('visible');
  });

  it('hides again only after scrollTop drops below exitThreshold', () => {
    const { container, scroller } = renderSticky({
      name: 'My Task',
      enterThreshold: 70,
      exitThreshold: 30,
    });

    scrollTo(scroller, 100);
    expect(getMirror(container).style.visibility).toBe('visible');

    scrollTo(scroller, 20);
    const mirror = getMirror(container);
    expect(mirror.style.visibility).toBe('hidden');
    expect(mirror.style.opacity).toBe('0');
  });

  it('does not flicker while scrollTop oscillates inside the hysteresis band', () => {
    const { container, scroller } = renderSticky({
      name: 'My Task',
      enterThreshold: 70,
      exitThreshold: 30,
    });

    scrollTo(scroller, 100);

    // Bounce around inside (30, 70] — the mirror must never leave the visible
    // state during the oscillation.
    for (const top of [60, 40, 55, 35, 65, 45, 32]) {
      scrollTo(scroller, top);
      expect(getMirror(container).style.visibility).toBe('visible');
    }

    // Cross below the exit threshold — only now it should hide.
    scrollTo(scroller, 25);
    expect(getMirror(container).style.visibility).toBe('hidden');
  });

  it('re-applies visibility and refreshes the label when the name changes', () => {
    const { container, scroller, rerender } = renderSticky({
      name: 'First name',
      enterThreshold: 70,
      exitThreshold: 30,
    });

    scrollTo(scroller, 100);
    expect(getMirror(container).style.visibility).toBe('visible');

    // The effect depends on `name`, so this tears the old listener down and
    // re-attaches against the same scroller.
    act(() => {
      rerender(
        <StickyTaskName name="Second name" enterThreshold={70} exitThreshold={30} />
      );
    });
    act(() => {
      flushRaf();
    });

    expect(screen.getByText('Second name')).toBeInTheDocument();
    // Because scrollTop is still 100, attach() must re-apply the visible state.
    expect(getMirror(container).style.visibility).toBe('visible');
  });

  it('coalesces multiple scroll events into a single rAF', () => {
    const { scroller } = renderSticky({ name: 'My Task' });
    const before = rafQueue.size; // should be 0 after attach flush

    scroller.scrollTop = 100;
    act(() => {
      scroller.dispatchEvent(new Event('scroll'));
      scroller.dispatchEvent(new Event('scroll'));
      scroller.dispatchEvent(new Event('scroll'));
    });

    // Despite three scroll events, the rAF guard (`if (rafId !== null) return`)
    // means only one frame is queued.
    expect(rafQueue.size).toBe(before + 1);
  });

  it('removes the scroll listener and cancels any pending frame on unmount', () => {
    const scroller = getScroller();
    const removeSpy = vi.spyOn(scroller, 'removeEventListener');
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const { unmount } = render(<StickyTaskName name="My Task" />, {
      container: scroller,
    });
    act(() => {
      flushRaf();
    });

    // Schedule a scroll rAF but do NOT flush it — leave it pending so cleanup
    // has something real to cancel.
    scroller.scrollTop = 100;
    act(() => {
      scroller.dispatchEvent(new Event('scroll'));
    });
    expect(rafQueue.size).toBeGreaterThan(0);

    unmount();

    // Listener removed with the same function reference the component added.
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    // Pending rAF cancelled and the queue is empty.
    expect(cancelSpy).toHaveBeenCalled();
    expect(rafQueue.size).toBe(0);
  });
});