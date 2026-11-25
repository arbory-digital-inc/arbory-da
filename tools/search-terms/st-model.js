/* --------------------------------------------------------------------------
 * Search Terms Manager — what a set of rows will actually do
 *
 * THE BLOCK IS THE AUTHORITY, not this file. `readRow` and `matchCurated` are
 * imported from the block that renders the panels, so whether a row is skipped,
 * how its term is normalised, and which row wins a query are answered by the
 * code the reader runs. This module only turns those answers into something an
 * author can see, and adds the one question the block never asks: whether a row
 * can EVER win.
 *
 * The alternative — reimplementing the rules here — is exactly the drift the
 * block's own header warns about: "whole word, anywhere in the query, first row
 * wins" is one character away from a different rule, and a second copy diverges
 * the first time either is tuned.
 * ------------------------------------------------------------------------ */

import {
  readRow,
  matchCurated,
  selectPromos,
  splitTerms,
} from '../../blocks/search-results-panel/curated-results.js';
import { sheetDef } from './st-config.js';

/** Severity of a diagnostic, worst first. */
export const LEVELS = ['error', 'warning', 'note'];

/**
 * Parses the rows exactly as the block will, keeping the blanks in place.
 *
 * A row the block skips comes back as `null` AT ITS OWN INDEX rather than being
 * filtered out, because the author needs to see which row it was. The dense
 * list — what the block itself would hold — is derived from this.
 *
 * `readRow` writes its complaints to the console. Those warnings are left alone
 * rather than suppressed: they are what a developer sees on the live page, and
 * this tool reproducing them in the UI does not make them redundant there.
 *
 * @param {Object[]} rows The UI's working rows for one sheet
 * @returns {Array<?Object>} Parsed rows, `null` where the block would skip one
 */
export function parseAll(rows, sheetKey) {
  // `requireTerm` is the block's own switch: the featured sheet skips a row with
  // no term (it could never be matched), the promo sheet has no term column at
  // all. Passing it through means the tool skips exactly what the reader's copy
  // skips, rather than a second opinion about it.
  const requireTerm = sheetDef(sheetKey).hasTerm;
  return rows.map((row, i) => readRow(
    {
      term: row.term, title: row.title, answer: row.body, 'url title': row.urlTitle, url: row.url,
    },
    i,
    { requireTerm },
  ));
}

/** Only the rows the block would keep, in its own order. */
export const liveRows = (parsed) => parsed.filter(Boolean);

/**
 * The first earlier row that wins a query this term could win, or -1.
 *
 * FIRST MATCH WINS, and `readRow` has already normalised each term into a
 * SPACE-PADDED phrase (` business tax `). So a query can only reach a term if it
 * contains that phrase — and if an earlier row's phrase sits inside it as a
 * whole word, every such query contains the earlier phrase too. The earlier row
 * therefore always wins that query.
 *
 * `' tax '` inside `' business tax '` is exactly this test, and identical terms
 * are the degenerate case of it — a duplicate `term` is shadowed by its twin.
 *
 * @param {Array<?Object>} parsed Output of `parseAll`
 * @param {number} index Row the term belongs to
 * @param {string} term One padded term of that row
 * @returns {number} Index of the earliest row that takes it, or -1
 */
function takenBy(parsed, index, term) {
  for (let i = 0; i < index; i += 1) {
    if (parsed[i]?.terms.some((earlier) => term.includes(earlier))) return i;
  }
  return -1;
}

/**
 * Which of a row's terms an earlier row always takes first.
 *
 * A row with synonyms (`taxes, tax`) can lose some of them and still be
 * reachable through the rest; it is dead copy only when it loses ALL of them.
 * This is why the check belongs in a tool and not in the block: it is a property
 * of the whole sheet, invisible in any one row, and completely silent at render
 * time. Nothing is broken, so nothing warns.
 *
 * @param {Array<?Object>} parsed Output of `parseAll`
 * @param {number} index Row to test
 * @returns {{label: string, by: number}[]} Each lost term, with the row that takes it
 */
export function lostTerms(parsed, index) {
  const row = parsed[index];
  if (!row) return [];
  return row.terms
    .map((term, t) => ({ label: row.termLabels[t], by: takenBy(parsed, index, term) }))
    .filter(({ by }) => by >= 0);
}

/**
 * The single earlier row that wins every query this one could win, or -1.
 *
 * Kept for the common case — one row outranks this one outright. A row whose
 * synonyms are taken by several DIFFERENT earlier rows is dead too, but has no
 * single answer here; `diagnose` reports that case from `lostTerms`.
 *
 * @param {Array<?Object>} parsed Output of `parseAll`
 * @param {number} index Row to test
 * @returns {number} Index of the shadowing row, or -1
 */
export function shadowedBy(parsed, index) {
  const row = parsed[index];
  if (!row?.terms.length) return -1;
  for (let i = 0; i < index; i += 1) {
    const earlier = parsed[i];
    if (earlier && row.terms.every((term) => earlier.terms.some((e) => term.includes(e)))) return i;
  }
  return -1;
}

