/* --------------------------------------------------------------------------
 * Search Terms Manager — UI
 *
 * Edits the curated-panels workbook for one site at a time, and answers the
 * three questions the DA sheet editor cannot: is this row live, can it ever be
 * reached, and what does it look like to a reader.
 *
 * LIGHT DOM, like the Bio Manager: this is a full-page DA app, not a widget
 * embedded in someone else's document, so there is nothing to protect the host
 * page from — and the preview, the one thing that genuinely needs isolating from
 * the tool's own styles, is an iframe for stronger reasons (see st-preview.html).
 * ------------------------------------------------------------------------ */

import {
  SITES, SHEETS, AUTHORED_PATH, sheetDef, siteDef,
} from './st-config.js';
import { ORG, email } from './st-session.js';
import {
  loadWorkbook, saveWorkbook, aemAction, lastSaved,
} from './st-store.js';
import {
  fromSheetRow, toSheetRow, reconcile, changedSheets,
} from './st-sheet.js';
import {
  parseAll, diagnose, outcomeFor, worst, LEVELS,
} from './st-model.js';

const BLANK = {
  term: '', title: '', body: '', urlTitle: '', url: '',
};

/*
 * The fields under the term, as label/control pairs.
 *
 * `term` is NOT here — it is the row's headline, rendered in the row bar. It is
 * the field every other one is keyed to (it decides whether the row matches at
 * all), so giving it the same weight as `url title` in a stack of five made the
 * rows read as a form dump with no subject.
 *
 * `link` is a PAIR on one line because the two halves are all-or-nothing: the
 * block drops the call to action unless both are filled, so showing them apart
 * misrepresents how they behave.
 */
const FIELDS = [
  { label: 'Title', parts: [{ key: 'title', hint: 'The panel heading' }] },
  { body: true, parts: [{ key: 'body', hint: 'One short paragraph. Optional', area: true }] },
  {
    label: 'Link',
    parts: [
      { key: 'urlTitle', hint: 'Link text' },
      { key: 'url', hint: 'Where it goes, e.g. /en/blog/…' },
    ],
  },
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[c]));

/** The first synonym of a term cell: `taxes, tax` → `taxes`. */
const firstTerm = (cell) => String(cell ?? '').split(',').map((t) => t.trim()).find(Boolean) || '';

/*
 * Unsaved rows, kept in this browser when a save is refused for auth.
 *
 * DA hands this app its token once, at load, so a tab left open long enough
 * outlives it — and the only way to a new token is a reload, which is exactly
 * what discards the rows the author was trying to save. That is how a session
 * of edits was lost on the earlier site. Keeping them here makes the reload safe.
 *
 * Per site, offered back once, best-effort: storage can be blocked, and DA does
 * not always serve the app from the same origin (preview.da.live, else
 * aem.live). Offered, not put back silently — rows kept on the way out of a
 * tab may be days old by the time the tool is next opened.
 */
const UNSAVED = (repo) => `search-terms:unsaved:${ORG}/${repo}`;

/*
 * How often an open tab asks DA whether someone else has saved.
 *
 * The timer is the backstop, not the main check. The case that hurt was a tab
 * coming BACK — opened one evening, edited the next morning, saved over a day
 * of other people's work (seen on the earlier site) — and that is caught the moment
 * the tab is shown or focused. The timer only covers two people editing at once
 * with both windows up, which the save-time check already stops; it just says
 * so sooner. Hidden tabs are never polled, and focus events are spaced out so
 * clicking in and out of a dialog does not fire a read each time.
 */
const RECHECK_MS = 2 * 60 * 1000;
const MIN_GAP_MS = 15 * 1000;

/** `jane.doe@example.com` → `Jane Doe`; DA's audit trail keeps only the address. */
const nameOf = (address) => String(address || '').split('@')[0].split(/[._-]+/).filter(Boolean)
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join(' ');

/** "Megan Merchant saved", "You saved … in another tab", or "Someone saved". */
function savedBy(who) {
  const when = who?.at && new Date(who.at)
    .toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const at = when ? ` at ${when}` : '';
  if (who?.email && email && who.email.toLowerCase() === String(email).toLowerCase()) {
    return `You saved this workbook in another tab or browser${at}`;
  }
  return `${nameOf(who?.email) || 'Someone'} saved this workbook${at}`;
}

function keepUnsaved(repo, data) {
  try {
    const kept = { at: Date.now(), base: data.sheets, rows: data.rows };
    localStorage.setItem(UNSAVED(repo), JSON.stringify(kept));
    return true;
  } catch {
    return false;
  }
}

