/**
 * "Search powered by" under the facets: in the page language, linking to that
 * language's episode, and kept at the foot of the facets across re-renders.
 */
import { expect } from '@esm-bundle/chai';
import {
  POWERED_BY_CLASS, buildPoweredBy, observePoweredBy, poweredByHref,
} from '../../../blocks/search-results-panel/powered-by.js';

const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });

const facetsContainer = () => {
  const aside = document.createElement('aside');
  aside.className = 'stx-results-panel__facets-container';
  aside.innerHTML = '<div class="stx-results-panel__facet">Topic</div><div class="stx-results-panel__facet">Year</div>';
  return aside;
};

describe('search powered by', () => {
  let saved;
  beforeEach(() => {
    saved = document.documentElement.lang;
    document.documentElement.lang = 'de';
  });
  afterEach(() => { document.documentElement.lang = saved; });

  it('links to the episode in the page language', () => {
    expect(poweredByHref()).to.equal('/de/podcast/making-aem-and-edge-delivery-go-crazy-fast');
    expect(poweredByHref('zh-tw')).to.equal('/zh-tw/podcast/making-aem-and-edge-delivery-go-crazy-fast');
  });

  it('reads "Search powered by" in the page language, with both logos', () => {
    const badge = buildPoweredBy('ja');
    expect(badge.getAttribute('href')).to.equal('/ja/podcast/making-aem-and-edge-delivery-go-crazy-fast');
    expect(badge.querySelector(`.${POWERED_BY_CLASS}__caption`).textContent).to.equal('検索技術提供：');
    expect([...badge.querySelectorAll('img')].map((img) => img.alt)).to.deep.equal(['Arbory Digital', 'StreamX']);
    expect(badge.querySelector(`.${POWERED_BY_CLASS}__plus`).getAttribute('aria-hidden')).to.equal('true');
  });

  it('stays the last thing in the facets, once, across re-renders', async () => {
    const block = document.createElement('div');
    block.append(facetsContainer());
    document.body.append(block);
    observePoweredBy(block);

    const badges = () => block.querySelectorAll(`.${POWERED_BY_CLASS}`);
    const isLast = () => block.querySelector('aside').lastElementChild.classList.contains(POWERED_BY_CLASS);
    expect(badges().length).to.equal(1);
    expect(isLast()).to.equal(true);

    // facet ordering re-appends a group after it
    const aside = block.querySelector('aside');
    aside.append(aside.querySelector('.stx-results-panel__facet'));
    await tick();
    expect(badges().length).to.equal(1);
    expect(isLast()).to.equal(true);

    // a response replaces the whole container
    aside.replaceWith(facetsContainer());
    await tick();
    expect(badges().length).to.equal(1);
    expect(isLast()).to.equal(true);
    block.remove();
  });
});
