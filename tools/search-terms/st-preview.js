/* --------------------------------------------------------------------------
 * Search Terms Manager — the preview frame
 *
 * Renders with the BLOCK's own `renderCurated`, so the preview IS the panel —
 * same element, same classes, same escaping — rather than a mock-up of it that
 * can be right today and wrong after the next change to the block.
 *
 * It never matches anything. The parent decides which row wins (with the block's
 * matcher) and posts the parsed row across; there is one matcher and it runs
 * once. A frame that matched for itself would be the second copy of the rule the
 * block's own header warns about.
 * ------------------------------------------------------------------------ */

import { renderCurated } from '../../blocks/search-results-panel/curated-results.js';

/** The rail container the block puts its promo panels in. */
const RAIL_CLASS = 'search-results-panel-promo-rail';

/**
 * Puts a placement's panels where the block puts them, or removes them.
 *
 * The two placements are NOT interchangeable and this is the part a hand-drawn
 * preview gets wrong:
 *
 *   - the FEATURED answer is at most one panel, inside the results container,
 *     before the results LIST (so it lands under the "Showing 1-10 of N" header,
 *     not over it); and
 *   - the PROMO rail is up to three panels inside a RAIL container appended to
 *     the OUTER wrapper, which is the element whose grid has a third column. The
 *     container matters: three loose panels would each want a grid row of their
 *     own and the second and third would land beside nothing.
 *
 * Same structure as observeFeatured/observePromo, because getting this wrong is
 * precisely what makes a preview lie.
 *
 * @param {Element} root The frame's `.stx-search-results-panel` wrapper
 * @param {Object[]} rows The parsed rows to show — none, one, or up to three
 * @param {string} placement `featured` or `promo`
 * @returns {HTMLElement[]} The panels rendered
 */
// Named, not default: the tests import it by name, as on the earlier site.
// eslint-disable-next-line import/prefer-default-export
export function place(root, rows, placement) {
  const shown = Array.isArray(rows) ? rows : [rows].filter(Boolean);

  root.querySelectorAll(`.search-results-panel-${placement}`).forEach((el) => el.remove());
  root.querySelectorAll(`.${RAIL_CLASS}`).forEach((el) => el.remove());
  if (!shown.length) return [];

  const panels = shown.map((row) => renderCurated(row, placement));

  if (placement === 'promo') {
    const rail = document.createElement('div');
    rail.className = RAIL_CLASS;
    rail.append(...panels);
    root.append(rail);
  } else {
    root.querySelector('.stx-results-panel__results-list').before(...panels);
  }
  return panels;
}

/* The frame only wires itself up when it IS a frame; under test it is imported. */
if (typeof window !== 'undefined' && window.parent !== window) {
  const root = document.querySelector('.stx-search-results-panel');

  /** Reports our rendered height, so the parent can size the frame to it. */
  const publishHeight = () => window.parent.postMessage({
    type: 'st-preview-height',
    height: Math.ceil(document.body.getBoundingClientRect().height),
  }, '*');

  window.addEventListener('message', ({ data }) => {
    if (data?.type !== 'st-preview') return;
    place(root, data.featured, 'featured');
    place(root, data.promo, 'promo');
    publishHeight();
  });

  new ResizeObserver(publishHeight).observe(document.body);
  window.parent.postMessage({ type: 'st-preview-ready' }, '*');
}