function readUnsaved(repo) {
  try {
    const kept = JSON.parse(localStorage.getItem(UNSAVED(repo)) || 'null');
    return kept?.rows && kept?.base ? kept : null;
  } catch {
    return null;
  }
}

function dropUnsaved(repo) {
  try {
    localStorage.removeItem(UNSAVED(repo));
  } catch {
    // Blocked storage held nothing to drop.
  }
}

class SearchTermsManager extends HTMLElement {
  constructor() {
    super();
    this.repo = SITES[0].repo;
    this.sheetKey = SHEETS[0].key;
    this.query = '';
    this.selected = 0;
    this.dirty = false;
    this.data = null;
    this.previewReady = false;
    this.saving = false;
    this.checking = false;
    this.checkedAt = 0;
    this.noticed = null;
    this.authFailed = false;
  }

  async connectedCallback() {
    this.renderShell();
    window.addEventListener('message', ({ data }) => {
      if (data?.type === 'st-preview-ready') { this.previewReady = true; this.pushPreview(); }
      if (data?.type === 'st-preview-height') this.sizePreview(data.height);
    });
    /*
     * The frame is a FIXED 1240px wide, so resizing this window changes what the
     * pane can give it but produces no resize inside the frame — nothing would
     * re-run the scale. Hence a listener on this side, replaying the last height
     * the frame reported.
     */
    window.addEventListener('resize', () => {
      if (this.frameHeight) this.sizePreview(this.frameHeight);
    });
    /*
     * The browser's own guard, not a custom modal: unsaved rows live only in this
     * tab, and a DA app is closed by navigating away from it.
     *
     * Once the token has been refused, the reload is the fix rather than the
     * risk, so the rows are kept as the tab goes — including any typed after
     * the refusal was first caught — and the browser is not asked to warn.
     */
    window.addEventListener('beforeunload', (e) => {
      if (!this.dirty) return;
      if (this.authFailed && keepUnsaved(this.repo, this.data)) return;
      e.preventDefault();
      e.returnValue = '';
    });
    await this.load();
    this.watch();
  }

  /* ---- state ---- */

  get rows() { return this.data?.rows?.[this.sheetKey] || []; }

  async load() {
    this.busy('Reading the workbook…');
    try {
      const book = await loadWorkbook(this.repo);
      this.adopt(book);
      this.selected = 0;
      this.noticed = null;
      this.authFailed = false;
      this.banner(null);
      this.renderAll();
      await this.restoreUnsaved();
    } catch (err) {
      this.banner('error', err.message);
    }
  }

  /**
   * Offers back the rows kept when a save or check was refused (keepUnsaved).
   *
   * They return UNSAVED, and measured against the workbook as it was when they
   * were first read rather than as it is now — so the next save still notices
   * anything someone else saved in between, instead of writing over it.
   *
   * Asked rather than done, and dropped from storage only once answered: a
   * tab closed with the question open still has them next time.
   */
  async restoreUnsaved() {
    const { repo } = this;
    const kept = readUnsaved(repo);
    if (!kept) return;
    const when = new Date(kept.at).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const discard = await this.ask(
      `You have rows for ${repo} from ${when} that did not finish saving — kept in this browser when DA stopped accepting the tool's sign-in. Put them back to check and save them, or discard them and keep what is in DA now.`,
      'Discard them',
      'Put them back',
    );
    dropUnsaved(repo);
    if (discard || repo !== this.repo) return;
    this.data.rows = kept.rows;
    this.data.sheets = kept.base;
    this.dirty = true;
    this.renderAll();
    this.banner('ok', `Put back your rows from ${when}. Check them, then Save & preview.`);
  }

  /** Takes a workbook read from DA as the tab's working copy, with nothing unsaved. */
  adopt(book) {
    this.data = {
      ...book,
      rows: Object.fromEntries(SHEETS.map(({ key }) => [
        key, (book.sheets[key] || []).map(fromSheetRow),
      ])),
    };
    this.dirty = false;
  }

  mark() {
    this.dirty = true;
    this.renderStatus();
  }

  /* ---- someone else's saves ---- */

