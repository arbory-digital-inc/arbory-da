/* eslint-disable no-unused-expressions */
import { expect } from '@esm-bundle/chai';
import {
  highlightNodes, publicPath, renderSuggestion, resultUrl, SUGGESTION_CLASS,
} from '../../../blocks/search-results-panel/search-links.js';

const hit = (id, namespace = 'en', extra = {}) => ({ _id: id, _source: { namespace, ...extra } });

describe('search hit links', () => {
  it('links a blog page root-relative', () => {
    expect(resultUrl(hit('en:/en/blog/post'))).to.equal('/en/blog/post');
    expect(resultUrl(hit('de:/de/podcast/x', 'de'))).to.equal('/de/podcast/x');
  });

  it('links an apex-site page to its own host', () => {
    const url = resultUrl(hit('en://arborydigital.com/en/services/aem-upgrades'));
    expect(url).to.equal('//arborydigital.com/en/services/aem-upgrades');
    expect(new URL(url, 'https://blog.arborydigital.com').href)
      .to.equal('https://arborydigital.com/en/services/aem-upgrades');
  });

  it('links a folder index page to the folder, on either site', () => {
    expect(resultUrl(hit('en:/en/index'))).to.equal('/en/');
    expect(resultUrl(hit('en://arborydigital.com/en/index'))).to.equal('//arborydigital.com/en/');
    expect(publicPath('/index')).to.equal('/');
    expect(publicPath('/en/blog/search-index')).to.equal('/en/blog/search-index');
  });

  it('keeps only <em> marks from a highlight', () => {
    const nodes = highlightNodes('a <em>b</em> &lt;i&gt;c');
    expect(nodes.map((n) => n.nodeName)).to.deep.equal(['#text', 'EM', '#text']);
    expect(nodes.map((n) => n.textContent).join('')).to.equal('a b <i>c');
  });

  it('renders a suggestion option that opens the page', () => {
    const link = renderSuggestion(hit('en://arborydigital.com/en/index', 'en', { payload: { title: 'Home' } }));
    expect(link.classList.contains(SUGGESTION_CLASS)).to.be.true;
    expect(link.id).to.match(/^search-suggestion-\d+$/);
    expect(link.getAttribute('href')).to.equal('//arborydigital.com/en/');
    expect(link.textContent).to.equal('Home');
  });
});
