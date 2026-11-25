/* eslint-disable no-underscore-dangle */
/* `window.__pwned` is a sentinel for the markup-injection test — the dangling
   underscores are the point: nothing on the page should be able to set it. */
/**
 * curated-results — the featured "direct answer" and the promo rail.
 *
 * Two things are worth pinning here, and they are worth pinning for different
 * reasons.
 *
 * THE MATCHING RULE is a product decision (whole word, anywhere in the query,
 * first match wins — Frank, 2026-09-10; commas separate synonyms, any of which
 * matches — Frank, 2026-10-07) that is one character away from being a
 * different rule. `includes(term)` instead of `includes(' term ')` turns
 * "consultant" into a match for the `consulting` row, and nobody would notice
 * from the code.
 *
 * THE REJECTIONS are the migration rule against fabricating content, expressed
 * in code: a row with no title is skipped rather than given one, and a link with
 * no label is left off rather than captioned "Learn more". A future refactor that
 * "helpfully" fills those in would be a regression, not a convenience.
 */
import { expect } from '@esm-bundle/chai';
import {
  loadCurated,
  matchCurated,
  readRow,
  renderCurated,
  selectPromos,
  splitTerms,
} from '../../../blocks/search-results-panel/curated-results.js';

/** A DA sheet response, in the envelope `loadCurated` reads. */
const sheet = (data) => ({
  total: data.length,
  limit: data.length,
  offset: 0,
  data,
  ':type': 'sheet',
});

const ROWS = [
  {
    term: 'consulting',
    title: 'Arbory Consulting',
    answer: 'Need help consulting? Contact Us!',
    'url title': 'Learn more about Consulting',
    url: '/about',
  },
  {
    term: 'career',
    title: 'Careers at Arbory',
    answer: 'Join the Arbory team today.',
    'url title': 'Join the team',
    url: '/careers',
  },
];

