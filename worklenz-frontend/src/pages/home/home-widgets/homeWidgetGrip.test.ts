import { describe, expect, it } from 'vitest';
import rawCss from './home-widgets.css?raw';
import { isWidgetSurfaceTarget, WIDGET_DATA_ATTRIBUTE, WIDGET_ID_ATTRIBUTE } from './widgetInteraction';

/**
 * Regression checks for the drag grip (issue #548).
 *
 * The grip is right-aligned on headered widgets. Summary cards has no header, so its "..." menu
 * floats in the top-right corner (HomeWidgetMenuButton: top 6px, right 6px). A right-aligned grip
 * would sit under that menu and over a data tile, where a press is rejected as data, so on widgets
 * with a floating menu the grip stays centred over the gap between tiles instead.
 *
 * jsdom does not do layout, so the CSS half of this guards the rules themselves, and the DOM half
 * guards the reason the centred spot works: the gap between tiles is a drag surface, the tiles and
 * the menu button are not.
 */

// Comments sit between rules (including right before the :has() rule), so drop them first.
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The declarations of the rule whose selector is exactly `selector`, or '' when there is none. */
const ruleBody = (selector: string): string => {
  const match = css.match(new RegExp(`(?:^|\\})\\s*${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
};

const html = (markup: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host;
};

describe('drag grip placement (CSS)', () => {
  it('right-aligns the grip by default, with no centring left over', () => {
    const grip = ruleBody('.home-widget__grip');
    expect(grip).not.toBe('');
    expect(grip).toMatch(/right:\s*12px/);
    expect(grip).not.toMatch(/left:\s*50%/);
    expect(grip).not.toMatch(/translateX/);
  });

  it('keeps the grip decorative, so the pointer reaches the widget surface underneath', () => {
    expect(ruleBody('.home-widget__grip')).toMatch(/pointer-events:\s*none/);
  });

  it('centres the grip over the tile gap on a widget that has a floating menu', () => {
    const floating = ruleBody('.home-widget:has(.home-widget__menu--floating) .home-widget__grip');
    expect(floating).not.toBe('');
    expect(floating).toMatch(/left:\s*50%/);
    expect(floating).toMatch(/right:\s*auto/);
    expect(floating).toMatch(/translateX\(-50%\)/);
  });

  it('keeps the floating menu in the top-right corner, the spot a right-aligned grip would collide with', () => {
    const menu = ruleBody('.home-widget__menu--floating');
    expect(menu).toMatch(/position:\s*absolute/);
    expect(menu).toMatch(/top:\s*6px/);
    expect(menu).toMatch(/right:\s*6px/);
  });
});

describe('Summary cards: where a drag can start', () => {
  // The production shape: no header, a grid of data tiles, and a floating menu button.
  const summaryCards = html(`
    <div ${WIDGET_ID_ATTRIBUTE}="stat-cards" class="home-widget">
      <div id="grid">
        <div ${WIDGET_DATA_ATTRIBUTE} id="tile-a"><span id="tile-a-value">0</span></div>
        <div ${WIDGET_DATA_ATTRIBUTE} id="tile-b"><span id="tile-b-value">5</span></div>
      </div>
      <button class="home-widget__menu--floating" id="menu" type="button">...</button>
    </div>`);

  it('starts a drag from the gap between tiles, where the centred grip sits', () => {
    expect(isWidgetSurfaceTarget(summaryCards.querySelector('#grid'))).toBe(true);
  });

  it('does not start a drag from a data tile, which is why the grip cannot sit over one', () => {
    expect(isWidgetSurfaceTarget(summaryCards.querySelector('#tile-a'))).toBe(false);
    expect(isWidgetSurfaceTarget(summaryCards.querySelector('#tile-b-value'))).toBe(false);
  });

  it('does not start a drag from the floating menu button, which is why the grip cannot sit under it', () => {
    expect(isWidgetSurfaceTarget(summaryCards.querySelector('#menu'))).toBe(false);
  });
});