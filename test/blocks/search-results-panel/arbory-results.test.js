/* eslint-disable no-underscore-dangle */
/**
 * The Arbory-specific parts of search-results-panel: the facet rail's order and
 * labels, Year newest first, and the result row's content-type pill and
 * "Published" date. The rest of the block is the earlier site's, unchanged in behaviour.
 */
import { expect } from '@esm-bundle/chai';
import {
  contentTypeOf,
  observeFacets,
  renderItem,
  sortFacetValuesByKey,
} from '../../../blocks/search-results-panel/search-results-panel.js';
import { installMockSearch } from '../../../scripts/search-mock/mock-search.js';

/** The heading `humanizeFacetName` produces for each indexed field. */
const HEADING = {
  content_type_level0: 'Content Type',
  topic_level0: 'Topic',
  technology_level0: 'Technology',
  year_level0: 'Year',
  author_level0: 'Author',
};

/** One facet value node, in the library's markup. */
const valueNode = (label) => `
  <div class="stx-results-panel__facet-node">
    <div class="stx-results-panel__facet-row">
      <label class="stx-results-panel__facet-option">
        <input type="checkbox" value="${label}" />
        <span class="stx-results-panel__facet-label">${label}</span>
      </label>
    </div>
  </div>`;

/** The library's facet markup for the given fields (and values) in the given order. */
function panelWith(fields, values = {}) {
  const panel = document.createElement('div');
  panel.className = 'stx-results-panel';
  const container = document.createElement('aside');
  container.className = 'stx-results-panel__facets-container';
  fields.forEach((field) => {
    const group = document.createElement('div');
    group.className = 'stx-results-panel__facet';
    group.innerHTML = `
      <button type="button" class="stx-results-panel__facet-toggle" aria-expanded="false">
        <span class="stx-results-panel__facet-name">${HEADING[field] || field}</span>
      </button>
      <div class="stx-results-panel__facet-values" hidden>
        ${(values[field] || []).map(valueNode).join('')}
      </div>`;
    container.append(group);
  });
  panel.append(container);
  return panel;
}

const headings = (panel) => [...panel.querySelectorAll('.stx-results-panel__facet-name')]
  .map((el) => el.textContent.trim());

const labelsOf = (group) => [...group.querySelectorAll('.stx-results-panel__facet-label')]
  .map((el) => el.textContent.trim());

describe('Arbory facet rail', () => {
  let root;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
  });

  afterEach(() => root.remove());

  it('orders Content type, Topic, Technology, Year, Author from any response order', () => {
    // Alphabetical by field: the order the mock deliberately answers in.
    const panel = panelWith([
      'author_level0', 'content_type_level0', 'technology_level0', 'topic_level0', 'year_level0',
    ]);
    root.append(panel);
    observeFacets(root);

    expect(headings(panel)).to.deep.equal([
      'Content type', 'Topic', 'Technology', 'Year', 'Author',
    ]);
  });

  it('keeps an unknown family, after the known ones', () => {
    const panel = panelWith(['industry_level0', 'year_level0', 'content_type_level0']);
    root.append(panel);
    observeFacets(root);

    expect(headings(panel)).to.deep.equal(['Content type', 'Year', 'industry_level0']);
  });

  it('lists Year newest first, whatever order the counts gave', () => {
    const panel = panelWith(['year_level0'], { year_level0: ['2025', '2024', '2026', '2023'] });
    root.append(panel);
    observeFacets(root);

    const year = panel.querySelector('.stx-results-panel__facet');
    expect(labelsOf(year)).to.deep.equal(['2026', '2025', '2024', '2023']);
  });

  it('moves the library\'s own nodes, so their checkboxes keep their listeners', () => {
    const panel = panelWith(['year_level0'], { year_level0: ['2024', '2026'] });
    const group = panel.querySelector('.stx-results-panel__facet');
    const input2026 = group.querySelector('input[value="2026"]');
    let clicked = 0;
    input2026.addEventListener('click', () => { clicked += 1; });

    sortFacetValuesByKey(group);
    group.querySelector('input').click();

    expect(labelsOf(group)).to.deep.equal(['2026', '2024']);
    expect(clicked).to.equal(1);
  });

  it('leaves every other group in the response order (by count)', () => {
    const panel = panelWith(['topic_level0'], { topic_level0: ['AEM Technical Help', 'AEM News', 'Arbory Digital News'] });
    const group = panel.querySelector('.stx-results-panel__facet');
    sortFacetValuesByKey(group);

    expect(labelsOf(group)).to.deep.equal(['AEM Technical Help', 'AEM News', 'Arbory Digital News']);
  });
});

