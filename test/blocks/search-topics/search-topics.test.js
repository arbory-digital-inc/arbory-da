/* eslint-disable no-unused-expressions, no-underscore-dangle */
import { expect } from '@esm-bundle/chai';
import {
  articleText, mentions, pageKey, pickPills, pillHref, readConfig, renderPills, requestBody,
  unescapeHtml,
} from '../../../blocks/search-topics/search-topics.js';
import { GLOSSARY } from '../../../blocks/search-topics/glossary.js';

const response = (keys, self = null) => ({
  hits: { hits: self ? [self] : [] },
  aggregations: { neighbourhood: { topics: { buckets: keys.map((key) => ({ key })) } } },
});

describe('search-topics', () => {
  it('keeps glossary keys safe to send as one regex', () => {
    Object.keys(GLOSSARY).forEach((key) => expect(key).to.match(/^[a-z0-9]+$/));
    ['da', 'target', 'react', 'node'].forEach((word) => expect(GLOSSARY).not.to.have.property(word));
  });

  it('reads the authored rows', () => {
    const block = document.createElement('div');
    block.innerHTML = '<div><div>Count</div><div>5</div></div><div><div>lonely</div></div>';
    expect(readConfig(block)).to.deep.equal({ count: '5' });
  });

  it('keys the page by its locale folder', () => {
    expect(pageKey('/de/aem-66-and-jdk-17')).to.deep.equal({ namespace: 'de', id: 'de:/de/aem-66-and-jdk-17' });
    expect(pageKey('/zh-cn/blog/')).to.deep.equal({ namespace: 'zh-cn', id: 'zh-cn:/zh-cn/blog/index' });
  });

  it('sends the glossary as the include regex', () => {
    const body = requestBody({ namespace: 'en', id: 'en:/en/x', text: 'hi' }, { sling: 'Sling', oak: 'Oak' });
    expect(body).to.deep.equal({
      id: 'arbory-topics',
      params: {
        namespace: 'en', id: 'en:/en/x', text: 'hi', terms: 'sling|oak',
      },
    });
  });

  it('finds a name as a word of its own, also inside CJK text', () => {
    expect(mentions('Tailing logs with the aio CLI', 'aio')).to.be.true;
    expect(mentions('a ratio of five', 'aio')).to.be.false;
    expect(mentions('AEMとSlingの話', 'sling')).to.be.true;
    expect(mentions('Use OAK, then', 'oak')).to.be.true;
  });

  it('shows ranked names the article mentions, then its tags, no label twice', () => {
    const self = {
      _id: 'en:/en/blog/a',
      _source: { payload: { facets: { technology_level0: ['AEM 6.5 & LTS', 'Observability'] } } },
    };
    const pills = pickPills(
      response(['lts', 'splunk', 'oak', 'logs', 'logging', 'observability'], self),
      {
        id: 'en:/en/blog/a', text: 'LTS upgrade: Oak, logs and logging, observability', count: 8, lang: 'en',
      },
      {
        lts: 'LTS', splunk: 'Splunk', oak: 'Oak', logs: 'Logging', logging: 'Logging', observability: 'Observability',
      },
    );
    expect(pills.map((p) => `${p.kind}:${p.label}`)).to.deep.equal([
      'term:LTS', 'term:Oak', 'term:Logging', 'term:Observability', 'tag:AEM 6.5 & LTS',
    ]);
  });

  it('uses tags only from the article\'s own document, and stops at count', () => {
    const other = { _id: 'en:/en/blog/other', _source: { payload: { facets: { technology_level0: ['FinOps'] } } } };
    const pills = pickPills(response(['oak', 'sling', 'jcr'], other), {
      id: 'en:/en/blog/a', text: 'oak sling jcr', count: 2, lang: 'en',
    }, { oak: 'Oak', sling: 'Sling', jcr: 'JCR' });
    expect(pills.map((p) => p.label)).to.deep.equal(['Oak', 'Sling']);
  });

  it('drops a name another one covers, and keeps room for two tags', () => {
    const self = {
      _id: 'en:/en/a',
      _source: { payload: { facets: { technology_level0: ['FinOps', 'DevOps & CI/CD', 'Observability'] } } },
    };
    const glossary = {
      aio: 'AIO CLI', cli: 'CLI', rde: 'RDE', splunk: 'Splunk', oak: 'Oak',
    };
    const pills = pickPills(response(['aio', 'cli', 'rde', 'splunk', 'oak'], self), {
      id: 'en:/en/a', text: 'aio cli rde splunk oak', count: 5, lang: 'en',
    }, glossary);
    expect(pills.map((p) => p.label)).to.deep.equal(['AIO CLI', 'RDE', 'Splunk', 'FinOps', 'DevOps & CI/CD']);
  });

  it('translates a tag for display and filters by its indexed value', () => {
    const self = { _id: 'de:/de/x', _source: { payload: { facets: { technology_level0: ['Observability'] } } } };
    const [pill] = pickPills(response([], self), {
      id: 'de:/de/x', text: '', count: 8, lang: 'de',
    }, {});
    expect(pill.kind).to.equal('tag');
    expect(pill.value).to.equal('Observability');
    expect(pillHref(pill, 'de')).to.equal(`/de/search?stx-facets=${encodeURIComponent('{"technology_level0":["Observability"]}')}`);
  });

  it('shows and filters by an escaped tag as plain text, translated for display', () => {
    const self = {
      _id: 'de:/de/x',
      _source: { payload: { facets: { technology_level0: ['CDN &amp; Dispatcher', 'Replication &amp; Publishing'] } } },
    };
    const pills = pickPills(response([], self), {
      id: 'de:/de/x', text: '', count: 8, lang: 'de',
    }, {});
    expect(pills.map((p) => p.label)).to.deep.equal(['CDN & Dispatcher', 'Replikation & Veröffentlichung']);
    expect(pills[0].value).to.equal('CDN & Dispatcher');
    expect(pillHref(pills[0], 'de')).to.equal(`/de/search?stx-facets=${encodeURIComponent('{"technology_level0":["CDN & Dispatcher"]}')}`);
    expect(unescapeHtml('a &amp;lt; b')).to.equal('a &lt; b');
  });

  it('links a name to a search in the page language', () => {
    expect(pillHref({ kind: 'term', value: 'adaptTo()' }, 'en')).to.equal('/en/search?query=adaptTo');
    expect(pillHref({ kind: 'term', value: 'AIO CLI' }, 'ja')).to.equal('/ja/search?query=AIO%20CLI');
  });

  it('renders labels as text', () => {
    const list = renderPills([{ label: '<img src=x onerror=alert(1)>', kind: 'term', value: 'x' }], 'en');
    expect(list.querySelector('img')).to.be.null;
    expect(list.querySelector('a').textContent).to.equal('<img src=x onerror=alert(1)>');
  });

  it('reads the article copy, not other feeds or itself', () => {
    const doc = document.implementation.createHTMLDocument('Page');
    doc.body.innerHTML = '<header><p>nav text</p></header><main><div class="section"><h1>Tailing logs</h1>'
      + '<div class="search-topics"><p>topics text</p></div><p>Body about <code>aio</code>.</p><pre>aio cloudmanager</pre>'
      + '<div class="search-mlt-suggestions"><p>feed text</p></div></div></main>';
    const text = articleText(doc);
    expect(text).to.contain('Tailing logs');
    expect(text).to.contain('Body about aio.');
    expect(text).to.contain('aio cloudmanager');
    expect(text).not.to.contain('feed text');
    expect(text).not.to.contain('topics text');
    expect(text).not.to.contain('nav text');
  });
});
