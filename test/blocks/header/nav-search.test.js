/**
 * The header search box: built from the nav's search icon, labelled in the
 * page's language, and searching that language's documents.
 */
import { expect } from '@esm-bundle/chai';
import createNavSearch, { searchPageUrl } from '../../../blocks/header/nav-search.js';

const waitFor = async (check, ms = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, 25); });
  }
};

describe('header search', () => {
  let saved;
  let navSearch;
  beforeEach(() => {
    saved = document.documentElement.lang;
    document.documentElement.lang = 'de';
    window.hlx = window.hlx || { codeBasePath: '' };
    const icon = document.createElement('span');
    icon.className = 'icon icon-search';
    navSearch = createNavSearch(icon, { isDesktop: { matches: true } });
    document.body.append(navSearch);
  });
  afterEach(() => {
    navSearch.remove();
    document.documentElement.lang = saved;
  });

  it('sends a query to the language\'s search page', () => {
    expect(searchPageUrl('de', 'edge delivery')).to.equal('/de/search?query=edge%20delivery');
    expect(searchPageUrl('ja', '  ')).to.equal('/ja/search');
    expect(navSearch.querySelector('form').getAttribute('action')).to.equal('/de/search');
  });

  it('is labelled in the page language', () => {
    const toggle = navSearch.querySelector('.nav-search-toggle');
    expect(toggle.getAttribute('aria-label')).to.equal('Suche öffnen');
    expect(navSearch.querySelector('input').placeholder).to.equal('Arbory Digital durchsuchen');
  });

  it('opens on the icon, then mounts suggestions for the page language', async () => {
    const toggle = navSearch.querySelector('.nav-search-toggle');
    toggle.click();
    expect(navSearch.classList.contains('expanded')).to.equal(true);
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(toggle.getAttribute('aria-label')).to.equal('Suche schließen');
    await waitFor(() => navSearch.querySelector('.stx-query-input'));
    const input = navSearch.querySelector('.stx-query-input input');
    expect(input.classList.contains('nav-search-input')).to.equal(true);
    expect(input.placeholder).to.equal('Arbory Digital durchsuchen');
    expect(navSearch.querySelectorAll('input').length).to.equal(1);
  });

  it('opens a suggestion\'s page instead of searching for its text', async () => {
    navSearch.querySelector('.nav-search-toggle').click();
    await waitFor(() => navSearch.querySelector('.stx-query-input'));
    const list = document.createElement('div');
    const item = document.createElement('a');
    item.className = 'stx-suggestion__item';
    item.href = '#nav-search-test';
    list.append(item);
    navSearch.querySelector('.stx-query-input').append(list);
    let bundleSaw = false;
    list.addEventListener('click', () => { bundleSaw = true; });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    item.dispatchEvent(click);
    expect(bundleSaw).to.equal(false);
    expect(click.defaultPrevented).to.equal(false);
  });

  it('closes on a click outside and on Escape', () => {
    const toggle = navSearch.querySelector('.nav-search-toggle');
    toggle.click();
    document.body.click();
    expect(navSearch.classList.contains('expanded')).to.equal(false);
    toggle.click();
    navSearch.querySelector('form').dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    expect(navSearch.classList.contains('expanded')).to.equal(false);
    expect(toggle.getAttribute('aria-label')).to.equal('Suche öffnen');
  });
});
