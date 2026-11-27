/* eslint-disable no-unused-expressions */
import { expect } from '@esm-bundle/chai';
import { CARRIED_PARAMS, languageHref, refreshLanguageLinks } from '../../../blocks/header/language-links.js';

const at = (href) => new URL(href);

describe('header language links', () => {
  it('swaps the language folder and keeps the path', () => {
    expect(languageHref('pt', at('https://blog.arborydigital.com/en/blog/tailing-aemaacs-logs')))
      .to.equal('https://blog.arborydigital.com/pt/blog/tailing-aemaacs-logs');
    expect(languageHref('zh-tw', at('https://blog.arborydigital.com/zh-cn/search')))
      .to.equal('https://blog.arborydigital.com/zh-tw/search');
  });

  it('keeps the query, facets, sort and tab, but not the result page', () => {
    const facets = JSON.stringify({ technology_level0: ['CDN & Dispatcher'] });
    const from = at(`https://blog.arborydigital.com/en/search?query=aem%20logs&stx-facets=${encodeURIComponent(facets)}`
      + '&stx-sort=date&stx-tab=www&stx-page=4&utm_source=x');
    const to = new URL(languageHref('pt', from));
    expect(to.pathname).to.equal('/pt/search');
    expect(to.searchParams.get('query')).to.equal('aem logs');
    expect(JSON.parse(to.searchParams.get('stx-facets'))).to.deep.equal({ technology_level0: ['CDN & Dispatcher'] });
    expect(to.searchParams.get('stx-sort')).to.equal('date');
    expect(to.searchParams.get('stx-tab')).to.equal('www');
    expect(to.searchParams.has('stx-page')).to.be.false;
    expect(to.searchParams.has('utm_source')).to.be.false;
    expect([...to.searchParams.keys()]).to.have.members(CARRIED_PARAMS);
  });

  it('adds no empty params', () => {
    expect(languageHref('de', at('https://blog.arborydigital.com/en/search?query=')))
      .to.equal('https://blog.arborydigital.com/de/search');
  });

  it('follows the current URL when refreshed', () => {
    const list = document.createElement('ul');
    list.innerHTML = '<li><a data-lang="pt" href="/pt/">Português</a></li><li><a class="active" href="#">English</a></li>';
    const before = window.location.href;
    window.history.replaceState({}, '', '/en/search?query=sling&stx-page=2');
    try {
      refreshLanguageLinks(list);
      const to = new URL(list.querySelector('a[data-lang]').href);
      expect(to.pathname).to.equal('/pt/search');
      expect(to.search).to.equal('?query=sling');
      expect(list.querySelector('a.active').getAttribute('href')).to.equal('#');
    } finally {
      window.history.replaceState({}, '', before);
    }
  });
});
