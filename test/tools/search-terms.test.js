import { expect } from '@esm-bundle/chai';
import {
  parseAll, diagnose, shadowedBy, lostTerms, winnerFor, outcomeFor, worst,
} from '../../tools/search-terms/st-model.js';
import { columnsFor, sheetDef } from '../../tools/search-terms/st-config.js';
import {
  splitSheets, bodyKeysFor, buildWorkbook, toSheetRow, fromSheetRow, reconcile, changedSheets,
} from '../../tools/search-terms/st-sheet.js';
import { place } from '../../tools/search-terms/st-preview.js';

/*
 * The Search Terms Manager's pure halves: what a set of rows will DO, and what
 * gets written back to DA.
 *
 * Both are worth pinning for the same reason — they fail silently. A row the
 * block skips, a row no query can reach, and a workbook written in the wrong
 * envelope all look like correct content in the sheet editor and produce an
 * empty panel on the page.
 */

const row = (over = {}) => ({
  term: '', title: '', body: '', urlTitle: '', url: '', ...over,
});

describe('what a row will do', () => {
  it('skips a row with no term or no title, as the block does', () => {
    const rows = [row({ term: 'tax', title: 'Tax' }), row({ term: 'audit' }), row({ title: 'No term' })];
    const parsed = parseAll(rows);
    expect(parsed.map(Boolean)).to.eql([true, false, false]);
    expect(diagnose(rows[1], 1, parsed, 'faq')[0].level).to.equal('error');
    expect(diagnose(rows[2], 2, parsed, 'faq')[0].message).to.contain('No term');
  });

  it('reads a comma-separated term as synonyms, with nothing to warn about', () => {
    const rows = [row({ term: 'career, careers', title: 'Careers' })];
    const parsed = parseAll(rows, 'faq');
    expect(winnerFor(parsed, 'careers').title).to.equal('Careers');
    expect(winnerFor(parsed, 'career fair').title).to.equal('Careers');
    expect(diagnose(rows[0], 0, parsed, 'faq')).to.eql([]);
  });

  it('calls a term cell of only commas a missing term, as the block skips it', () => {
    const rows = [row({ term: ', ,', title: 'Nothing' })];
    const parsed = parseAll(rows, 'faq');
    expect(parsed[0]).to.equal(null);
    expect(diagnose(rows[0], 0, parsed, 'faq')[0].message).to.contain('No term');
  });

  it('warns when a link has only one of url and url title', () => {
    const rows = [row({ term: 'tax', title: 'Tax', url: '/tax' })];
    const parsed = parseAll(rows);
    const issues = diagnose(rows[0], 0, parsed, 'faq');
    expect(issues[0].level).to.equal('warning');
    expect(issues[0].message).to.contain('URL title');
    // The row still renders — only its call to action is dropped.
    expect(parsed[0].url).to.equal('');
  });
});