describe('Arbory result row', () => {
  const hit = (payload) => ({
    _id: 'en:/en/blog/what-is-document-authoring-for-edge-delivery',
    _source: { type: 'page/eds', namespace: 'en', payload },
  });

  it('links to the namespace-stripped, same-origin path', () => {
    const row = renderItem(hit({ title: 'Intro to DA' }));
    expect(row.getAttribute('href')).to.equal('/en/blog/what-is-document-authoring-for-edge-delivery');
    expect(row.querySelector('.search-results-panel-item__url').textContent)
      .to.equal(`${window.location.origin}/en/blog/what-is-document-authoring-for-edge-delivery`);
  });

  it('shows the content type as a pill and the date as "Published <date>"', () => {
    const row = renderItem(hit({
      title: 'Intro to DA',
      date: '2025-01-08',
      facets: { content_type_level0: ['Article'] },
    }));
    const meta = row.querySelector('.search-results-panel-item__meta');
    expect(meta.querySelector('.search-results-panel-item__type').textContent).to.equal('Article');
    const date = meta.querySelector('.search-results-panel-item__date');
    expect(date.textContent).to.equal('Published January 8, 2025');
    expect(date.querySelector('time').dateTime).to.equal('2025-01-08');
  });

  it('drops the meta line when there is neither a type nor a date', () => {
    const row = renderItem(hit({ title: 'Untyped' }));
    expect(row.querySelector('.search-results-panel-item__meta')).to.equal(null);
  });

  it('renders the pill text as text, never as markup', () => {
    const row = renderItem(hit({ title: 'x', facets: { content_type_level0: ['<img src=x onerror=alert(1)>'] } }));
    expect(row.querySelector('img')).to.equal(null);
  });

  it('reads the content type from the first facet value, or nothing', () => {
    expect(contentTypeOf({ facets: { content_type_level0: ['Podcast', 'Article'] } })).to.equal('Podcast');
    expect(contentTypeOf({ facets: { content_type_level0: 'Event' } })).to.equal('Event');
    expect(contentTypeOf({ facets: {} })).to.equal('');
    expect(contentTypeOf(undefined)).to.equal('');
  });
});

describe('Arbory mock fixture (?stx-mock=1)', () => {
  const rows = {
    mockData: 'true',
    searchApiUrl: '/search/pages',
    dataSources: '/search/arbory-pages/body',
  };

  const post = (params) => window.fetch('/search/arbory-pages/body', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'arbory-pages',
      params: {
        namespace: 'en', from: 0, size: 10, ...params,
      },
    }),
  }).then((r) => r.json());

  before(async () => {
    expect(await installMockSearch(rows)).to.equal(true);
  });

  it('answers in the arbory-pages contract: en ids, page/eds, the five facet families', async () => {
    const body = await post({ query: 'edge delivery' });
    expect(body.hits.total.value).to.be.greaterThan(0);
    const [first] = body.hits.hits;
    expect(first._id).to.match(/^en:\/en\//);
    expect(first._source.type).to.equal('page/eds');
    expect(first._source.payload.facets.content_type_level0).to.have.length(1);
    expect(Object.keys(body.aggregations).sort()).to.deep.equal([
      'author_level0', 'content_type_level0', 'technology_level0', 'topic_level0', 'year_level0',
    ]);
  });

  it('filters on a facet value and sorts by date', async () => {
    const body = await post({
      query: 'aem',
      sort: 'date:desc',
      filter_query: { fields: [{ name: 'category_hierarchy', values: ['Podcast'], last: true }] },
    });
    const types = body.hits.hits.map((h) => h._source.payload.facets.content_type_level0[0]);
    expect(types.length).to.be.greaterThan(0);
    expect(types.every((t) => t === 'Podcast')).to.equal(true);
    const dates = body.hits.hits.map((h) => h._source.payload.date);
    expect([...dates].sort().reverse()).to.deep.equal(dates);
  });
});
