/* --------------------------------------------------------------------------
 * Search Terms Manager — data layer
 *
 * Reads and writes ONE DA workbook per site, and preview/publishes it.
 *
 * Everything here is envelope-aware in both directions, because this particular
 * workbook has already changed shape once in its life: it started as a single
 * unnamed sheet and became a two-sheet workbook the moment somebody added the
 * promo rail. DA serves those as genuinely different JSON, and a reader that
 * only understands one of them starts rejecting every row (which is how the
 * block's own reader was first written — see resolveSheet in curated-results.js).
 * ------------------------------------------------------------------------ */

import {
  ADMIN_SOURCE, ADMIN_VERSIONS, ADMIN_AEM, CONTENT_REF, SHEET_PATH,
} from './st-config.js';
import { ORG, token } from './st-session.js';
import { splitSheets, bodyKeysFor, buildWorkbook } from './st-sheet.js';

const authHeaders = () => ({ Authorization: `Bearer ${token}` });

export const isAuthError = (status) => status === 401 || status === 403;

/**
 * Turns a failed response into a message an author can act on.
 *
 * The two auth failures look alike and are fixed differently, so the message
 * names which one it is:
 *
 *   - 401: the token is missing or EXPIRED. DA hands this app its token ONCE,
 *     when the app loads — nx shell.js posts it a single time, and nothing
 *     feeds the SDK's refresh hook — so a tab left open long enough outlives
 *     it. Reloading the tool from DA is the only way to a new one.
 *   - 403: the token is valid, for an account that cannot write here. The
 *     usual cause is being signed in to a personal Adobe profile rather than
 *     the organization's, which a reload does not change.
 *
 * Both carry `auth`, so a refused save can keep the author's rows before they
 * reload (keepUnsaved in search-terms.js).
 */
function fail(verb, repo, status) {
  if (status === 401) {
    return Object.assign(new Error(`Not authorized to ${verb} ${repo} (401). Your DA session has expired — reload this tool from DA.`), { auth: true });
  }
  if (status === 403) {
    return Object.assign(new Error(`Not authorized to ${verb} ${repo} (403). You are signed in to DA, but not with access to ${repo} — check the organization under your name, top right in DA.`), { auth: true });
  }
  return new Error(`Could not ${verb} ${repo} (${status}).`);
}

/* ---- low-level DA source I/O ---- */

async function getSource(repo) {
  /*
   * `no-store`, because a save compares this read with what the tab opened on
   * (reconcile in st-sheet.js), and a copy answered from the browser cache
   * would hide someone else's save from exactly that check.
   */
  const resp = await fetch(`${ADMIN_SOURCE}/${ORG}/${repo}/${SHEET_PATH}`, { headers: authHeaders(), cache: 'no-store' });
  if (isAuthError(resp.status)) throw fail('read', repo, resp.status);
  return resp;
}

async function putSource(repo, json) {
  const body = new FormData();
  body.append('data', new Blob([json], { type: 'application/json' }), 'search-terms.json');
  const resp = await fetch(`${ADMIN_SOURCE}/${ORG}/${repo}/${SHEET_PATH}`, { method: 'POST', headers: authHeaders(), body });
  if (!resp.ok) throw fail('write', repo, resp.status);
  return true;
}

/**
 * Who saved the workbook last, and when, from DA's own audit trail.
 *
 * Only asked once a change has been SEEN, to put a name on the notice — it is
 * not how a change is detected (the source is), so any failure here returns
 * null rather than throwing, and the notice says "someone" instead. DA folds a
 * run of saves by one person into a single entry stamped with the last of
 * them, which is what a notice wants anyway.
 *
 * @param {string} repo Site repo
 * @returns {Promise<Object|null>} `{ email, at }`, or null
 */
