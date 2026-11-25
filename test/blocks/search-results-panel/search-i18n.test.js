/**
 * The search page in other languages: strings, facet labels, dates and the rows
 * a locale page does not have to author.
 */
import { expect } from '@esm-bundle/chai';
import {
  SEARCH_LANGUAGES, t, searchLanguage, libraryLabels, facetHeading, facetValueLabel, formatCount,
} from '../../../blocks/search-results-panel/search-i18n.js';
import {
  localeRows, observeFacets, renderItem,
} from '../../../blocks/search-results-panel/search-results-panel.js';

/* Every folder scripts/lang.js treats as a site language. */
const SITE_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'pl', 'pt', 'ko', 'ja', 'zh-tw', 'zh-cn'];

describe('search strings', () => {
  let saved;
  beforeEach(() => { saved = document.documentElement.lang; });
  afterEach(() => { document.documentElement.lang = saved; });

  it('covers every site language', () => {
    expect([...SEARCH_LANGUAGES].sort()).to.deep.equal([...SITE_LANGUAGES].sort());
  });

  it('has every English key in every language, and every library row', () => {
    const keys = Object.keys(libraryLabels('en'));
    SITE_LANGUAGES.forEach((lang) => {
      ['published', 'readMore', 'sortBy', 'showing', 'noResultsFor', 'clearAll', 'viewResultsMany',
        'openSearch', 'closeSearch', 'poweredBy']
        .forEach((key) => expect(t(key, {}, lang), `${lang}.${key}`).to.not.equal(key));
      expect(Object.keys(libraryLabels(lang)), lang).to.have.members(keys);
      expect(libraryLabels(lang).totalResults, lang).to.contain('{{totalCount}}');
    });
  });

  it('follows the page language, and falls back to English', () => {
    document.documentElement.lang = 'de';
    expect(searchLanguage()).to.equal('de');
    expect(t('sortBy')).to.equal('Sortieren nach');
    document.documentElement.lang = 'xx';
    expect(searchLanguage()).to.equal('en');
    expect(t('sortBy')).to.equal('Sort by');
  });

  it('fills placeholders, and leaves unknown ones visible', () => {
    expect(t('showing', { start: 1, end: 10, total: 27 }, 'de')).to.equal('1–10 von 27 Ergebnissen');
    expect(t('noResultsFor', { query: 'edge' }, 'ja')).to.equal('「edge」に一致する結果はありません。');
    expect(t('page', {}, 'fr')).to.equal('Page {n}');
  });

  it('writes numbers the page language\'s way', () => {
    expect(formatCount(1234, 'de')).to.equal('1.234');
    expect(formatCount(1234, 'en')).to.equal('1,234');
  });

  it('translates headings and known facet values, and leaves product names alone', () => {
    expect(facetHeading('Content Type', 'en')).to.equal('Content type');
    expect(facetHeading('Content Type', 'de')).to.equal('Inhaltstyp');
    expect(facetHeading('Year', 'zh-cn')).to.equal('年份');
    expect(facetValueLabel('Article', 'fr')).to.equal('Article');
    expect(facetValueLabel('Article', 'de')).to.equal('Artikel');
    expect(facetValueLabel('AEM News', 'ko')).to.equal('AEM 뉴스');
    expect(facetValueLabel('Edge Delivery Services', 'de')).to.equal('Edge Delivery Services');
    expect(facetValueLabel('Article', 'en')).to.equal('Article');
  });
});

describe('search page in German', () => {
  let saved;
  beforeEach(() => {
    saved = document.documentElement.lang;
    document.documentElement.lang = 'de';
  });
  afterEach(() => { document.documentElement.lang = saved; });

  it('adds the namespace and library labels the page leaves out, and keeps authored ones', () => {
    const row = (k, v) => {
      const el = document.createElement('div');
      el.innerHTML = `<div>${k}</div><div>${v}</div>`;
      return el;
    };
    const added = localeRows([
      row('dataSources', '/search/arbory-pages/body'),
      row('inputPlaceholder', 'Eigener Text'),
    ]);
    const map = Object.fromEntries(added.map((el) => [
      el.children[0].textContent,
      el.children[1].textContent,
    ]));
    expect(map.namespace).to.equal('de');
    expect(map.totalResults).to.equal('{{totalCount}} Ergebnisse');
    expect(map).to.not.have.property('inputPlaceholder');
    expect(map).to.not.have.property('dataSources');
  });

  it('labels a result row in German: pill, date and read more', () => {
    const row = renderItem({
      _id: 'de:/de/blog/what-is-aem-edge-delivery-services',
      _source: {
        type: 'page/eds',
        namespace: 'de',
        payload: { title: 'Was ist EDS', date: '2023-11-06', facets: { content_type_level0: ['Article'] } },
      },
    });
    expect(row.querySelector('.search-results-panel-item__type').textContent).to.equal('Artikel');
    expect(row.querySelector('.search-results-panel-item__date').textContent).to.equal('Veröffentlicht am 6. November 2023');
    expect(row.textContent).to.contain('Weiterlesen');
  });

  it('relabels facet headings and values but keeps the values as filter keys', () => {
    const panel = document.createElement('div');
    panel.className = 'stx-results-panel';
    panel.innerHTML = `
      <aside class="stx-results-panel__facets-container">
        <div class="stx-results-panel__facet">
          <button type="button" class="stx-results-panel__facet-toggle"><span class="stx-results-panel__facet-name">Content Type</span></button>
          <div class="stx-results-panel__facet-values">
            <div class="stx-results-panel__facet-node"><div class="stx-results-panel__facet-row">
              <label class="stx-results-panel__facet-option"><input type="checkbox" value="Podcast"><span class="stx-results-panel__facet-label">Podcast</span></label>
            </div></div>
            <div class="stx-results-panel__facet-node"><div class="stx-results-panel__facet-row">
              <label class="stx-results-panel__facet-option"><input type="checkbox" value="Article"><span class="stx-results-panel__facet-label">Article</span></label>
            </div></div>
          </div>
        </div>
      </aside>`;
    document.body.append(panel);
    observeFacets(panel);
    expect(panel.querySelector('.stx-results-panel__facet-name').textContent).to.equal('Inhaltstyp');
    const labels = [...panel.querySelectorAll('.stx-results-panel__facet-label')].map((el) => el.textContent);
    expect(labels).to.deep.equal(['Podcast', 'Artikel']);
    expect([...panel.querySelectorAll('input')].map((el) => el.value)).to.deep.equal(['Podcast', 'Article']);
    panel.remove();
  });
});