describe('rows that can never be reached', () => {
  it('finds a row whose term contains an earlier row term as a whole word', () => {
    const rows = [row({ term: 'tax', title: 'Tax' }), row({ term: 'business tax', title: 'Business tax' })];
    const parsed = parseAll(rows);
    expect(shadowedBy(parsed, 1)).to.equal(0);
    // …and proves it against the block's own matcher.
    expect(winnerFor(parsed, 'business tax advice').label).to.equal('tax');
  });

  it('lets the more specific row win when it is ordered first', () => {
    const rows = [row({ term: 'business tax', title: 'Business tax' }), row({ term: 'tax', title: 'Tax' })];
    const parsed = parseAll(rows);
    expect(shadowedBy(parsed, 1)).to.equal(-1);
    expect(winnerFor(parsed, 'business tax advice').label).to.equal('business tax');
    expect(winnerFor(parsed, 'sales tax').label).to.equal('tax');
  });

  it('treats a duplicate term as shadowed by its twin', () => {
    const rows = [row({ term: 'tax', title: 'First' }), row({ term: 'tax', title: 'Second' })];
    expect(shadowedBy(parseAll(rows), 1)).to.equal(0);
  });

  it('is not dead while any synonym still reaches it', () => {
    // `tax` goes to row 1 first, but `taxes` still reaches row 2.
    const rows = [row({ term: 'tax', title: 'Tax' }), row({ term: 'taxes, tax', title: 'Taxes' })];
    const parsed = parseAll(rows, 'faq');
    expect(shadowedBy(parsed, 1)).to.equal(-1);
    expect(lostTerms(parsed, 1)).to.eql([{ label: 'tax', by: 0 }]);
    const issues = diagnose(rows[1], 1, parsed, 'faq');
    expect(issues).to.have.length(1);
    expect(issues[0].level).to.equal('warning');
    expect(issues[0].message).to.contain('"tax" (row 1)').and.contain('other terms still work');
    expect(winnerFor(parsed, 'taxes').title).to.equal('Taxes');
  });

  it('is dead when one earlier row takes every synonym', () => {
    const rows = [row({ term: 'tax', title: 'Tax' }), row({ term: 'business tax, tax', title: 'B' })];
    const parsed = parseAll(rows, 'faq');
    expect(shadowedBy(parsed, 1)).to.equal(0);
    expect(diagnose(rows[1], 1, parsed, 'faq')[0].message).to.match(/^Never reached: row 1 /);
  });

  it('is dead when DIFFERENT earlier rows take its synonyms between them', () => {
    const rows = [
      row({ term: 'tax', title: 'Tax' }),
      row({ term: 'audit', title: 'Audit' }),
      row({ term: 'tax, audit', title: 'Both' }),
    ];
    const parsed = parseAll(rows, 'faq');
    expect(shadowedBy(parsed, 2)).to.equal(-1);
    const [issue] = diagnose(rows[2], 2, parsed, 'faq');
    expect(issue.message).to.match(/^Never reached: rows 1 and 2 between them/);
  });

  it('does not call a partial word a shadow', () => {
    // `consulting` must not shadow `consultant`: different word, not a longer one.
    const rows = [row({ term: 'consulting', title: 'A' }), row({ term: 'consultant', title: 'B' })];
    expect(shadowedBy(parseAll(rows), 1)).to.equal(-1);
  });
});

/*
 * THE TWO SHEETS STOPPED BEING THE SAME SHAPE.
 *
 * The promo rail is unconditional — its first three rows show on every search —
 * so it has no `term` column, and every term-shaped rule has to stop applying to
 * it. Each of these is a diagnostic that would now be actively WRONG on the
 * promo sheet: telling an author a row is skipped, or unreachable, when it is
 * neither.
 */
describe('the promo sheet has no term', () => {
  it('declares as much, and writes no term column', () => {
    expect(sheetDef('faq').hasTerm).to.equal(true);
    expect(sheetDef('promo').hasTerm).to.equal(false);
    expect(columnsFor('faq')).to.include('term');
    expect(columnsFor('promo')).to.not.include('term');
  });

  it('keeps a termless promo row that the featured sheet would skip', () => {
    const rows = [row({ title: 'Termless', body: 'Shown anyway' })];
    expect(parseAll(rows, 'promo').map(Boolean)).to.eql([true]);
    expect(parseAll(rows, 'faq').map(Boolean)).to.eql([false]);
  });

  it('still skips a promo row with no title', () => {
    expect(parseAll([row({ body: 'nothing to show' })], 'promo').map(Boolean)).to.eql([false]);
  });

  it('does not ask a promo row for a term', () => {
    const rows = [row({ title: 'Termless' })];
    const parsed = parseAll(rows, 'promo');
    const messages = diagnose(rows[0], 0, parsed, 'promo').map((i) => i.message).join(' ');
    expect(messages).to.not.contain('No term');
  });

  /*
   * Shadowing is a first-match-wins property. On the rail every row is
   * reachable, so the warning must not fire — it would call row four "never
   * reached" when it is simply fourth.
   */
  it('never calls a promo row unreachable', () => {
    const rows = [row({ title: 'A' }), row({ title: 'B' }), row({ title: 'C' })];
    const parsed = parseAll(rows, 'promo');
    rows.forEach((r, i) => {
      const messages = diagnose(r, i, parsed, 'promo').map((issue) => issue.message).join(' ');
      expect(messages, `row ${i + 1}`).to.not.contain('Never reached');
    });
  });
});

