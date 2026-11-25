/**
 * search-operators — `AND`, `OR` and "quoted phrases" in the query box.
 *
 * The rules are product decisions that sit one character from a different rule:
 * `token.toUpperCase() === 'AND'` instead of `token === 'AND'` turns "mergers
 * and acquisitions" into an AND of two operands, and nobody would notice from
 * the code. So each rule is pinned here by name.
 *
 * The other half of the contract, that the template matches what this sends, is
 * pinned in streamx-config (`scripts/mesh/test_migrations.py`, AndOrOperators
 * and QuotedPhrases), which renders the template with the same `operators` shape.
 */
import { expect } from '@esm-bundle/chai';
import {
  installOperatorRequestHook,
  operatorsParam,
  parseOperators,
  withOperators,
} from '../../../blocks/search-results-panel/search-operators.js';

/** An operand: its loose words and its phrases. */
const op = (text, phrases = []) => ({ text, phrases });

/** The groups of a parse, or null. */
const groupsOf = (query) => parseOperators(query)?.groups ?? null;

describe('search-operators', () => {
  describe('parseOperators: AND / OR', () => {
    it('leaves a query with no operator or phrase alone', () => {
      expect(parseOperators('tax audit')).to.equal(null);
      expect(parseOperators('')).to.equal(null);
      expect(parseOperators(undefined)).to.equal(null);
    });

    it('treats only UPPERCASE AND / OR as operators', () => {
      expect(parseOperators('mergers and acquisitions')).to.equal(null);
      expect(parseOperators('tax or audit')).to.equal(null);
      expect(parseOperators('tax And audit')).to.equal(null);
      expect(parseOperators('tax Or audit')).to.equal(null);
    });

    it('treats an operator only when it stands alone', () => {
      expect(parseOperators('ANDROID ORACLE')).to.equal(null);
      expect(parseOperators('R&D tax')).to.equal(null);
    });

    it('ANDs', () => {
      expect(parseOperators('tax AND audit')).to.deep.equal({ query: 'tax audit', groups: [[op('tax'), op('audit')]] });
    });

    it('ORs', () => {
      expect(parseOperators('tax OR audit')).to.deep.equal({ query: 'tax audit', groups: [[op('tax')], [op('audit')]] });
    });

    it('binds AND tighter than OR', () => {
      expect(groupsOf('tax OR audit AND risk')).to.deep.equal([[op('tax')], [op('audit'), op('risk')]]);
      expect(groupsOf('tax AND audit OR risk')).to.deep.equal([[op('tax'), op('audit')], [op('risk')]]);
    });

    it('keeps the words between two operators together as one operand', () => {
      expect(groupsOf('private equity AND tax credit'))
        .to.deep.equal([[op('private equity'), op('tax credit')]]);
    });

    it('drops a leading or trailing operator', () => {
      expect(groupsOf('AND tax audit')).to.deep.equal([[op('tax audit')]]);
      expect(groupsOf('tax audit OR')).to.deep.equal([[op('tax audit')]]);
    });

    it('counts a run of operators once, as OR if it holds one', () => {
      expect(groupsOf('tax AND AND audit')).to.deep.equal([[op('tax'), op('audit')]]);
      expect(groupsOf('tax AND OR audit')).to.deep.equal([[op('tax')], [op('audit')]]);
      expect(groupsOf('tax OR AND audit')).to.deep.equal([[op('tax')], [op('audit')]]);
    });

    it('searches a query of nothing but operators as words', () => {
      expect(parseOperators('AND')).to.equal(null);
      expect(parseOperators('OR AND')).to.equal(null);
    });

    it('ignores extra whitespace', () => {
      expect(parseOperators('  tax\tAND   audit ')).to.deep.equal({ query: 'tax audit', groups: [[op('tax'), op('audit')]] });
    });

    it('leaves brackets in the words, as before', () => {
      expect(groupsOf('(tax AND audit)')).to.deep.equal([[op('(tax'), op('audit)')]]);
    });
  });

  describe('parseOperators: quoted phrases', () => {
    it('makes a quoted phrase', () => {
      expect(parseOperators('"annual report"')).to.deep.equal({ query: 'annual report', groups: [[op('', ['annual report'])]] });
    });

    it('accepts curly quotes, as phones type them', () => {
      expect(groupsOf('“annual report”')).to.deep.equal([[op('', ['annual report'])]]);
    });

    it('keeps loose words beside a phrase in the same operand', () => {
      expect(groupsOf('"annual report" tax')).to.deep.equal([[op('tax', ['annual report'])]]);
      expect(groupsOf('tax "annual report" audit')).to.deep.equal([[op('tax audit', ['annual report'])]]);
    });

    it('allows several phrases in one operand', () => {
      expect(groupsOf('"annual report" "supply chain"'))
        .to.deep.equal([[op('', ['annual report', 'supply chain'])]]);
    });

    it('combines phrases with AND and OR', () => {
      expect(groupsOf('"annual report" AND audit OR "private equity"'))
        .to.deep.equal([[op('', ['annual report']), op('audit')], [op('', ['private equity'])]]);
    });

    it('reads AND / OR inside quotes as words', () => {
      expect(groupsOf('"mergers AND acquisitions"')).to.deep.equal([[op('', ['mergers AND acquisitions'])]]);
    });

    it('delimits on quotes with no spaces around them', () => {
      expect(groupsOf('tax"annual report"audit')).to.deep.equal([[op('tax audit', ['annual report'])]]);
    });

    it('ignores an unpaired last quote', () => {
      expect(parseOperators('"annual report')).to.equal(null);
      expect(parseOperators('annual report"')).to.equal(null);
      expect(groupsOf('"annual report" "supply chain')).to.deep.equal([[op('supply chain', ['annual report'])]]);
      expect(groupsOf('tax AND "audit')).to.deep.equal([[op('tax'), op('audit')]]);
    });

    it('ignores empty quotes', () => {
      expect(parseOperators('""')).to.equal(null);
      expect(parseOperators('tax "  " audit')).to.equal(null);
    });

    it('collapses the whitespace inside a phrase', () => {
      expect(groupsOf('"  annual \t report "')).to.deep.equal([[op('', ['annual report'])]]);
    });

    it('sends &, <, > as spaces, since the analyzer splits on them anyway', () => {
      expect(groupsOf('"R&D tax credit"')).to.deep.equal([[op('', ['R D tax credit'])]]);
      expect(groupsOf('"<b>tax</b>"')).to.deep.equal([[op('', ['b tax /b'])]]);
    });

    it('keeps apostrophes, which the analyzer keeps inside a word', () => {
      expect(groupsOf('"Arbory\'s outlook"')).to.deep.equal([[op('', ["Arbory's outlook"])]]);
    });
  });

  describe('operatorsParam', () => {
    it('sets every flag, true or false', () => {
      expect(operatorsParam([[op('tax', ['annual report']), op('audit')], [op('', ['a b', 'c d'])]])).to.deep.equal({
        any_of: [
          {
            all_of: [
              {
                text: 'tax',
                has_phrases: true,
                phrases: [{ phrase: 'annual report', last_phrase: true }],
                last_term: false,
              },
              {
                text: 'audit', has_phrases: false, phrases: [], last_term: true,
              },
            ],
            last_group: false,
          },
          {
            all_of: [{
              text: '',
              has_phrases: true,
              phrases: [{ phrase: 'a b', last_phrase: false }, { phrase: 'c d', last_phrase: true }],
              last_term: true,
            }],
            last_group: true,
          },
        ],
      });
    });
  });

  describe('withOperators', () => {
    it('returns null for a request to send unchanged', () => {
      expect(withOperators({ query: 'tax audit', size: 10 })).to.equal(null);
      expect(withOperators({ query: 'annual report"', size: 10 })).to.equal(null);
      expect(withOperators({ size: 10 })).to.equal(null);
      expect(withOperators(undefined)).to.equal(null);
    });

    it('adds operators and strips them from the query', () => {
      const params = withOperators({ query: 'tax AND audit', size: 10, namespace: 'us' });
      expect(params.query).to.equal('tax audit');
      expect(params.size).to.equal(10);
      expect(params.namespace).to.equal('us');
      expect(params.operators).to.deep.equal(operatorsParam([[op('tax'), op('audit')]]));
    });

    it('sends a single phrase as operators, since it is not a plain query', () => {
      const params = withOperators({ query: '"annual report"' });
      expect(params.query).to.equal('annual report');
      expect(params.operators).to.deep.equal(operatorsParam([[op('', ['annual report'])]]));
    });

    it('sends a one-operand expression without a phrase as a plain query', () => {
      expect(withOperators({ query: 'tax AND' })).to.deep.equal({ query: 'tax' });
      expect(withOperators({ query: 'OR private equity' })).to.deep.equal({ query: 'private equity' });
    });

    it('does not mutate the params it was given', () => {
      const params = { query: 'tax OR "audit risk"' };
      withOperators(params);
      expect(params).to.deep.equal({ query: 'tax OR "audit risk"' });
    });
  });

  describe('installOperatorRequestHook', () => {
    const realFetch = window.fetch;
    const seen = [];

    before(() => {
      window.fetch = async (input, init) => {
        seen.push({ input, init });
        return new Response('{}');
      };
      installOperatorRequestHook();
      installOperatorRequestHook(); // idempotent: a page may carry both blocks
    });

    after(() => {
      window.fetch = realFetch;
    });

    beforeEach(() => {
      seen.length = 0;
    });

    const post = (body) => window.fetch('https://example.test/search/arbory-pages/body', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    it('parses the operators of a search POST', async () => {
      await post({ id: 'arbory-pages', params: { query: 'tax AND audit', from: 0 } });
      const sent = JSON.parse(seen[0].init.body);
      expect(sent.id).to.equal('arbory-pages');
      expect(sent.params.query).to.equal('tax audit');
      expect(sent.params.from).to.equal(0);
      expect(sent.params.operators).to.deep.equal(operatorsParam([[op('tax'), op('audit')]]));
    });

    it('parses the phrase of a search POST', async () => {
      await post({ id: 'arbory-pages', params: { query: '"annual report"' } });
      const sent = JSON.parse(seen[0].init.body);
      expect(sent.params.query).to.equal('annual report');
      expect(sent.params.operators).to.deep.equal(operatorsParam([[op('', ['annual report'])]]));
    });

    it('wraps once, however many blocks install it', async () => {
      await post({ params: { query: 'tax AND audit' } });
      expect(seen).to.have.length(1);
    });

    it('passes a query without operators through byte for byte', async () => {
      const body = JSON.stringify({ id: 'arbory-pages', params: { query: 'tax and audit' } });
      await post(body);
      expect(seen[0].init.body).to.equal(body);
    });

    it('passes GETs through, so the suggestion dropdown is untouched', async () => {
      await window.fetch('https://example.test/search/pages?query=tax+AND+audit');
      expect(seen[0].init).to.equal(undefined);
    });

    it('passes a body it cannot read through', async () => {
      await post('not json');
      expect(seen[0].init.body).to.equal('not json');
      await post({ query: 'tax AND audit' });
      expect(JSON.parse(seen[1].init.body)).to.deep.equal({ query: 'tax AND audit' });
    });
  });
});