  /** Checks DA when the tab is shown or focused, and every RECHECK_MS while it is visible. */
  watch() {
    const check = () => {
      if (document.visibilityState === 'visible') this.check();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    setInterval(check, RECHECK_MS);
  }

  /**
   * Asks DA whether the workbook has changed since this tab read it.
   *
   * A tab with nothing unsaved simply takes the new rows — there is nothing of
   * the author's to lose, and every minute it shows the old ones is a minute
   * someone might start editing them. A tab WITH unsaved rows is never touched:
   * it is told who saved and when, and the save-time `reconcile` decides the
   * rest. Every await is followed by a re-check of the state it depends on,
   * because the author keeps typing while the read is in flight.
   *
   * An expired token shows here too — within RECHECK_MS of expiring rather than
   * at the next save, after however much more typing — and unsaved rows are
   * kept at once, so the reload it asks for is safe.
   */
  async check() {
    if (this.checking || this.saving || !this.data) return;
    // An open dialog (a delete confirm) holds a row INDEX; new
    // rows under it would point that index at a different row. Wait for it.
    if (this.q('dialog[open]')) return;
    if (Date.now() - this.checkedAt < MIN_GAP_MS) return;
    this.checking = true;
    this.checkedAt = Date.now();
    const { repo } = this;
    const stale = () => repo !== this.repo || this.saving;
    try {
      const fresh = await loadWorkbook(repo);
      if (stale()) return;
      const changed = changedSheets(this.data.sheets, fresh.sheets);
      if (!changed.length) return;
      const seen = JSON.stringify(fresh.sheets);
      if (this.dirty && seen === this.noticed) return;

      const who = await lastSaved(repo);
      if (stale()) return;
      const names = changed.map((key) => sheetDef(key).label).join(' and ');
      if (!this.dirty) {
        this.adopt(fresh);
        this.selected = Math.min(this.selected, Math.max(0, this.rows.length - 1));
        this.renderAll();
        this.banner(null);
        await this.ask(`${savedBy(who)}, so the ${names} rows here have been updated to match.`, 'OK', null);
      } else {
        this.noticed = seen;
        // The banner stays after the dialog closes: a reminder, until Save, that
        // these rows are no longer the only version.
        this.banner('warning', `${savedBy(who)} after you opened it — the ${names} sheet changed. Save checks your rows against theirs before writing anything.`);
        const discard = await this.ask(
          `${savedBy(who)} after you opened it — the ${names} sheet changed. Your unsaved rows are still here, and Save checks them against theirs before writing anything. Or drop yours and load what is in DA now.`,
          'Discard mine, load theirs',
          'Keep my edits',
        );
        if (discard && !stale()) await this.load();
      }
    } catch (err) {
      // Anything but auth — a dropped connection, a laptop waking up — is not
      // worth a banner: the next check simply tries again.
      if (!err.auth || stale()) return;
      this.authFailed = true;
      const kept = this.dirty && keepUnsaved(repo, this.data);
      this.banner('error', kept
        ? `${err.message} Your unsaved rows are kept in this browser and will be offered back when the tool reloads.`
        : err.message);
    } finally {
      this.checking = false;
    }
  }

  /* ---- shell ---- */

  renderShell() {
    this.innerHTML = `
      <header class="st-head">
        <div class="st-head-main">
          <h1>Search Terms</h1>
          <p class="st-sub">The curated panels on the search results page — the featured answer and the promo rail — for
            <code>${esc(ORG)}/<span class="st-repo"></span>${esc(AUTHORED_PATH)}</code>.</p>
        </div>
        <div class="st-head-actions">
          <label class="st-field st-site"${SITES.length < 2 ? ' hidden' : ''}>Site
            <select class="st-site-select">
              ${SITES.map((s) => `<option value="${esc(s.repo)}">${esc(s.label)} — ${esc(s.repo)}</option>`).join('')}
            </select>
          </label>
          <button class="st-btn st-save" disabled>Save &amp; preview</button>
          <button class="st-btn st-secondary st-publish" disabled>Publish</button>
        </div>
      </header>

      <div class="st-banner" hidden></div>

      <dialog class="st-confirm">
        <p class="st-confirm-text"></p>
        <div class="st-confirm-actions">
          <button class="st-btn st-secondary st-confirm-no">Cancel</button>
          <button class="st-btn st-confirm-yes">Continue</button>
        </div>
      </dialog>

      <nav class="st-tabs" role="tablist">
        ${SHEETS.map((s) => `
          <button role="tab" class="st-tab" data-sheet="${esc(s.key)}">
            <span class="st-tab-top">
              <span class="st-tab-label">${esc(s.label)}</span>
              <span class="st-tab-count" data-count="${esc(s.key)}"></span>
            </span>
            <span class="st-tab-blurb">${esc(s.blurb)}</span>
          </button>`).join('')}
      </nav>

      <div class="st-body">
        <section class="st-rows-pane">
          <div class="st-rows-head">
            <p class="st-summary"></p>
            <button class="st-btn st-secondary st-add">+ Add row</button>
          </div>
          <div class="st-notice" hidden></div>
          <ol class="st-rows"></ol>
        </section>

        <aside class="st-preview-pane">
          <div class="st-tester">
            <label class="st-field">Try a query
              <input type="search" class="st-query" placeholder="what a reader would type" />
            </label>
            <div class="st-verdicts"></div>
          </div>
          <div class="st-frame-wrap">
            <iframe class="st-frame" src="/tools/search-terms/st-preview.html" title="Curated panel preview"></iframe>
          </div>
          <p class="st-frame-note">Rendered by the block itself, at a 1240px viewport, scaled to fit.</p>
        </aside>
      </div>`;

    this.q('.st-site-select').addEventListener('change', async (e) => {
      const next = e.target.value;
      if (this.dirty && !await this.ask('You have unsaved rows. Switching site discards them.', 'Discard and switch')) {
        e.target.value = this.repo;
        return;
      }
      e.target.value = next;
      this.repo = next;
      await this.load();
    });

    this.qa('.st-tab').forEach((tab) => tab.addEventListener('click', () => {
      this.sheetKey = tab.dataset.sheet;
      this.selected = 0;
      this.renderAll();
    }));

    this.q('.st-add').addEventListener('click', () => {
      this.rows.push({ ...BLANK });
      this.selected = this.rows.length - 1;
      this.mark();
      this.renderRows();
      this.qa('.st-row')[this.selected]?.querySelector('input')?.focus();
    });

    this.q('.st-query').addEventListener('input', (e) => {
      this.query = e.target.value;
      this.renderVerdicts();
    });

    this.q('.st-save').addEventListener('click', () => this.save());
    this.q('.st-publish').addEventListener('click', () => this.publish());
  }

  /**
   * Asks before something irreversible, with a real dialog rather than
   * `window.confirm` — which the lint rules rule out, and which a DA app cannot
   * style or label. The confirm callers are genuinely destructive: dropping
   * unsaved rows (in the tab, or kept from a refused save), deleting a row that
   * may be the only copy of its copy, and replacing rows someone else saved.
   *
   * With `no` set to null it is a NOTICE instead — one button, nothing to
   * decide — which is how the open-tab watch says another save arrived. A
   * banner was too easy to miss with the rows scrolled down.
   *
   * The safe button comes first in the dialog, so it is the one `showModal`
   * focuses and Enter presses.
   *
   * @param {string} text What is about to happen
   * @param {string} yes Label for the destructive action
   * @param {string|null} no Label for the safe one, or null for a notice
   * @returns {Promise<boolean>} Whether to go ahead
   */
  ask(text, yes = 'Continue', no = 'Cancel') {
    const dialog = this.q('.st-confirm');
    const keep = this.q('.st-confirm-no');
    this.q('.st-confirm-text').textContent = text;
    this.q('.st-confirm-yes').textContent = yes;
    keep.textContent = no || '';
    keep.style.display = no ? '' : 'none';
    dialog.showModal();
    return new Promise((resolve) => {
      const done = (answer) => { dialog.close(); resolve(answer); };
      this.q('.st-confirm-yes').onclick = () => done(true);
      this.q('.st-confirm-no').onclick = () => done(false);
      dialog.oncancel = () => resolve(false);
    });
  }

  q(sel) { return this.querySelector(sel); }

  qa(sel) { return [...this.querySelectorAll(sel)]; }

  /* ---- render ---- */

  renderAll() {
    this.q('.st-repo').textContent = this.repo;
    this.q('.st-site-select').value = this.repo;
    this.qa('.st-tab').forEach((t) => {
      t.setAttribute('aria-selected', String(t.dataset.sheet === this.sheetKey));
    });
    this.renderRows();
    this.renderStatus();
  }

  renderStatus() {
    const site = siteDef(this.repo);
    const save = this.q('.st-save');
    /*
     * Both buttons lock while a write is in flight. They used to stay live, and
     * the admin log shows the result: previews and publishes in pairs seconds
     * apart (seen on the earlier site) — a second click starting a second write
     * before the first had re-read what it wrote.
     */
    save.disabled = !this.dirty || this.saving;
    // A write in flight belongs to one site. Switching mid-write would load the
    // next site's rows under it, and the write would finish with the wrong ones.
    this.q('.st-site-select').disabled = this.saving;
    if (this.saving) save.textContent = 'Saving…';
    else save.textContent = this.dirty ? 'Save & preview' : 'Saved';
    // A disabled PRIMARY button reads as the thing you are meant to press next.
    // When there is nothing to save it should recede instead.
    save.classList.toggle('st-secondary', !this.dirty);

    // Nothing was read, so there is nothing to add a row to — a push into the
    // getter's fallback array would be silently discarded.
    this.q('.st-add').disabled = !this.data;

    const publish = this.q('.st-publish');
    /*
     * Publishing is gated on TWO things, and they are different gates. `publish`
     * mirrors the site's human-owned publishMode — a site somebody froze at
     * preview is not publishable from here at all. Dirtiness is the everyday
     * one: publishing what is in DA while the screen shows something else would
     * put a version live that nobody has looked at.
     */
    publish.disabled = this.saving || this.dirty || !site.publish || !this.data?.exists;
    if (!site.publish) {
      publish.title = `${site.label} is preview-only (st-config.js) — a human publishes it.`;
    } else if (this.dirty) {
      publish.title = 'Save first, so what goes live is what you are looking at.';
    } else {
      publish.title = `Publish the workbook to ${site.repo} live.`;
    }
  }

  renderRows() {
    const list = this.q('.st-rows');
    const notice = this.q('.st-notice');
    const parsed = parseAll(this.rows);
    const def = sheetDef(this.sheetKey);

    SHEETS.forEach(({ key }) => {
      this.q(`[data-count="${key}"]`).textContent = String((this.data?.rows?.[key] || []).length);
    });

    /*
     * "No workbook" is a NOTICE beside the rows, not a state instead of them.
     * The author can start typing rows on a site that has none — the workbook is
     * created by the first save — so the two have to be able to show at once.
     */
    notice.hidden = this.data?.exists !== false;
    if (!notice.hidden) {
      notice.innerHTML = `<p><strong>${esc(this.repo)} has no <code>${esc(AUTHORED_PATH)}</code> workbook yet.</strong>
        No workbook means no curated panels, which is a valid state — the results page simply has no
        featured answer and no promo rail. Saving a row here creates it.</p>`;
    }

    list.innerHTML = this.rows.length
      ? this.rows.map((row, i) => this.rowHtml(row, i, parsed, def)).join('')
      : `<li class="st-empty"><p>Nothing in the <strong>${esc(def.label.toLowerCase())}</strong> sheet.</p>
         <p>${esc(def.key === 'promo'
    ? 'With no promo rows the rail does not appear at all, and the results page is two columns.'
    : 'With no rows there is no featured answer above the results.')}</p></li>`;

    if (this.rows.length) this.wireRows();
    this.renderVerdicts();
  }

  rowHtml(row, i, parsed, def) {
    const issues = diagnose(row, i, parsed, this.sheetKey);
    const level = worst(issues);
    const input = ({ key, hint, area }) => (area
      ? `<textarea rows="2" data-field="${key}" placeholder="${esc(hint)}">${esc(row[key])}</textarea>`
      : `<input type="text" data-field="${key}" value="${esc(row[key])}" placeholder="${esc(hint)}" />`);
    const control = (part) => input(part);

    return `
      <li class="st-row${level ? ` st-row-is-${level}` : ''}${i === this.selected ? ' is-selected' : ''}" data-index="${i}">
        <div class="st-row-bar">
          <span class="st-rank" title="${sheetDef(this.sheetKey).hasTerm
    ? 'Row order is priority order — the first matching row wins'
    : `Row order is what shows — the first ${sheetDef(this.sheetKey).shows} rows appear on every search`}">${i + 1}</span>
          ${sheetDef(this.sheetKey).hasTerm
    ? `<input type="text" class="st-term" data-field="term" value="${esc(row.term)}"
                 placeholder="term, synonym" aria-label="Term"
                 title="A word or phrase, matched as a whole word anywhere in the query. Separate synonyms with commas: document authoring, da" />`
  /* The promo rail has no term: it shows its first three rows on every
               search, so the headline is the row's own title. */
    : `<span class="st-term st-term-is-title">${esc(row.title) || '<em>untitled</em>'}</span>`}
          <div class="st-row-tools">
            <button class="st-icon st-up" ${i === 0 ? 'disabled' : ''} aria-label="Move up" title="Move up — higher priority">↑</button>
            <button class="st-icon st-down" ${i === this.rows.length - 1 ? 'disabled' : ''} aria-label="Move down" title="Move down">↓</button>
            <button class="st-icon st-dupe" title="Duplicate row">Duplicate</button>
            <button class="st-icon st-danger st-del" title="Delete row">Delete</button>
          </div>
        </div>
        <div class="st-fields">
          ${FIELDS.map((field) => `
            <div class="st-field-row${field.parts.length > 1 ? ' st-field-row-is-pair' : ''}">
              <span class="st-label">${esc(field.body ? def.bodyLabel : field.label)}</span>
              ${field.parts.map(control).join('')}
            </div>`).join('')}
        </div>
        ${issues.length ? `<ul class="st-issues">${issues.map((issue) => `<li class="st-issue st-issue-is-${issue.level}">${esc(issue.message)}</li>`).join('')}</ul>` : ''}
      </li>`;
  }

  wireRows() {
    this.qa('.st-row').forEach((el) => {
      const i = Number(el.dataset.index);

      el.addEventListener('focusin', () => {
        if (this.selected === i) return;
        this.selected = i;
        this.qa('.st-row').forEach((r) => r.classList.toggle('is-selected', r === el));
        this.renderVerdicts();
      });

      el.querySelectorAll('[data-field]').forEach((input) => {
        input.addEventListener('input', () => {
          this.rows[i][input.dataset.field] = input.value;
          this.mark();
          /*
           * Diagnostics are refreshed in place rather than by re-rendering the
           * list: every keystroke would otherwise blow away the field the author
           * is typing in, and with it the caret.
           */
          this.refreshIssues();
          this.renderVerdicts();
        });
      });

      el.querySelector('.st-up').addEventListener('click', () => this.move(i, -1));
      el.querySelector('.st-down').addEventListener('click', () => this.move(i, 1));
      el.querySelector('.st-dupe').addEventListener('click', () => {
        this.rows.splice(i + 1, 0, { ...this.rows[i] });
        this.selected = i + 1;
        this.mark();
        this.renderRows();
      });
      el.querySelector('.st-del').addEventListener('click', async () => {
        const row = this.rows[i];
        const named = row.title || row.term;
        if (named && !await this.ask(`Delete the "${named}" row?`, 'Delete')) return;
        this.rows.splice(i, 1);
        this.selected = Math.max(0, Math.min(this.selected, this.rows.length - 1));
        this.mark();
        this.renderRows();
      });
    });
  }

  move(i, delta) {
    const to = i + delta;
    if (to < 0 || to >= this.rows.length) return;
    [this.rows[i], this.rows[to]] = [this.rows[to], this.rows[i]];
    this.selected = to;
    this.mark();
    this.renderRows();
  }

  /** Re-runs the analysis and repaints only the parts that show it. */
  refreshIssues() {
    const parsed = parseAll(this.rows);
    const def = sheetDef(this.sheetKey);
    this.qa('.st-row').forEach((el) => {
      const i = Number(el.dataset.index);
      const issues = diagnose(this.rows[i], i, parsed, this.sheetKey);

      /*
       * The list is created and destroyed rather than emptied, because a row
       * with nothing wrong should have no element there at all — an empty `ul`
       * still carries the grid gap above it, which reads as a ragged card.
       */
      let list = el.querySelector('.st-issues');
      if (!issues.length) {
        list?.remove();
      } else {
        if (!list) {
          list = document.createElement('ul');
          list.className = 'st-issues';
          el.append(list);
        }
        list.innerHTML = issues
          .map((issue) => `<li class="st-issue st-issue-is-${issue.level}">${esc(issue.message)}</li>`).join('');
      }

      LEVELS.forEach((l) => el.classList.remove(`st-row-is-${l}`));
      const level = worst(issues);
      if (level) el.classList.add(`st-row-is-${level}`);
    });
    this.q(`[data-count="${this.sheetKey}"]`).textContent = String(this.rows.length);
    this.summarise(parsed, def);
  }

  summarise(parsed, def) {
    const issuesFor = (i) => diagnose(this.rows[i], i, parsed, this.sheetKey);
    const live = parsed.filter(Boolean).length;
    const skipped = this.rows.filter((r, i) => !parsed[i] && Object.values(r).some(Boolean)).length;
    const dead = parsed.filter((row, i) => row && issuesFor(i)
      .some((issue) => issue.message.startsWith('Never reached'))).length;
    /*
     * Errors are counted SEPARATELY from skipped rows, because they are not the
     * same failure. A skipped row is one the block drops; an error row is one the
     * block keeps but that cannot work as written. Rolling the two together would
     * hide the second inside a number that looks like it is about the first.
     */
    const errored = parsed.filter((row, i) => row
      && issuesFor(i).some((issue) => issue.level === 'error')).length;

    const parts = [`<strong>${live}</strong> row${live === 1 ? '' : 's'} live`];
    if (skipped) parts.push(`<strong>${skipped}</strong> skipped by the block`);
    if (errored) parts.push(`<strong>${errored}</strong> with errors`);
    if (dead) parts.push(`<strong>${dead}</strong> never reached`);
    this.q('.st-summary').innerHTML = `${esc(def.label)}: ${parts.join(' · ')}`;
  }

  /* ---- the reader's view ---- */

  /**
   * Which row each sheet gives for the query under test, and the preview of it.
   *
   * The query defaults to the SELECTED ROW'S OWN TERM, so clicking a row shows
   * that row — an author checking their copy should not have to retype it into
   * the tester first. Typing a query overrides that, which is the other question
   * ("what does someone searching for this actually get?").
   */
  renderVerdicts() {
    const parsedBySheet = Object.fromEntries(
      SHEETS.map(({ key }) => [key, parseAll(this.data?.rows?.[key] || [], key)]),
    );
    const def = sheetDef(this.sheetKey);
    this.summarise(parsedBySheet[this.sheetKey], def);

    // The selected row's FIRST synonym — the whole cell ("taxes, tax") is not
    // something a reader would type.
    const fallback = firstTerm(this.rows[this.selected]?.term);
    const query = this.query.trim() || fallback;
    const source = this.query.trim() ? 'query' : 'row';

    const outcomes = Object.fromEntries(
      SHEETS.map(({ key }) => [key, outcomeFor(parsedBySheet[key], query, key)]),
    );

    /*
     * One verdict line per sheet, and the wording differs because the question
     * differs: the featured sheet is asked "does anything match?", the rail is
     * asked "which three show?" — it always shows something if it has rows.
     */
    const verdict = (sheet, shown) => {
      if (!shown.length) {
        return sheet.hasTerm ? 'nothing matches' : 'no rows to show';
      }
      const names = shown
        .map((r) => `row <strong>${r.index + 1}</strong> — <q>${esc(r.label || r.title)}</q>`)
        .join(', ');
      return sheet.hasTerm ? names : `${names} <span class="st-verdict-note">(every search)</span>`;
    };

    this.q('.st-verdicts').innerHTML = query
      ? `
        <p class="st-verdict-lead">${source === 'row'
    ? `Showing row ${this.selected + 1} — searching <q>${esc(query)}</q>:`
    : `Searching <q>${esc(query)}</q>:`}</p>
        ${SHEETS.map((sheet) => {
    const shown = outcomes[sheet.key];
    return `<p class="st-verdict${shown.length ? '' : ' st-verdict-is-none'}">
            <span class="st-verdict-what">${esc(sheet.label)}</span>
            <span class="st-verdict-row">${verdict(sheet, shown)}</span></p>`;
  }).join('')}`
      : '<p class="st-verdict-lead">Type a query, or pick a row, to see what a reader gets.</p>';

    this.pushPreview(outcomes);
  }

  pushPreview(outcomes) {
    if (!this.previewReady || !this.data) return;
    const parsedBySheet = Object.fromEntries(
      SHEETS.map(({ key }) => [key, parseAll(this.data?.rows?.[key] || [], key)]),
    );
    const query = this.query.trim() || firstTerm(this.rows[this.selected]?.term);
    const resolved = outcomes || Object.fromEntries(
      SHEETS.map(({ key }) => [key, outcomeFor(parsedBySheet[key], query, key)]),
    );
    /*
     * Structured-clone-safe plain objects only — the parsed rows already are, so
     * the frame renders the exact rows this side resolved. It is never asked to
     * match anything itself; there is one matcher and it runs here.
     *
     * Both sides are LISTS: the featured answer is a list of nought or one, the
     * rail of up to three. One shape, so the frame has one thing to draw.
     */
    const plain = (rows) => rows.map((row) => ({ ...row }));
    this.q('.st-frame').contentWindow.postMessage({
      type: 'st-preview',
      featured: plain(resolved.faq),
      promo: plain(resolved.promo),
    }, '*');
  }

  /** Scales the fixed-width frame down to whatever the pane can give it. */
  sizePreview(height) {
    this.frameHeight = height;
    const wrap = this.q('.st-frame-wrap');
    const frame = this.q('.st-frame');
    const scale = Math.min(1, wrap.clientWidth / 1240);
    frame.style.height = `${height}px`;
    frame.style.transform = `scale(${scale})`;
    wrap.style.height = `${Math.ceil(height * scale)}px`;
  }

  /* ---- write ---- */

  async save() {
    const { repo } = this;
    this.saving = true;
    this.renderStatus();
    this.busy('Saving and previewing…');
    let written = null;
    try {
      /*
       * Read DA again before writing. This tab's copy is as old as the tab, and
       * writing it whole replaced every save made since, in BOTH sheets — even a
       * sheet this tab never touched. `reconcile` keeps a sheet only someone
       * else changed, and a sheet both sides changed is put to the author rather
       * than decided for them. What is left is the second between the last read
       * and the write, not the hours a tab can sit open.
       */
      let fresh = await loadWorkbook(repo);
      let plan = reconcile(this.data.sheets, this.data.rows, fresh.sheets);
      const labels = (keys) => keys.map((key) => sheetDef(key).label).join(' and ');

      /*
       * The question can sit open for minutes, and the read it answers is as
       * old as the question — so a save that arrived meanwhile, to EITHER
       * sheet, would be written over by the answer. DA is read again once it
       * is answered and the plan redone from that read. The author is asked
       * again only about a conflict they have not answered: one whose other
       * side moved again, or a sheet that was not in conflict before.
       */
      let again = '';
      /* eslint-disable no-await-in-loop -- each pass waits on the author's answer
         and then re-reads DA; the iterations are sequential by design. */
      while (plan.both.length) {
        const asked = plan.both;
        const replace = await this.ask(
          `${again}Someone else saved the ${labels(asked)} sheet on ${repo} after you opened it, and you have changed it too. Saving now replaces their rows with yours. To see theirs first, cancel and open this tool in a new tab.`,
          'Replace theirs',
        );
        if (!replace) {
          this.banner('error', `Not saved. Your rows are still here, and nothing was written to ${repo}.`);
          return;
        }

        const latest = await loadWorkbook(repo);
        const moved = changedSheets(fresh.sheets, latest.sheets);
        fresh = latest;
        plan = reconcile(this.data.sheets, this.data.rows, fresh.sheets);
        if (plan.both.every((key) => asked.includes(key) && !moved.includes(key))) break;
        again = 'Someone saved again while you were deciding. ';
      }
      /* eslint-enable no-await-in-loop */

      const mine = (key) => (this.data.rows[key] || [])
        // A row with nothing in it is not content; it is a row the author added
        // and left. Writing it back would put a blank line in the sheet.
        .filter((r) => Object.values(r).some((v) => String(v).trim()))
        .map((r) => toSheetRow(r, key, this.data.bodyKeys[key] || sheetDef(key).bodyKey));
      // A sheet this tab did not change goes back exactly as DA holds it.
      const fromDa = [...plan.same, ...plan.theirs];
      const sheets = Object.fromEntries(SHEETS.map(({ key }) => [
        key, fromDa.includes(key) ? fresh.sheets[key] : mine(key),
      ]));

      /*
       * The rows stay editable while the write is in flight. Anything typed
       * now is newer than what is being written, so it is kept as unsaved
       * rather than replaced by the re-read.
       */
      const sent = JSON.stringify(this.data.rows);
      written = sheets;
      const book = await saveWorkbook(repo, fresh.raw, sheets);
      const typed = JSON.stringify(this.data.rows) === sent ? null : this.data.rows;
      this.adopt(book);
      if (typed) {
        this.data.rows = typed;
        this.dirty = true;
      }
      this.noticed = null;
      this.renderRows();
      this.renderStatus();
      const site = siteDef(repo);
      const kept = plan.theirs.length
        ? ` Kept the ${labels(plan.theirs)} rows someone else saved while you were editing.`
        : '';
      const later = typed ? ' What you typed while it saved is not saved yet.' : '';
      this.banner('ok', `Saved and previewed on ${repo}.${kept}${later} ${site.publish
        ? 'Check it on the preview host, then Publish to put it live.'
        : `${site.label} is preview-only — a human publishes it.`}`);
    } catch (err) {
      /*
       * A failure AFTER the write (the preview, or the read after it) leaves
       * the rows in DA. The tab is measured against what it wrote from then on
       * — against the older read, the watch would report this tab's own save
       * as somebody else's — and stays dirty, so Save & preview can finish.
       */
      if (err.saved) this.data.sheets = written;
      if (err.auth) this.authFailed = true;
      const kept = err.auth && keepUnsaved(repo, this.data);
      let note = '';
      if (kept) note = ' Your rows are kept in this browser and will be offered back when the tool reloads.';
      else if (err.saved) note = ` Your rows are saved to ${repo}, but not previewed — Save & preview again to preview them.`;
      this.banner('error', `${err.message}${note}`);
    } finally {
      this.saving = false;
      this.renderStatus();
    }
  }

  async publish() {
    this.saving = true;
    this.renderStatus();
    this.busy('Publishing…');
    try {
      await aemAction('live', this.repo);
      this.banner('ok', `Published to ${this.repo}. The results page serves the new rows on its next load.`);
    } catch (err) {
      this.banner('error', err.message);
    } finally {
      this.saving = false;
      this.renderStatus();
    }
  }

  /* ---- banner ---- */

  busy(message) { this.banner('busy', message); }

  banner(kind, message) {
    const el = this.q('.st-banner');
    el.hidden = !kind;
    el.className = `st-banner${kind ? ` st-banner-is-${kind}` : ''}`;
    el.textContent = message || '';
  }
}

customElements.define('search-terms-manager', SearchTermsManager);