describe('what a query actually gets', () => {
  const faqRows = [row({ term: 'tax', title: 'Tax' }), row({ term: 'audit', title: 'Audit' })];
  const promoRows = [
    row({ title: 'One' }), row({ title: 'Two' }), row({ title: 'Three' }), row({ title: 'Four' }),
  ];

  it('gives the featured sheet at most one row, and only on a match', () => {
    const parsed = parseAll(faqRows, 'faq');
    expect(outcomeFor(parsed, 'tax advice', 'faq').map((r) => r.title)).to.eql(['Tax']);
    expect(outcomeFor(parsed, 'nothing here', 'faq')).to.eql([]);
  });

  it('gives the rail its first three, whatever was typed', () => {
    const parsed = parseAll(promoRows, 'promo');
    ['', 'tax', 'anything at all'].forEach((query) => {
      expect(outcomeFor(parsed, query, 'promo').map((r) => r.title), JSON.stringify(query))
        .to.eql(['One', 'Two', 'Three']);
    });
  });

  it('gives the rail nothing only when the sheet is empty', () => {
    expect(outcomeFor(parseAll([], 'promo'), 'tax', 'promo')).to.eql([]);
  });
});

describe('the promo copy budget', () => {
  it('notes a cramped heading on the promo sheet only', () => {
    const long = row({ term: 'tax', title: 'A heading far too long for a 170px rail' });
    expect(worst(diagnose(long, 0, parseAll([long]), 'promo'))).to.equal('note');
    expect(diagnose(long, 0, parseAll([long]), 'faq')).to.eql([]);
  });
});

describe('the workbook envelope', () => {
  it('reads a legacy single sheet as the featured content, never as promos', () => {
    const sheets = splitSheets({ ':type': 'sheet', data: [{ term: 'tax', title: 'Tax' }] });
    expect(sheets.faq).to.have.length(1);
    expect(sheets.promo).to.eql([]);
  });

  it('reads a multi-sheet workbook by name', () => {
    const sheets = splitSheets({
      ':type': 'multi-sheet',
      ':names': ['faq', 'promo'],
      faq: { data: [{ term: 'a', title: 'A' }] },
      promo: { data: [{ term: 'b', title: 'B' }] },
    });
    expect(sheets.faq[0].term).to.equal('a');
    expect(sheets.promo[0].term).to.equal('b');
  });

  it('keeps whichever body header the sheet already uses', () => {
    const sheets = { faq: [{ term: 'a', title: 'A', summary: 'S' }], promo: [] };
    expect(bodyKeysFor(sheets).faq).to.equal('summary');
    // …and falls back to the documented default for an empty sheet.
    expect(bodyKeysFor(sheets).promo).to.equal('description');
  });

  it('writes multi-sheet, and omits an empty promo sheet', () => {
    const body = JSON.parse(buildWorkbook(null, { faq: [{ term: 'a' }], promo: [] }));
    expect(body[':type']).to.equal('multi-sheet');
    // A FRESH workbook gets the sheet's current name, not the key.
    expect(body[':names']).to.eql(['featured-results']);
    // No promo sheet means no rail — the state the documentation describes.
    expect(body.promo).to.equal(undefined);
  });

  /*
   * THE SHEET HAS BEEN RENAMED TWICE — `data`, then `faq`, now
   * `featured-results`. Reading the wrong name is not a read error, it is an
   * EMPTY sheet, which the tool would then offer to save over the top of the
   * real one. These pin both halves: find it whatever it is called, and write it
   * back where it was found rather than alongside under a new name.
   */
  it('reads the featured sheet under any name it has had', () => {
    const rows = [{ term: 'a', title: 'A' }];
    ['featured-results', 'faq', 'data'].forEach((name) => {
      const raw = { ':type': 'multi-sheet', ':names': [name], [name]: { data: rows } };
      expect(splitSheets(raw).faq, name).to.have.length(1);
    });
  });

  it('writes a renamed sheet back under its own name, not a second one', () => {
    const previous = {
      ':type': 'multi-sheet',
      ':names': ['featured-results', 'promo'],
      'featured-results': { data: [{ term: 'old', title: 'Old' }] },
      promo: { data: [] },
    };
    const body = JSON.parse(buildWorkbook(previous, { faq: [{ term: 'new' }], promo: [] }));
    expect(body[':names']).to.eql(['featured-results']);
    expect(body['featured-results'].data[0].term).to.equal('new');
    expect(body.faq, 'no duplicate under the old name').to.equal(undefined);
  });

  it('keeps writing a legacy faq sheet under faq', () => {
    const previous = { ':type': 'multi-sheet', ':names': ['faq'], faq: { data: [{ term: 'old' }] } };
    const body = JSON.parse(buildWorkbook(previous, { faq: [{ term: 'new' }], promo: [] }));
    expect(body[':names']).to.eql(['faq']);
    expect(body['featured-results'], 'the sheet is not renamed under the author').to.equal(undefined);
  });

  it('carries through sheets and column widths it does not model', () => {
    const previous = {
      ':type': 'multi-sheet',
      ':names': ['faq', 'notes'],
      faq: { data: [], ':colWidths': [175, 400] },
      notes: { data: [{ a: 1 }] },
    };
    const body = JSON.parse(buildWorkbook(previous, { faq: [{ term: 'a' }], promo: [] }));
    expect(body[':names']).to.eql(['faq', 'notes']);
    expect(body.notes.data).to.eql([{ a: 1 }]);
    expect(body.faq[':colWidths']).to.eql([175, 400]);
  });

  /*
   * The two sheets no longer store the same columns. The promo rail is
   * unconditional — its first three rows show on every search — so a `term`
   * would decide nothing, and the column was dropped from the sheet.
   */
  it('round-trips a FEATURED row, term and all', () => {
    const original = row({
      term: 'tax', title: 'Tax', body: 'Help.', urlTitle: 'Learn more', url: '/tax',
    });
    const stored = toSheetRow(original, 'faq', 'answer');
    expect(Object.keys(stored)).to.eql(['term', 'title', 'answer', 'url title', 'url']);
    expect(fromSheetRow(stored).title).to.equal('Tax');
  });

  it('writes no term column on the promo sheet', () => {
    const original = row({
      title: 'Tax', body: 'Help.', urlTitle: 'Learn more', url: '/tax',
    });
    const stored = toSheetRow(original, 'promo', 'description');
    expect(Object.keys(stored)).to.eql(['title', 'description', 'url title', 'url']);
  });

  it('reads a header however it is spelled, as the block does', () => {
    expect(fromSheetRow({ Term: 'tax', Title: 'Tax', urlTitle: 'Go' }).urlTitle).to.equal('Go');
    expect(fromSheetRow({ term: 'tax', 'URL Title': 'Go' }).urlTitle).to.equal('Go');
  });
});