export async function lastSaved(repo) {
  try {
    const resp = await fetch(`${ADMIN_VERSIONS}/${ORG}/${repo}/${SHEET_PATH}`, { headers: authHeaders(), cache: 'no-store' });
    if (!resp.ok) return null;
    const list = await resp.json();
    const last = (Array.isArray(list) ? list : [])
      .reduce((a, b) => ((b?.timestamp || 0) > (a?.timestamp || 0) ? b : a), null);
    return last ? { email: last.users?.[0]?.email || '', at: last.timestamp } : null;
  } catch {
    return null;
  }
}

/* ---- preview / publish ---- */

/**
 * Runs one AEM admin action against the workbook.
 *
 * A sheet is a resource like any other here: `preview` makes the edit readable
 * on the aem.page host, `live` on aem.live and the CDN. Neither happens as a
 * side effect of writing the source, which is the whole trap this tool exists to
 * close — see the note in st-config.js.
 *
 * A 403 here is NOT the wrong-profile 403 that `fail` describes. The DA source
 * accepted this token a moment earlier; what refused it is the site's own
 * permissions for preview or publish, which a reload and a profile switch
 * both leave unchanged — so it says who can fix it instead, and carries no
 * `auth`, because keeping rows for a reload would not help.
 */
export async function aemAction(action, repo) {
  const resp = await fetch(`${ADMIN_AEM}/${action}/${ORG}/${repo}/${CONTENT_REF}/${SHEET_PATH}`, { method: 'POST', headers: authHeaders() });
  if (resp.status === 403) {
    throw new Error(`Your account cannot ${action === 'live' ? 'publish' : 'preview'} on ${repo} (403). DA accepts your sign-in, but the site's permissions do not allow this — ask a site admin.`);
  }
  if (!resp.ok) throw fail(`${action} on`, repo, resp.status);
  return true;
}

/* ---- envelope ---- */

/**
 * Reads a workbook into the shape the UI edits.
 *
 * Returns per-sheet rows AND the envelope it arrived in, so a save can put back
 * everything this tool does not model: sheets it has never heard of, column
 * widths an author has dragged, and the header spelling already in use for the
 * body column (`answer` vs `description` vs `summary` vs `body` — all four are
 * read by the block, and renaming one under an author would be a change nobody
 * asked for).
 *
 * @param {string} repo Site repo, e.g. `arbory-da`
 * @returns {Promise<Object>} `{ exists, sheets, bodyKeys, raw }`
 */
export async function loadWorkbook(repo) {
  const resp = await getSource(repo);
  if (resp.status === 404) {
    return {
      exists: false, sheets: { faq: [], promo: [] }, bodyKeys: {}, raw: null,
    };
  }
  if (!resp.ok) throw fail('read', repo, resp.status);

  let raw;
  try {
    raw = await resp.json();
  } catch {
    throw new Error(`${repo}/${SHEET_PATH} is not valid JSON. Open it in DA and check it before editing here.`);
  }

  const sheets = splitSheets(raw);
  const bodyKeys = bodyKeysFor(sheets);

  return {
    exists: true, sheets, bodyKeys, raw,
  };
}

/**
 * Writes the workbook and previews it, in that order.
 *
 * The preview is not optional and is not a separate button, because a saved but
 * unpreviewed sheet is indistinguishable from a broken feature on the results
 * page. Publishing IS separate — see the tool's Publish action.
 *
 * Anything that fails AFTER the write is thrown with `saved: true`. The rows
 * are in DA by then, and a caller that took them for unsaved would keep them
 * for a reload, and go on measuring against the read before its own write —
 * so its next check would report this tab's save as somebody else's.
 *
 * @param {string} repo Site repo
 * @param {Object} previous The envelope DA holds NOW — from a `loadWorkbook`
 *   made just before the save, not the one the tool opened on
 * @param {Object} sheets Rows per sheet key
 * @returns {Promise<Object>} The re-read workbook, so the UI holds what DA holds
 */
export async function saveWorkbook(repo, previous, sheets) {
  await putSource(repo, buildWorkbook(previous, sheets));
  try {
    await aemAction('preview', repo);
    return await loadWorkbook(repo);
  } catch (err) {
    throw Object.assign(err, { saved: true });
  }
}
