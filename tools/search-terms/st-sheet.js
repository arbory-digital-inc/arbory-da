/* --------------------------------------------------------------------------
 * Search Terms Manager — the workbook's SHAPE
 *
 * Split from st-store.js so it can be tested: st-store.js reaches DA, which
 * means it imports the session and its top-level `await DA_SDK`, and a module
 * that can only load inside DA is a module nobody pins. Everything here is a
 * pure function over JSON, and every row an author types passes through it —
 * a silent regression corrupts the sheet rather than throwing.
 * ------------------------------------------------------------------------ */

import { SHEETS, sheetDef, columnsFor } from './st-config.js';

/**
 * What a sheet is CALLED in this workbook, or what it should be called.
 *
 * The featured sheet has been `data`, `faq` and now `featured-results`. Reading
 * the wrong name is not a read error — it is an empty sheet, which the tool
 * would then happily save over the top of the real one. So the name is resolved
 * from the workbook rather than assumed, newest candidate first, and a workbook
 * that has none of them gets the current name for a fresh sheet.
 *
 * @param {Object} raw Parsed workbook JSON
 * @param {Object} def A SHEETS entry
 * @returns {string} The sheet's name in this workbook
 */
export function sheetNameIn(raw, def) {
  const names = def.sheetNames || [def.key];
  return names.find((name) => Array.isArray(raw?.[name]?.data)) || names[0];
}
/**
 * Splits a workbook into per-sheet rows, whichever envelope it arrived in.
 *
 * DA serves two shapes, and this workbook has already been both:
 *
 *   single: { ":type": "sheet",       data: [ ...rows ] }
 *   multi:  { ":type": "multi-sheet", ":names": ["featured-results","promo"], … }
 *
 * The legacy single-sheet shape is the FEATURED content and nothing else. That
 * is the same call `resolveSheet` makes in the block (SOLE_SHEET_FALLBACK is
 * true for `featured`, false for `promo`) and for the same reason: handing a
 * lone sheet to the promo rail renders the FAQ answers down the rail as if they
 * were promos.
 *
 * @param {Object} raw Parsed workbook JSON
 * @returns {Object} Rows per sheet key
 */
export function splitSheets(raw) {
  if (Array.isArray(raw?.data)) return { faq: raw.data, promo: [] };
  return Object.fromEntries(SHEETS.map((def) => {
    const rows = raw?.[sheetNameIn(raw, def)]?.data;
    return [def.key, Array.isArray(rows) ? rows : []];
  }));
}

/**
 * Which header each sheet is actually using for its body column.
 *
 * The block reads `answer`, `description`, `summary` or `body` in either sheet,
 * so a sheet already using one of them keeps working — and a save preserves it
 * rather than renaming a column under the author.
 *
 * @param {Object} sheets Rows per sheet key
 * @returns {Object} Body header per sheet key
 */
export function bodyKeysFor(sheets) {
  return Object.fromEntries(SHEETS.map(({ key, bodyKey }) => {
    const first = (sheets[key] || [])[0] || {};
    const found = ['answer', 'description', 'summary', 'body'].find((k) => Object.keys(first)
      .some((h) => h.toLowerCase().replace(/[^a-z0-9]/g, '') === k));
    return [key, found || bodyKey];
  }));
}

/** One sheet's envelope: DA wants the counts, and keeps any authored widths. */
function sheetEnvelope(rows, previous) {
  const len = rows.length;
  const out = {
    total: len, limit: len, offset: 0, data: rows,
  };
  if (Array.isArray(previous?.[':colWidths'])) out[':colWidths'] = previous[':colWidths'];
  return out;
}

/**
 * Builds the workbook JSON to write.
 *
 * ALWAYS multi-sheet, even when only `faq` has rows. A workbook that stays in
 * the legacy single-sheet shape has nowhere to put a promo, and the transition
 * would then happen on some later save with no reason recorded — the shape is
 * part of what this tool owns, so it settles it once and states so.
 *
 * Sheets present in the source that this tool does not model are carried
 * through untouched: it is not the only thing that may ever write here.
 *
 * @param {Object} previous The envelope read from DA, or null for a new workbook
 * @param {Object} sheets Rows per sheet key
 * @returns {string} JSON to POST
 */
export function buildWorkbook(previous, sheets) {
  /*
   * The name each sheet has in THIS workbook, which is not its key: a rename in
   * DA must be written back to the renamed sheet, not alongside it under an old
   * name. `sheetNameIn` answers that, and falls back to the current name for a
   * workbook that has no such sheet yet.
   */
  const nameOf = Object.fromEntries(SHEETS.map((def) => [def.key, sheetNameIn(previous, def)]));
  const keyOfName = Object.fromEntries(Object.entries(nameOf).map(([k, n]) => [n, k]));
  const known = Object.values(nameOf);
  const carried = Array.isArray(previous?.[':names'])
    ? previous[':names'].filter((n) => !known.includes(n))
    : [];

  /*
   * `promo` is listed only when it has rows. An EMPTY promo sheet is not the
   * same as no promo sheet to the block — `resolveSheet` finds it, reads zero
   * rows and renders nothing, which is the same outcome by luck rather than by
   * design. Leaving it out keeps "no rail" expressed the way the documentation
   * describes it: no promo sheet means no rail.
   */
  const names = [
    ...known.filter((n) => keyOfName[n] === 'faq' || (sheets[keyOfName[n]] || []).length > 0),
    ...carried,
  ];

  const body = { ':names': names, ':version': 3, ':type': 'multi-sheet' };
  names.forEach((name) => {
    body[name] = known.includes(name)
      ? sheetEnvelope(sheets[keyOfName[name]] || [], previous?.[name])
      : previous[name];
  });
  return JSON.stringify(body);
}

