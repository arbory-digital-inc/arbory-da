/* eslint-disable no-unused-expressions, no-underscore-dangle */
import { expect } from '@esm-bundle/chai';
import {
  cleanTitle, formatDate, imageUrl, pageKey, pageText, pickHits, readConfig, renderCard,
  requestBody,
} from '../../../blocks/search-mlt-suggestions/search-mlt-suggestions.js';

const hit = (id, payload = {}, namespace = 'en') => ({ _id: id, _source: { namespace, payload } });

describe('search-mlt-suggestions', () => {
  it('reads the authored rows, whatever their spelling', () => {
    const block = document.createElement('div');
    block.innerHTML = '<div><div>Count</div><div>4</div></div>'
      + '<div><div>Content type</div><div> Article </div></div><div><div>lonely</div></div>';
    expect(readConfig(block)).to.deep.equal({ count: '4', contenttype: 'Article' });
  });

  it('keys the page the way the index does, by its locale folder', () => {
    expect(pageKey('/en/blog/tailing-aemaacs-logs')).to.deep.equal({ namespace: 'en', id: 'en:/en/blog/tailing-aemaacs-logs' });
    expect(pageKey('/de/aem-66-and-jdk-17')).to.deep.equal({ namespace: 'de', id: 'de:/de/aem-66-and-jdk-17' });
    expect(pageKey('/zh-cn/blog/')).to.deep.equal({ namespace: 'zh-cn', id: 'zh-cn:/zh-cn/blog/index' });
  });

  it('asks the arbory-mlt template, in the page language, with spare hits', () => {
    const body = requestBody({
      namespace: 'de', id: 'de:/de/x', text: 'hallo', count: 3, contentType: '',
    });
    expect(body).to.deep.equal({
      id: 'arbory-mlt',
      params: {
        namespace: 'de', id: 'de:/de/x', text: 'hallo', size: '6',
      },
    });
    expect(requestBody({
      namespace: 'en', id: 'en:/en/x', text: '', count: 3, contentType: 'Podcast',
    }).params.content_type).to.equal('Podcast');
  });

  it('drops the article itself, copies of it and repeated titles', () => {
    const hits = [
      hit('en:/en/blog/a', { title: 'Blog | Same Article' }),
      hit('en:/en/drafts/me', { title: 'Something' }),
      hit('en:/en/blog/b', { title: 'B' }),
      hit('en:/en/podcast/b', { title: 'b' }),
      hit('en:/en/blog/c', { title: 'C' }),
      hit('en:/en/blog/d', { title: 'D' }),
      hit('en:/en/blog/e', {}),
    ];
    const picked = pickHits(hits, { count: 3, title: 'Same Article', path: '/en/drafts/me' });
    expect(picked.map((h) => h._id)).to.deep.equal(['en:/en/blog/b', 'en:/en/blog/c', 'en:/en/blog/d']);
  });

  it('strips a section prefix from a title', () => {
    expect(cleanTitle('Blog | Adobe Summit Decoded')).to.equal('Adobe Summit Decoded');
    expect(cleanTitle('AEM | CDN logs')).to.equal('AEM | CDN logs');
  });

  it('puts an indexed image path on the hit\'s host, sized', () => {
    const blog = hit('en:/en/blog/a', { image: '/en/blog/media_1.jpg?width=1200&format=pjpg&optimize=medium' });
    expect(imageUrl(blog, 750, 'webply')).to.equal('/en/blog/media_1.jpg?width=750&format=webply&optimize=medium');
    const www = hit('en://arborydigital.com/en/customer-stories/x', { image: '/media_2.png' });
    expect(imageUrl(www, 750, 'pjpg')).to.equal('//arborydigital.com/media_2.png?width=750&format=pjpg&optimize=medium');
    expect(imageUrl(hit('en:/en/x', { image: 'https://cdn.example.com/a.png' }), 750, 'pjpg'))
      .to.equal('https://cdn.example.com/a.png');
    expect(imageUrl(hit('en:/en/x', {}), 750, 'pjpg')).to.be.null;
  });

  it('writes dates the page language\'s way', () => {
    expect(formatDate('2025-03-04', 'en')).to.equal('March 4, 2025');
    expect(formatDate('2025-03-04', 'de')).to.equal('4. März 2025');
    expect(formatDate('', 'en')).to.equal('');
  });

  it('renders a card from index values as text only', () => {
    const card = renderCard(hit('en:/en/blog/a', {
      title: 'Blog | <img src=x onerror=alert(1)>',
      description: 'Desc',
      date: '2024-05-01',
      facets: { content_type_level0: ['Article'], author_level0: ['Tad Reeves', 'Hank Thobe'] },
    }), 'en');
    expect(card.querySelector('a').getAttribute('href')).to.equal('/en/blog/a');
    expect(card.querySelector('img')).to.be.null;
    expect(card.querySelector('h3').textContent).to.equal('<img src=x onerror=alert(1)>');
    expect(card.querySelector('.search-mlt-suggestions-type').textContent).to.equal('Article');
    expect(card.querySelector('time').dateTime).to.equal('2024-05-01');
    expect(card.querySelector('.search-mlt-suggestions-author').textContent).to.equal('Tad Reeves, Hank Thobe');
  });

  it('translates the content type', () => {
    const card = renderCard(hit('de:/de/x', { title: 'X', facets: { content_type_level0: ['Customer story'] } }, 'de'), 'de');
    expect(card.querySelector('.search-mlt-suggestions-type').textContent).to.equal('Kundenstory');
  });

  it('reads only the article copy above the block', () => {
    const doc = document.implementation.createHTMLDocument('Page');
    doc.body.innerHTML = '<main><div class="section"><h1>Tailing logs</h1><p>Body text about CDN logs.</p>'
      + '<div class="article-feed"><p>feed text</p></div></div>'
      + '<div class="section"><h2>More like this</h2><div class="block"></div><p>after the block</p></div></main>';
    const text = pageText(doc.querySelector('.block'), doc);
    expect(text).to.contain('Tailing logs');
    expect(text).to.contain('Body text about CDN logs.');
    expect(text).not.to.contain('feed text');
    expect(text).not.to.contain('after the block');
  });
});