describe('curated-results', () => {
  let realFetch;
  let served;
  let calls;

  beforeEach(() => {
    realFetch = window.fetch;
    calls = [];
    served = sheet(ROWS);
    window.fetch = async (input) => {
      calls.push(String(input));
      if (served instanceof Error) throw served;
      if (typeof served === 'number') return new Response('', { status: served });
      if (typeof served === 'string') return new Response(served, { status: 200 });
      return new Response(JSON.stringify(served), { status: 200 });
    };
  });

  afterEach(() => {
    window.fetch = realFetch;
  });

  // Each test uses its own path, because loadCurated caches per path for the
  // life of the page — which is itself pinned by the last test in this block.
  let seq = 0;
  const path = () => {
    seq += 1;
    return `/data/featured-${seq}`;
  };

  describe('matching', () => {
    let rows;

    before(async () => {
      const saved = window.fetch;
      window.fetch = async () => new Response(JSON.stringify(sheet(ROWS)), { status: 200 });
      rows = await loadCurated({ path: '/data/featured-matching' });
      window.fetch = saved;
    });

    it('matches a term that is the whole query', () => {
      expect(matchCurated(rows, 'consulting').title).to.equal('Arbory Consulting');
    });

    it('matches a term anywhere in a longer query', () => {
      expect(matchCurated(rows, 'arbory consulting services').title).to.equal('Arbory Consulting');
      expect(matchCurated(rows, 'tax consulting').title).to.equal('Arbory Consulting');
    });

    it('is case- and punctuation-insensitive', () => {
      expect(matchCurated(rows, '  CONSULTING!  ').title).to.equal('Arbory Consulting');
      expect(matchCurated(rows, 'careers/jobs? career').title).to.equal('Careers at Arbory');
    });

    /*
     * The rule this file exists for. `consulting` must not match `consultant`,
     * `consultants` or `consul` — a longer word that merely starts the same way
     * is a different word, and matching it would fire the wrong curated answer.
     */
    it('does NOT match a term that is only a substring of a word', () => {
      ['consultant', 'consultants', 'consul', 'careers-day'].forEach((query) => {
        const hit = matchCurated(rows, query);
        const matched = hit && hit.title === 'Arbory Consulting';
        expect(matched, `"${query}" must not match the consulting row`).to.not.be.true;
      });
      expect(matchCurated(rows, 'consultant')).to.equal(null);
    });

    it('returns null for an empty or whitespace query', () => {
      ['', '   ', null, undefined, '!!!'].forEach((query) => {
        expect(matchCurated(rows, query), JSON.stringify(query)).to.equal(null);
      });
    });

    it('takes the FIRST matching row, so sheet order is priority order', async () => {
      const saved = window.fetch;
      window.fetch = async () => new Response(JSON.stringify(sheet([
        { term: 'tax', title: 'First' },
        { term: 'tax', title: 'Second' },
      ])), { status: 200 });
      const both = await loadCurated({ path: '/data/featured-priority' });
      window.fetch = saved;
      expect(matchCurated(both, 'tax').title).to.equal('First');
    });

    it('matches a multi-word term as a phrase', async () => {
      const saved = window.fetch;
      window.fetch = async () => new Response(JSON.stringify(sheet([
        { term: 'business tax', title: 'Business tax' },
      ])), { status: 200 });
      const phrase = await loadCurated({ path: '/data/featured-phrase' });
      window.fetch = saved;
      expect(matchCurated(phrase, 'business tax advice').title).to.equal('Business tax');
      // The words must be adjacent and in order, or it is not that phrase.
      expect(matchCurated(phrase, 'tax business')).to.equal(null);
    });

    describe('comma-separated synonyms', () => {
      const one = (term) => [readRow({ term, title: 'Taxes' }, 0)];

      it('matches a query containing ANY of the synonyms', () => {
        const synRows = one('taxes, tax');
        expect(matchCurated(synRows, 'taxes').title).to.equal('Taxes');
        expect(matchCurated(synRows, 'sales tax help').title).to.equal('Taxes');
      });

      it('keeps each synonym whole-word, and each phrase a phrase', () => {
        const synRows = one('business tax, tax advice');
        expect(matchCurated(synRows, 'business tax rates').title).to.equal('Taxes');
        expect(matchCurated(synRows, 'free tax advice').title).to.equal('Taxes');
        expect(matchCurated(synRows, 'taxation')).to.equal(null);
        expect(matchCurated(synRows, 'advice')).to.equal(null);
      });

      /*
       * The trap a split introduces. A stray comma leaves an empty piece, and an
       * empty piece normalises to ' ' — which is inside EVERY query. Kept, it
       * would make the row match everything anyone ever types.
       */
      it('drops empty pieces instead of letting them match everything', () => {
        ['tax,', ', tax', 'tax,,', 'tax, ,', 'tax, !!!'].forEach((cell) => {
          const synRows = one(cell);
          expect(synRows[0].terms, cell).to.eql([' tax ']);
          expect(matchCurated(synRows, 'audit'), cell).to.equal(null);
        });
      });

      it('skips a row whose term cell has no real term in it', () => {
        expect(readRow({ term: ', ,', title: 'Nothing' }, 0)).to.equal(null);
      });

      it('keeps each synonym as the author wrote it, and drops duplicates', () => {
        expect(splitTerms(' Taxes ,TAX, taxes ')).to.eql({
          terms: [' taxes ', ' tax '],
          labels: ['Taxes', 'TAX'],
        });
      });

      it('still lets the first matching row win', () => {
        const synRows = [
          readRow({ term: 'audit, tax', title: 'First' }, 0),
          readRow({ term: 'taxes, tax', title: 'Second' }, 1),
        ];
        expect(matchCurated(synRows, 'tax').title).to.equal('First');
        expect(matchCurated(synRows, 'taxes').title).to.equal('Second');
      });
    });
  });

  describe('reading the sheet', () => {
    it('reads a well-formed row, header spelling and all', async () => {
      const [row] = await loadCurated({ path: path() });
      expect(row.title).to.equal('Arbory Consulting');
      // `faq` calls it `answer` and `promo` calls it `description`; the reader
      // normalises both to `body` so a rename cannot break one of them.
      expect(row.body).to.equal('Need help consulting? Contact Us!');
      // `url title` carries a SPACE in the live sheet; the reader normalises keys.
      expect(row.urlTitle).to.equal('Learn more about Consulting');
      expect(row.url).to.equal('/about');
    });

    it('accepts any spelling of the url-title header', async () => {
      served = sheet([{
        term: 'x', title: 'X', 'URL Title': 'Go', url: '/x',
      }]);
      const [a] = await loadCurated({ path: path() });
      expect(a.urlTitle).to.equal('Go');

      served = sheet([{
        term: 'y', title: 'Y', urlTitle: 'Go', url: '/y',
      }]);
      const [b] = await loadCurated({ path: path() });
      expect(b.urlTitle).to.equal('Go');
    });

    /* Fabrication guard: a row that cannot be shown is dropped, not completed. */
    it('skips a row with no term or no title rather than inventing one', async () => {
      served = sheet([
        { term: 'orphan', answer: 'no title here' },
        { title: 'No term', answer: 'unreachable' },
        { term: 'keeper', title: 'Keeper' },
      ]);
      const rows = await loadCurated({ path: path() });
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].title).to.equal('Keeper');
    });

    it('drops the call to action unless it has BOTH a url and a label', async () => {
      served = sheet([
        { term: 'a', title: 'A', url: '/a' },
        { term: 'b', title: 'B', 'url title': 'Label only' },
      ]);
      const rows = await loadCurated({ path: path() });
      rows.forEach((row) => {
        expect(row.url).to.equal('');
        expect(row.urlTitle).to.equal('');
      });
    });

    /*
     * A featured result is an enhancement. Every failure has to resolve to "no
     * featured result" — never a rejection that would take the results panel
     * down with it, since `decorate` does not await this.
     */
    it('resolves to an empty list on every failure, and never throws', async () => {
      const cases = {
        '404 (no such workbook)': 404,
        500: 500,
        'not JSON': 'this is not json',
        'JSON that is not a DA sheet': { hello: 'world' },
        'a network error': new Error('offline'),
      };
      const results = await Promise.all(Object.values(cases).map((response) => {
        served = response;
        return loadCurated({ path: path() });
      }));
      Object.keys(cases).forEach((label, i) => {
        expect(results[i], label).to.deep.equal([]);
      });
    });

    it('does not fetch at all when no sheet is authored', async () => {
      calls = [];
      expect(await loadCurated({ path: '' })).to.deep.equal([]);
      expect(await loadCurated({ path: undefined })).to.deep.equal([]);
      expect(calls).to.have.lengthOf(0);
    });

    it('appends .json only when the authored path lacks it', async () => {
      calls = [];
      const bare = path();
      await loadCurated({ path: bare });
      await loadCurated({ path: `${bare}-explicit.json` });
      expect(calls[0]).to.equal(`${bare}.json`);
      expect(calls[1]).to.equal(`${bare}-explicit.json`);
    });

    it('fetches a given path once, however many panels ask', async () => {
      const shared = path();
      calls = [];
      await Promise.all([
        loadCurated({ path: shared }),
        loadCurated({ path: shared }),
        loadCurated({ path: shared }),
      ]);
      await loadCurated({ path: shared });
      expect(calls).to.have.lengthOf(1);
    });
  });

  /*
   * THE ENVELOPE CHANGES UNDER YOU. DA serves a one-sheet workbook as
   * `{ data: [...] }` and a many-sheet one as
   * `{ ":names": [...], "<name>": { data: [...] } }` — and a workbook silently
   * moves from the first shape to the second the moment somebody adds a sheet.
   *
   * That happened here: the featured reader understood only `body.data` as an
   * array, so adding a `promo` sheet made it reject every row and the panel
   * vanished with no error. The first sheet was then renamed `data` → `faq` in
   * the same afternoon, which a hardcoded name would have broken again.
   */
  describe('resolving a sheet', () => {
    const asSheet = (rows) => ({
      total: rows.length,
      limit: rows.length,
      offset: 0,
      data: rows,
    });
    const multi = (sheets) => ({
      ...Object.fromEntries(
        Object.entries(sheets).map(([name, rows]) => [name, asSheet(rows)]),
      ),
      ':names': Object.keys(sheets),
      ':version': 3,
      ':type': 'multi-sheet',
    });

    const FAQ = [{ term: 'consulting', title: 'Featured', answer: 'A' }];
    const PROMO = [{ term: 'taxes', title: 'Promo', description: 'B' }];

    it('reads a single-sheet workbook, as before', async () => {
      served = sheet(ROWS);
      const rows = await loadCurated({ path: path(), placement: 'featured' });
      expect(rows).to.have.lengthOf(2);
    });

    it('reads the named sheet out of a multi-sheet workbook', async () => {
      served = multi({ faq: FAQ, promo: PROMO });
      const p = path();
      const [featured] = await loadCurated({ path: p, sheet: 'faq' });
      const [promo] = await loadCurated({ path: p, sheet: 'promo' });
      expect(featured.title).to.equal('Featured');
      expect(promo.title).to.equal('Promo');
      expect(promo.body, 'promo says `description`').to.equal('B');
    });

    it('finds each placement\'s sheet with nothing authored', async () => {
      served = multi({ faq: FAQ, promo: PROMO });
      const p = path();
      const [featured] = await loadCurated({ path: p, placement: 'featured' });
      const [promo] = await loadCurated({ path: p, placement: 'promo' });
      expect(featured.title).to.equal('Featured');
      expect(promo.title).to.equal('Promo');
    });

    /* The rename that already happened once. */
    it('accepts either name the featured sheet has had', async () => {
      served = multi({ data: FAQ, promo: PROMO });
      const [byOldName] = await loadCurated({ path: path(), placement: 'featured' });
      expect(byOldName.title).to.equal('Featured');
    });

    it('falls back to the ONLY sheet of a one-sheet workbook', async () => {
      served = multi({ somethingElse: FAQ });
      const [row] = await loadCurated({ path: path(), placement: 'featured' });
      expect(row.title).to.equal('Featured');
    });

    /*
     * But NOT when there are several: picking an arbitrary sheet would render
     * promos as featured answers, which is worse than rendering nothing.
     */
    it('renders nothing rather than guess between several unknown sheets', async () => {
      served = multi({ alpha: FAQ, beta: PROMO });
      const rows = await loadCurated({ path: path(), placement: 'featured' });
      expect(rows).to.deep.equal([]);
    });

    /*
     * The promo rail is strictly opt-in: it must NOT inherit a workbook's only
     * sheet. Sharing the sole-sheet fallback with the featured placement put
     * the FAQ answers down the rail.
     */
    it('never takes the sole sheet for the promo rail', async () => {
      served = multi({ faq: FAQ });
      expect(await loadCurated({ path: path(), placement: 'promo' })).to.deep.equal([]);
      served = sheet(ROWS);
      expect(await loadCurated({ path: path(), placement: 'promo' })).to.deep.equal([]);
    });

    it('renders nothing when the authored sheet name is not there', async () => {
      served = multi({ faq: FAQ, promo: PROMO });
      expect(await loadCurated({ path: path(), sheet: 'nope' })).to.deep.equal([]);
    });

    it('renders no promo rail when the workbook has no promo sheet', async () => {
      served = multi({ faq: FAQ });
      expect(await loadCurated({ path: path(), placement: 'promo' })).to.deep.equal([]);
    });
  });

  /*
   * THE PROMO RAIL IS NOT GATED ON A TERM MATCH. A promotion that only appears
   * for the handful of queries someone wrote a term for is not a promotion, so
   * every search gets one — and `term` demotes from a gate to a priority.
   *
   * These pin the two halves of that separately, because they fail
   * independently: "always shows" and "the right ones first".
   */
  /*
   * THE PROMO SHEET HAS NO `term`. It was removed once the rail became
   * unconditional: a term can only say *whether* a row shows, and the answer is
   * now always "yes". So selection is the sheet's own order, and these pin the
   * two things that used to be term-shaped — that every search gets promos, and
   * that a row with no term cannot accidentally match everything.
   */
  describe('choosing promos', () => {
    const promos = (n) => Array.from({ length: n }, (_, i) => ({
      index: i, term: '', title: `Promo ${i}`, body: '', url: '', urlTitle: '',
    }));

    it('takes the first three, in sheet order', () => {
      expect(selectPromos(promos(5)).map((r) => r.title))
        .to.deep.equal(['Promo 0', 'Promo 1', 'Promo 2']);
    });

    it('shows every promo when there are fewer than three', () => {
      expect(selectPromos(promos(1))).to.have.lengthOf(1);
      expect(selectPromos(promos(2))).to.have.lengthOf(2);
    });

    it('never shows more than three', () => {
      expect(selectPromos(promos(9))).to.have.lengthOf(3);
    });

    it('returns nothing when the sheet is empty', () => {
      expect(selectPromos([])).to.deep.equal([]);
    });

    it('does not depend on the query at all', () => {
      const rows = promos(4);
      const first = selectPromos(rows).map((r) => r.title);
      ['', 'taxes', 'anything at all', null].forEach((q) => {
        expect(selectPromos(rows, q).map((r) => r.title), JSON.stringify(q)).to.deep.equal(first);
      });
    });
  });

  describe('reading a promo row', () => {
    /*
     * A MULTI-sheet workbook, because the promo placement deliberately refuses
     * to take a one-sheet workbook's only sheet — that rule is what stops FAQ
     * answers rendering down the rail, and it is tested in its own right above.
     */
    const asPromoBook = (rows) => ({
      promo: {
        total: rows.length, limit: rows.length, offset: 0, data: rows,
      },
      ':names': ['promo'],
      ':version': 3,
      ':type': 'multi-sheet',
    });

    /*
     * A promo row is kept WITHOUT a term; a featured row is not. Both halves
     * matter: dropping the requirement everywhere would silence the one warning
     * that tells a featured author their row is dead copy.
     */
    it('keeps a promo row that has no term', async () => {
      served = asPromoBook([{ title: 'Termless promo', description: 'Body' }]);
      const rows = await loadCurated({ path: path(), placement: 'promo' });
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].title).to.equal('Termless promo');
      expect(rows[0].terms, 'an absent term is NO terms, not a padded blank').to.eql([]);
    });

    it('still skips a FEATURED row that has no term', async () => {
      served = sheet([
        { title: 'No term here', answer: 'unreachable' },
        { term: 'keeper', title: 'Keeper' },
      ]);
      const rows = await loadCurated({ path: path(), placement: 'featured' });
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].title).to.equal('Keeper');
    });

    it('still skips any row with no title', async () => {
      served = asPromoBook([{ description: 'nothing to show' }]);
      expect(await loadCurated({ path: path(), placement: 'promo' })).to.deep.equal([]);
    });

    /*
     * The trap this guards. `normalize('')` is a single SPACE, and every
     * non-empty query contains a space — so a termless row stored that way would
     * win every match, ahead of every real one.
     */
    it('a termless row never matches a query', () => {
      const rows = [
        { index: 0, terms: [], title: 'Termless' },
        { index: 1, terms: [' taxes '], title: 'Taxes' },
      ];
      expect(matchCurated(rows, 'taxes').title).to.equal('Taxes');
      expect(matchCurated(rows, 'something else entirely')).to.equal(null);
    });
  });

  describe('rendering', () => {
    const render = async (raw) => {
      served = sheet([raw]);
      const [row] = await loadCurated({ path: path() });
      return renderCurated(row);
    };

    it('renders the heading as an h3', async () => {
      const panel = await render(ROWS[0]);
      const title = panel.querySelector('.search-results-panel-curated__title');
      // h3 by request — the rank this panel holds in the type system. It
      // skips a level from the page's h1, which is a heading-order best
      // practice rather than a conformance failure; see renderCurated.
      expect(title.tagName).to.equal('H3');
      expect(title.textContent).to.equal('Arbory Consulting');
    });

    it('renders the answer and the call to action', async () => {
      const panel = await render(ROWS[0]);
      expect(panel.querySelector('.search-results-panel-curated__body').textContent)
        .to.equal('Need help consulting? Contact Us!');
      const cta = panel.querySelector('.search-results-panel-curated__cta');
      expect(cta.getAttribute('href')).to.equal('/about');
      expect(cta.textContent.trim()).to.equal('Learn more about Consulting');
      // Decorative, so it must not be announced alongside the link text.
      expect(cta.querySelector('.search-results-panel-curated__chevron')
        .getAttribute('aria-hidden')).to.equal('true');
    });

    it('omits the answer and the cta when the row has neither', async () => {
      const panel = await render({ term: 'bare', title: 'Bare' });
      expect(panel.querySelector('.search-results-panel-curated__body')).to.equal(null);
      expect(panel.querySelector('.search-results-panel-curated__cta')).to.equal(null);
      expect(panel.querySelector('.search-results-panel-curated__title')).to.not.equal(null);
    });

    /* Sheet content is author input. It reaches the DOM as text, never markup. */
    it('never parses sheet content as markup', async () => {
      const panel = await render({
        term: 'xss',
        title: '<img src=x onerror="window.__pwned = true">',
        answer: '<script>window.__pwned = true;</script>',
        'url title': '<b>bold</b>',
        url: '/safe',
      });
      expect(panel.querySelector('img'), 'no element from the title').to.equal(null);
      expect(panel.querySelector('script'), 'no element from the answer').to.equal(null);
      expect(panel.querySelector('b'), 'no element from the link label').to.equal(null);
      expect(panel.querySelector('.search-results-panel-curated__title').textContent)
        .to.equal('<img src=x onerror="window.__pwned = true">');
      expect(window.__pwned, 'nothing executed').to.equal(undefined);
    });
  });
});