/*
 * Save re-reads DA and decides per sheet whose rows to write. It used to write
 * the tab's whole copy, which is how one browser's featured-answer save wiped
 * the promo rail another had saved since that tab opened.
 */
describe('a save made after someone else saved', () => {
  const faq = (term) => ({ term, title: term.toUpperCase() });
  const promo = (title) => ({
    title, description: '', 'url title': '', url: '',
  });
  const ui = (rows) => rows.map(fromSheetRow);

  it('writes this tab when nobody else has saved', () => {
    const base = { faq: [faq('tax')], promo: [] };
    const mine = { faq: ui([faq('tax'), faq('audit')]), promo: [] };
    expect(reconcile(base, mine, base)).to.eql({
      same: ['promo'], mine: ['faq'], theirs: [], both: [],
    });
  });

  it('keeps a sheet only somebody else changed, as they left it', () => {
    const base = { faq: [faq('tax')], promo: [] };
    const mine = { faq: ui([faq('tax'), faq('audit')]), promo: [] };
    const theirs = { faq: [faq('tax')], promo: [promo('Jobs'), promo('Blog')] };
    expect(reconcile(base, mine, theirs)).to.eql({
      same: [], mine: ['faq'], theirs: ['promo'], both: [],
    });
  });

  /*
   * `same` is written from DA's rows, not re-serialized from the tab's. The
   * comparison sees only the modelled columns, so a column added in DA's sheet
   * editor is invisible to it — and would be dropped by a save that rewrote a
   * sheet it never touched.
   */
  it('leaves a sheet this tab did not change to DA, unmodelled columns and all', () => {
    const base = { faq: [faq('tax')], promo: [promo('Jobs')] };
    const mine = { faq: ui([faq('audit')]), promo: ui(base.promo) };
    const theirs = { faq: [faq('tax')], promo: [{ ...promo('Jobs'), image: '/jobs.png' }] };
    expect(reconcile(base, mine, theirs)).to.eql({
      same: ['promo'], mine: ['faq'], theirs: [], both: [],
    });
  });

  it('calls it a conflict when both sides changed one sheet differently', () => {
    const base = { faq: [faq('tax')], promo: [] };
    const mine = { faq: ui([faq('audit')]), promo: [] };
    const theirs = { faq: [faq('consulting')], promo: [] };
    expect(reconcile(base, mine, theirs).both).to.eql(['faq']);
  });

  it('is no conflict when both sides made the same change', () => {
    const base = { faq: [faq('tax')], promo: [] };
    const theirs = { faq: [faq('tax'), faq('audit')], promo: [] };
    const plan = reconcile(base, { faq: ui(theirs.faq), promo: [] }, theirs);
    expect(plan.both).to.eql([]);
    expect(plan.same).to.eql(['faq', 'promo']);
  });

  it('names the sheets that changed between two reads, for the open-tab watch', () => {
    const before = { faq: [faq('tax')], promo: [] };
    expect(changedSheets(before, before)).to.eql([]);
    expect(changedSheets(before, { faq: [faq('tax')], promo: [promo('Jobs')] })).to.eql(['promo']);
    expect(changedSheets(before, { faq: [{ term: 'tax ', title: 'TAX' }], promo: [] })).to.eql([]);
  });

  it('does not mistake header spelling, spacing or a blank row for a change', () => {
    const base = {
      faq: [{
        term: 'tax', title: 'Tax', 'URL Title': 'Go', url: '/tax',
      }],
      promo: [],
    };
    const theirs = {
      faq: [{
        term: 'tax ', title: 'Tax', 'url title': 'Go', url: '/tax',
      }],
      promo: [],
    };
    const mine = { faq: [...ui(base.faq), row()], promo: [] };
    expect(reconcile(base, mine, theirs)).to.eql({
      same: ['faq', 'promo'], mine: [], theirs: [], both: [],
    });
  });
});