/**
 * Everything worth telling the author about one row.
 *
 * Ordered worst-first, and every message says what the CONSEQUENCE is rather
 * than naming the rule — "this row never appears" is actionable where "term is
 * required" is a restatement of the form.
 *
 * @param {Object} row The UI's working row
 * @param {number} index Its position
 * @param {Array<?Object>} parsed Output of `parseAll` for the whole sheet
 * @param {string} sheetKey `faq` or `promo`
 * @returns {Object[]} `{ level, message }`, worst first
 */
export function diagnose(row, index, parsed, sheetKey) {
  const issues = [];
  const def = sheetDef(sheetKey);
  const empty = !row.term && !row.title && !row.body && !row.url && !row.urlTitle;

  if (empty) {
    issues.push({ level: 'note', message: 'Empty row — it is skipped, and saving will drop it.' });
    return issues;
  }

  if (!row.title.trim()) {
    issues.push({
      level: 'error',
      message: 'No title, so the block skips this row entirely — it never appears.',
    });
  }

  // `, ,` is not empty text, but it holds no term — the block skips it too.
  if (def.hasTerm && !splitTerms(row.term).terms.length) {
    issues.push({
      level: 'error',
      message: 'No term, so the block skips this row entirely — it never appears for any query.',
    });
  }

  if (Boolean(row.url.trim()) !== Boolean(row.urlTitle.trim())) {
    issues.push({
      level: 'warning',
      message: row.url.trim()
        ? 'A link with no label: the call to action is left off. Add a URL title.'
        : 'A label with no destination: the call to action is left off. Add a URL.',
    });
  }

  /*
   * Shadowing is a FIRST-MATCH-WINS property, so it can only happen on the
   * featured sheet. On the promo rail every row is reachable — the first three
   * show regardless of any query — and warning there would tell an author their
   * copy is dead when it is simply fourth.
   */
  const shadow = def.hasTerm ? shadowedBy(parsed, index) : -1;
  const lost = def.hasTerm ? lostTerms(parsed, index) : [];
  const termCount = parsed[index]?.terms.length || 0;
  if (shadow >= 0) {
    issues.push({
      level: 'warning',
      message: `Never reached: row ${shadow + 1} ("${parsed[shadow].label}") matches every query this row could match, and the first match wins. Move this row above it, or narrow row ${shadow + 1}.`,
    });
  } else if (termCount && lost.length === termCount) {
    // Every synonym is taken, but by different rows — dead all the same.
    const by = [...new Set(lost.map((l) => l.by + 1))].sort((a, b) => a - b);
    issues.push({
      level: 'warning',
      message: `Never reached: rows ${by.join(' and ')} between them match every query this row could match, and the first match wins. Move this row above them.`,
    });
  } else if (lost.length) {
    // Some synonyms are taken; the rest still reach this row.
    const what = lost.map((l) => `"${l.label}" (row ${l.by + 1})`).join(', ');
    issues.push({
      level: 'warning',
      message: `${lost.length === 1 ? 'This term goes' : 'These terms go'} to an earlier row first, so ${lost.length === 1 ? 'it never shows' : 'they never show'} this one: ${what}. The other terms still work.`,
    });
  }

  /*
   * Copy budget, promo only. The rail is a `minmax(168px, 20%)` grid track, so
   * at the width where it appears it is about 170px — a heading of three or four
   * words. A long heading is not broken, it is cramped, so this is a note.
   */
  if (def.titleBudget && row.title.length > def.titleBudget) {
    issues.push({ level: 'note', message: `${row.title.length} characters in a ~170px rail — this heading will look cramped. Three or four words reads best.` });
  }
  if (def.bodyBudget && row.body.length > def.bodyBudget) {
    issues.push({ level: 'note', message: `${row.body.length} characters of body copy is long for the rail. One sentence is the budget.` });
  }

  return issues.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
}

/**
 * Which row a query gets on the FEATURED sheet, using the block's own matcher.
 *
 * @param {Array<?Object>} parsed Output of `parseAll`
 * @param {string} query What the reader typed
 * @returns {?Object} The winning parsed row
 */
export const winnerFor = (parsed, query) => matchCurated(liveRows(parsed), query);

/**
 * What a sheet actually PUTS ON THE PAGE for a query — always a list.
 *
 * The two sheets answer differently and the difference is the point: the
 * featured sheet yields at most one row and only when the query matches a term,
 * while the rail yields its first three whatever was typed. Both come back as an
 * array so the UI has one shape to render, and so "nothing" and "three" are the
 * same case rather than two.
 *
 * Both answers come from the BLOCK — `matchCurated` and `selectPromos` — so this
 * stays a presentation of the reader's own rules rather than a second copy of
 * them.
 *
 * @param {Array<?Object>} parsed Output of `parseAll`
 * @param {string} query What the reader typed
 * @param {string} sheetKey `faq` or `promo`
 * @returns {Object[]} The rows that would appear, in order
 */
export function outcomeFor(parsed, query, sheetKey) {
  const live = liveRows(parsed);
  if (!sheetDef(sheetKey).hasTerm) return selectPromos(live);
  const winner = matchCurated(live, query);
  return winner ? [winner] : [];
}

/** The worst level across a set of diagnostics, or null. */
export function worst(issues) {
  return LEVELS.find((l) => issues.some((i) => i.level === l)) || null;
}