/**
 * A sheet row as DA should store it: the tool's columns, in reading order.
 *
 * Empty cells are KEPT rather than dropped, so every row in the sheet has the
 * same columns and the sheet editor shows a table instead of a ragged one.
 *
 * @param {Object} row The UI's working row
 * @param {string} key Sheet key
 * @param {string} bodyKey The body header this sheet already uses
 * @returns {Object} The row to write
 */
export function toSheetRow(row, key, bodyKey) {
  const columns = columnsFor(key).map((c) => (c === sheetDef(key).bodyKey ? bodyKey : c));
  const values = {
    term: row.term, title: row.title, [bodyKey]: row.body, 'url title': row.urlTitle, url: row.url,
  };
  return Object.fromEntries(columns.map((c) => [c, String(values[c] ?? '').trim()]));
}

/**
 * A DA sheet row as the UI edits it.
 *
 * Header spelling is collapsed the same way the block collapses it (`keyOf`), so
 * `URL Title` and `urlTitle` reach the same field here too — otherwise the tool
 * would silently blank a column the block reads perfectly well.
 *
 * @param {Object} raw One entry from a sheet's `data` array
 * @returns {Object} The UI's working row
 */
export function fromSheetRow(raw) {
  const cells = {};
  Object.entries(raw || {}).forEach(([k, v]) => {
    cells[String(k).toLowerCase().replace(/[^a-z0-9]/g, '')] = typeof v === 'string' ? v : String(v ?? '');
  });
  return {
    term: cells.term || '',
    title: cells.title || '',
    body: cells.answer || cells.description || cells.summary || cells.body || '',
    urlTitle: cells.urltitle || '',
    url: cells.url || '',
  };
}

/**
 * A sheet's rows reduced to what this tool writes, so two versions can be
 * compared without being fooled by what is not content: `URL Title` in one and
 * `url title` in the other, a trailing space the sheet editor kept, a blank row
 * an author added and left. Raw sheet rows and the UI's working rows both pass
 * through `fromSheetRow` (it is idempotent on the latter), so either works.
 */
const fingerprint = (rows, key) => JSON.stringify((rows || [])
  .map((r) => toSheetRow(fromSheetRow(r), key, 'body'))
  .filter((r) => Object.values(r).some(Boolean)));

/**
 * The sheets whose content differs between two reads of the workbook — what
 * the tool's watch asks of DA while a tab sits open (see `check` in
 * search-terms.js). Compared by `fingerprint`, so a header spelled
 * differently or a trailing space is not a change anybody needs telling about.
 *
 * @param {Object} before Rows per sheet key, from the earlier read
 * @param {Object} after Rows per sheet key, from the later read
 * @returns {string[]} Keys of the sheets that changed
 */
export function changedSheets(before, after) {
  return SHEETS.map(({ key }) => key)
    .filter((key) => fingerprint(before?.[key], key) !== fingerprint(after?.[key], key));
}

/**
 * Decides, per sheet, whose rows a save writes.
 *
 * The tool reads the workbook when it opens, and used to write the WHOLE of it
 * back on save — so a tab left open replaced every save made after it opened,
 * in both sheets, including a sheet it never touched. That is how re-entering
 * the featured answers in one browser wiped a promo rail saved from another
 * (on the earlier site, where this tool was built). Three versions settle it:
 *
 *   - `base`   what this tab read when it opened, or last saved
 *   - `mine`   what this tab holds now
 *   - `theirs` what DA holds now, read just before the write
 *
 * A sheet DA already holds as this tab would write it — nobody changed it, or
 * both sides made the same change — is `same`. A sheet only this tab changed
 * is written from this tab. A sheet only somebody else changed is written back
 * as THEY left it. A sheet both sides changed, differently, is a real conflict
 * — and whether to replace theirs is the author's call, so it is returned
 * rather than decided here.
 *
 * `same` and `theirs` are both written from DA's own rows, not this tab's, so a
 * save leaves a sheet it did not change exactly as it was: the comparison only
 * sees the columns this tool models, and re-serializing an untouched sheet
 * would drop any other column and respell its headers.
 *
 * @param {Object} base Rows per sheet key, as read when the tab opened
 * @param {Object} mine Rows per sheet key, as the tab holds them
 * @param {Object} theirs Rows per sheet key, as DA holds them now
 * @returns {Object} `{ same, mine, theirs, both }` — the sheet keys in each case
 */
export function reconcile(base, mine, theirs) {
  const plan = {
    same: [], mine: [], theirs: [], both: [],
  };
  SHEETS.forEach(({ key }) => {
    const [b, m, t] = [base, mine, theirs].map((sheets) => fingerprint(sheets?.[key], key));
    if (t === m) plan.same.push(key);
    else if (m === b) plan.theirs.push(key);
    else if (t === b) plan.mine.push(key);
    else plan.both.push(key);
  });
  return plan;
}