describe('the preview frame', () => {
  /*
   * The two placements are the part a hand-drawn preview gets wrong, and getting
   * it wrong is invisible — a promo rendered in the results column still looks
   * like a promo. So the structural claim is pinned against the same skeleton
   * search-results-panel.css lays out.
   */
  const skeleton = () => {
    const root = document.createElement('div');
    root.className = 'stx-search-results-panel';
    root.innerHTML = `
      <div class="stx-results-panel">
        <div class="stx-results-panel__container">
          <p class="header">Showing 1-10 of 24 Results</p>
          <div class="stx-results-panel__results-list"></div>
        </div>
      </div>`;
    return root;
  };

  const aRow = {
    index: 0, term: ' tax ', label: 'tax', title: 'Tax', body: 'Help.', url: '/tax', urlTitle: 'More',
  };

  const rowN = (i) => ({ ...aRow, index: i, title: `Promo ${i}` });

  it('puts the featured answer under the count and above the results', () => {
    const root = skeleton();
    const [panel] = place(root, [aRow], 'featured');
    expect(panel.nextElementSibling.className).to.equal('stx-results-panel__results-list');
    expect(panel.previousElementSibling.className).to.equal('header');
  });

  /*
   * The rail is a CONTAINER on the wrapper, not loose panels: the grid places
   * the third column against the results row, so three siblings would each want
   * a row of their own and the second and third would land beside nothing.
   */
  it('puts the promo panels in a rail on the outer wrapper', () => {
    const root = skeleton();
    const panels = place(root, [rowN(0), rowN(1), rowN(2)], 'promo');
    expect(panels).to.have.lengthOf(3);

    const rail = root.querySelector('.search-results-panel-promo-rail');
    expect(rail.parentElement).to.equal(root);
    panels.forEach((panel) => {
      expect(panel.parentElement).to.equal(rail);
      expect(panel.tagName).to.equal('ASIDE');
    });
  });

  it('renders as many promos as it is given, in order', () => {
    const root = skeleton();
    place(root, [rowN(0), rowN(1)], 'promo');
    const titles = [...root.querySelectorAll('.search-results-panel-curated__title')]
      .map((t) => t.textContent);
    expect(titles).to.eql(['Promo 0', 'Promo 1']);
  });

  it('removes the rail entirely when there is nothing to show', () => {
    const root = skeleton();
    place(root, [rowN(0)], 'promo');
    expect(place(root, [], 'promo')).to.eql([]);
    expect(root.querySelector('.search-results-panel-promo')).to.equal(null);
    expect(root.querySelector('.search-results-panel-promo-rail')).to.equal(null);
  });

  /* The frame is handed lists, but a lone row must not blow up. */
  it('accepts a single row as well as a list', () => {
    const root = skeleton();
    expect(place(root, aRow, 'promo')).to.have.lengthOf(1);
    expect(place(root, null, 'promo')).to.eql([]);
  });
});
