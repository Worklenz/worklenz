import { describe, it, expect, beforeEach } from 'vitest';
import { createHorizontalScrollSync } from './horizontal-scroll-sync';

/**
 * Minimal model of the browser behaviour the sync depends on:
 *  - scroll events are dispatched asynchronously, once per frame, coalesced per element
 *    and in the order the elements were first queued;
 *  - writing scrollLeft from script cancels that element's in-progress smooth scroll;
 *  - scrollLeft is clamped to [0, maxScrollLeft] and only a real change queues an event.
 */
class FakeScroller {
  private left = 0;
  private animation: { target: number; step: number } | null = null;
  scriptWrites = 0;
  smoothScrollCancelled = false;

  constructor(
    private readonly env: ScrollEnvironment,
    readonly maxScrollLeft: number,
    readonly onScroll: (el: FakeScroller) => void
  ) {}

  get scrollLeft() {
    return this.left;
  }

  set scrollLeft(value: number) {
    this.scriptWrites++;
    if (this.animation) {
      this.animation = null;
      this.smoothScrollCancelled = true;
    }
    this.setPosition(value);
  }

  /** User-driven scroll (wheel/trackpad/drag): moves the element without a script write. */
  userScrollTo(value: number) {
    this.setPosition(value);
  }

  smoothScrollTo(target: number, frames: number) {
    this.smoothScrollCancelled = false;
    this.animation = { target, step: (target - this.left) / frames };
  }

  get isAnimating() {
    return this.animation !== null;
  }

  advanceAnimation() {
    if (!this.animation) return;
    const { target, step } = this.animation;
    const next = Math.abs(target - this.left) <= Math.abs(step) ? target : this.left + step;
    this.setPosition(next);
    if (this.left === target) this.animation = null;
  }

  private setPosition(value: number) {
    const clamped = Math.min(Math.max(0, value), this.maxScrollLeft);
    if (clamped === this.left) return;
    this.left = clamped;
    this.env.queueScrollEvent(this);
  }
}

class ScrollEnvironment {
  private queue: FakeScroller[] = [];
  readonly scrollers: FakeScroller[] = [];

  queueScrollEvent(el: FakeScroller) {
    if (!this.queue.includes(el)) this.queue.push(el);
  }

  runFrame() {
    this.scrollers.forEach(el => el.advanceAnimation());
    const pending = this.queue;
    this.queue = [];
    pending.forEach(el => el.onScroll(el));
  }

  runUntilIdle(maxFrames = 200) {
    for (let i = 0; i < maxFrames; i++) {
      if (this.queue.length === 0 && !this.scrollers.some(el => el.isAnimating)) return;
      this.runFrame();
    }
    throw new Error('scroll did not settle');
  }
}

const setup = ({ chartMax = 5000, timelineMax = 5000 } = {}) => {
  const env = new ScrollEnvironment();
  const sync = createHorizontalScrollSync();
  const refs: { chart: FakeScroller | null; timeline: FakeScroller | null } = {
    chart: null,
    timeline: null,
  };

  const chart = new FakeScroller(env, chartMax, el => sync.syncFromChart(el, refs.timeline));
  const timeline = new FakeScroller(env, timelineMax, el => sync.syncFromTimeline(el, refs.chart));
  refs.chart = chart;
  refs.timeline = timeline;
  env.scrollers.push(chart, timeline);

  return { env, chart, timeline };
};

describe('createHorizontalScrollSync', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('lets the "Today" smooth scroll on the chart run to completion', () => {
    const { env, chart, timeline } = ctx;

    chart.smoothScrollTo(1800, 12);
    env.runUntilIdle();

    expect(chart.smoothScrollCancelled).toBe(false);
    expect(chart.scriptWrites).toBe(0);
    expect(chart.scrollLeft).toBe(1800);
    expect(timeline.scrollLeft).toBe(1800);
  });

  it('lets "Today" complete after the user has already scrolled away via the chart and header', () => {
    const { env, chart, timeline } = ctx;

    chart.userScrollTo(3000);
    env.runUntilIdle();
    timeline.userScrollTo(3500);
    env.runUntilIdle();
    expect(chart.scrollLeft).toBe(3500);

    chart.smoothScrollTo(1800, 12);
    env.runUntilIdle();

    expect(chart.smoothScrollCancelled).toBe(false);
    expect(chart.scrollLeft).toBe(1800);
    expect(timeline.scrollLeft).toBe(1800);
  });

  it('mirrors a header scroll back to a previously synchronized position onto the chart', () => {
    const { env, chart, timeline } = ctx;

    chart.userScrollTo(500);
    env.runUntilIdle();
    expect(timeline.scrollLeft).toBe(500);

    timeline.userScrollTo(800);
    env.runUntilIdle();
    expect(chart.scrollLeft).toBe(800);

    timeline.userScrollTo(500);
    env.runUntilIdle();
    expect(chart.scrollLeft).toBe(500);
    expect(timeline.scrollLeft).toBe(500);
  });

  it('mirrors a header scroll back to the position "Today" synchronized', () => {
    const { env, chart, timeline } = ctx;

    chart.smoothScrollTo(1800, 12);
    env.runUntilIdle();

    timeline.userScrollTo(2400);
    env.runUntilIdle();
    expect(chart.scrollLeft).toBe(2400);

    timeline.userScrollTo(1800);
    env.runUntilIdle();
    expect(chart.scrollLeft).toBe(1800);
  });

  it('does not wait for an echo when the header write was clamped to a no-op', () => {
    const { env, chart, timeline } = setup({ chartMax: 1000, timelineMax: 800 });

    chart.userScrollTo(800);
    env.runUntilIdle();
    chart.userScrollTo(950);
    env.runUntilIdle();
    expect(timeline.scrollLeft).toBe(800);

    timeline.userScrollTo(600);
    env.runUntilIdle();
    expect(chart.scrollLeft).toBe(600);

    timeline.userScrollTo(800);
    env.runUntilIdle();
    expect(chart.scrollLeft).toBe(800);
  });

  it('settles without ping-ponging writes between the two panels', () => {
    const { env, chart, timeline } = ctx;

    timeline.userScrollTo(1200);
    env.runUntilIdle();

    expect(chart.scrollLeft).toBe(1200);
    expect(chart.scriptWrites).toBe(1);
    expect(timeline.scriptWrites).toBe(0);
  });
});
