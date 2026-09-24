/*
 * Marketo Form — DA Library Plugin
 *
 * Authoring UI inside the DA library palette so authors can insert a
 * "Marketo Form" block without hand-building a table.
 *
 * NOTHING CLIENT-SPECIFIC LIVES IN THIS FILE — the forms-service URL and the
 * field-name suggestions come from ./marketo-config.js.
 *
 * ── Two operating modes ──────────────────────────────────────────────────
 *
 * 1. CATALOG MODE (a `formsServiceUrl` is configured). The plugin calls a
 *    server-side proxy that brokers the Marketo Asset REST API, so authors
 *    search live forms BY NAME and never need to know a form ID. Marketo
 *    credentials stay server-side; nothing sensitive reaches the browser.
 *
 *      plugin  ──►  your proxy service  ──►  Marketo Asset REST API
 *
 *    See service/ for a deployable reference implementation and the contract.
 *
 * 2. MANUAL MODE (no service configured, or the service is unreachable). The
 *    picker accepts a numeric Form ID typed directly. Everything else in the
 *    dialog behaves identically. This is the zero-backend path — the plugin is
 *    fully usable out of the box.
 *
 * Flow:
 *   1. GENERAL — form picker, title/description, submit label, post-submit
 *                behaviour (redirect URL or success message), sandbox toggle.
 *   2. VALUES  — repeatable hidden-field mappings. Field Name suggestions are
 *                loaded for the selected form when a service is available.
 *
 * On "Insert", the plugin builds the standard EDS block table and hands it to
 * the DA editor via the App SDK `actions.sendHTML()`, then closes the library.
 *
 * The generated table is consumed at runtime by tools/marketo/marketo.js
 * (the block renderer), so the row keys here MUST match that parser:
 * "Form ID", "Title", "Description", "Submit Button Text", "Success Message",
 * "Redirect URL", "Sandbox", "Hidden Fields".
 */

import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import CONFIG from './marketo-config.js';

/* ── constants ─────────────────────────────────────────────────── */

// Field-name suggestions used when no service is configured or the per-form
// lookup fails. Edit the list in marketo-config.js, not here.
const FALLBACK_FIELDS = CONFIG.fallbackFieldNames || [];

/* ── state ─────────────────────────────────────────────────────── */

const state = {
  forms: [], // [{ id, name, locale, status }]
  fields: [...FALLBACK_FIELDS], // field-name suggestions for the Values tab
  mappings: [], // [{ fieldName, value }]
  selectedFormId: '', // resolved numeric id as string
  serviceBase: (CONFIG.formsServiceUrl || '').replace(/\/$/, ''),
  formsError: false,
};

/** True when no catalog service is configured — the plugin runs in manual mode. */
const isManualMode = () => !state.serviceBase;

/* ── helpers ───────────────────────────────────────────────────── */

/**
 * Create an element with optional class, attributes, and text.
 * @param {string} tag
 * @param {{ class?: string, text?: string, attrs?: Record<string,string> }} [opts]
 * @returns {HTMLElement}
 */
function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) {
    Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  }
  return node;
}

/**
 * Escape a string for safe insertion into generated table HTML.
 * @param {string} raw
 * @returns {string}
 */
function escapeHtml(raw) {
  const div = document.createElement('div');
  div.textContent = raw ?? '';
  return div.innerHTML;
}

/**
 * Build the display label for a form.
 * @param {{name:string, locale?:string, id:(string|number), manual?:boolean}} form
 * @returns {string}
 */
function formLabel(form) {
  if (form.manual) return `Form ID ${form.id}`;
  return form.locale
    ? `${form.name} [${form.locale}] (${form.id})`
    : `${form.name} (${form.id})`;
}

/* ── service client ────────────────────────────────────────────── */

/**
 * GET JSON from the proxy service with a timeout. No credentials are sent —
 * the service holds them server-side.
 * @param {string} path
 * @returns {Promise<object>}
 */
async function serviceGet(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(`${state.serviceBase}${path}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      const err = new Error(`Service responded ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load the form catalog from the service. No-op in manual mode.
 * @returns {Promise<void>}
 */
async function loadForms() {
  if (isManualMode()) {
    state.forms = [];
    state.formsError = false;
    return;
  }
  try {
    const data = await serviceGet('');
    state.forms = Array.isArray(data.forms) ? data.forms : [];
    state.formsError = false;
  } catch {
    state.forms = [];
    state.formsError = true;
  }
}

/**
 * Load field metadata for the selected form to suggest Field Names on the
 * Values tab. Failure is non-fatal — falls back to the static suggestions.
 * @param {string} formId
 * @returns {Promise<void>}
 */
async function loadFields(formId) {
  if (!formId || isManualMode()) return;
  try {
    const data = await serviceGet(`/fields?formId=${encodeURIComponent(formId)}`);
    const names = Array.isArray(data.fields) ? data.fields.map((f) => f.name).filter(Boolean) : [];
    state.fields = names.length ? names : [...FALLBACK_FIELDS];
  } catch {
    state.fields = [...FALLBACK_FIELDS];
  }
}

/* ── block-table builder ───────────────────────────────────────── */

/**
 * Build the EDS block table HTML the runtime block parser understands.
 * @param {object} config
 * @param {string} config.formId
 * @param {string} config.title
 * @param {string} config.description
 * @param {string} config.submitButtonText
 * @param {string} config.successMessage
 * @param {string} config.redirectUrl
 * @param {boolean} config.sandbox
 * @param {Array<{fieldName:string,value:string}>} config.mappings
 * @returns {string}
 */
function buildBlockHTML(config) {
  const rows = ['<tr><td colspan="2">marketo-form</td></tr>'];

  const addRow = (key, value) => {
    if (!value) return;
    rows.push(`<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`);
  };

  addRow('Form ID', config.formId);
  addRow('Title', config.title);
  addRow('Description', config.description);
  addRow('Submit Button Text', config.submitButtonText);
  // Redirect URL wins over Success Message at runtime; only emit the one in use.
  if (config.redirectUrl) {
    addRow('Redirect URL', config.redirectUrl);
  } else {
    addRow('Success Message', config.successMessage);
  }
  if (config.sandbox) addRow('Sandbox', 'true');

  const hiddenMappings = config.mappings.filter((m) => m.fieldName);
  hiddenMappings.forEach(({ fieldName, value }) => {
    addRow('Hidden Fields', `${fieldName}=${value}`);
  });

  return `<table>${rows.join('')}</table>`;
}

/* ── tabs ──────────────────────────────────────────────────────── */

/**
 * Wire up tab switching for the panel.
 * @param {HTMLElement} root
 */
function initTabs(root) {
  const tabs = [...root.querySelectorAll('.mkto-tab')];
  const panels = [...root.querySelectorAll('.mkto-panel')];

  const activate = (name) => {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
  };

  tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab)));
  return activate;
}

/* ── searchable form picker ────────────────────────────────────── */

/**
 * Build a searchable combobox for selecting a Marketo form. Supports
 * filter-as-you-type, keyboard navigation, and loading/error/empty states.
 *
 * Whatever the catalog state, typing a bare number always offers a
 * "Use Form ID N" option — that is the manual-mode path, and it is also the
 * escape hatch when the catalog is unreachable or a form is missing from it.
 *
 * @param {(formId: string) => void} onSelect called with the resolved id (or '')
 * @returns {{ element: HTMLElement, refresh: () => void, focus: () => void }}
 */
function createFormPicker(onSelect) {
  const wrap = el('div', { class: 'mkto-combobox' });

  const input = el('input', {
    class: 'mkto-input mkto-combobox-input',
    attrs: {
      id: 'mkto-form-input',
      type: 'text',
      role: 'combobox',
      'aria-expanded': 'false',
      'aria-controls': 'mkto-form-listbox',
      'aria-autocomplete': 'list',
      autocomplete: 'off',
      placeholder: isManualMode() ? 'Enter a Form ID…' : 'Search forms…',
    },
  });

  const listbox = el('ul', {
    class: 'mkto-listbox',
    attrs: { id: 'mkto-form-listbox', role: 'listbox', hidden: 'hidden' },
  });

  wrap.append(input, listbox);

  let activeIndex = -1;
  let visible = [];

  const close = () => {
    listbox.setAttribute('hidden', 'hidden');
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  };

  const selectForm = (form) => {
    input.value = formLabel(form);
    state.selectedFormId = String(form.id);
    close();
    onSelect(state.selectedFormId);
  };

  const open = () => {
    listbox.removeAttribute('hidden');
    input.setAttribute('aria-expanded', 'true');
  };

  const addOption = (form, i) => {
    const opt = el('li', {
      class: 'mkto-option',
      attrs: { role: 'option', id: `mkto-opt-${i}`, 'data-id': String(form.id) },
    });
    opt.append(el('span', { class: 'mkto-option-name', text: form.manual ? formLabel(form) : form.name }));
    if (!form.manual) {
      const meta = form.locale ? `${form.locale} · ${form.id}` : String(form.id);
      opt.append(el('span', { class: 'mkto-option-meta', text: meta }));
    } else {
      opt.append(el('span', { class: 'mkto-option-meta', text: 'enter manually' }));
    }
    opt.addEventListener('mousedown', (e) => { e.preventDefault(); selectForm(form); });
    listbox.append(opt);
    visible.push(form);
  };

  const renderOptions = (query) => {
    listbox.textContent = '';
    visible = [];

    const q = query.trim().toLowerCase();

    // A bare number is always offered as a manual Form ID, first in the list.
    if (/^\d+$/.test(q) && Number(q) > 0) {
      addOption({ id: q, name: `Form ID ${q}`, manual: true }, 0);
    }

    if (!isManualMode() && state.formsError) {
      listbox.append(el('li', {
        class: 'mkto-listbox-msg',
        text: 'Could not load the form catalog. Enter a numeric Form ID instead.',
        attrs: { role: 'presentation' },
      }));
      open();
      return;
    }

    const matches = state.forms.filter((f) => {
      if (!q) return true;
      return formLabel(f).toLowerCase().includes(q) || String(f.id).includes(q);
    }).slice(0, 50);

    matches.forEach((form, i) => addOption(form, visible.length + i));

    if (!visible.length) {
      let msg;
      if (isManualMode()) msg = 'Type the numeric Form ID of the form to embed.';
      else if (state.forms.length) msg = 'No matching forms. Type a numeric Form ID to use it directly.';
      else msg = 'No forms available. Type a numeric Form ID to use it directly.';
      listbox.append(el('li', { class: 'mkto-listbox-msg', text: msg, attrs: { role: 'presentation' } }));
    }

    open();
  };

  const setActive = (index) => {
    const opts = [...listbox.querySelectorAll('.mkto-option')];
    if (!opts.length) return;
    activeIndex = (index + opts.length) % opts.length;
    opts.forEach((o, i) => o.classList.toggle('is-active', i === activeIndex));
    opts[activeIndex].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', opts[activeIndex].id);
  };

  input.addEventListener('input', () => {
    // Clear selection when user edits — they must pick from the list
    state.selectedFormId = '';
    onSelect('');
    renderOptions(input.value);
  });

  input.addEventListener('focus', () => renderOptions(input.value));

  input.addEventListener('blur', () => {
    // If nothing was chosen from the list, accept a bare numeric ID that was
    // typed but not confirmed — otherwise clear the input.
    if (state.selectedFormId) return;
    const typed = input.value.trim();
    if (/^\d+$/.test(typed) && Number(typed) > 0) {
      selectForm({ id: typed, name: `Form ID ${typed}`, manual: true });
    } else {
      input.value = '';
    }
  });

  input.addEventListener('keydown', (e) => {
    const isOpen = !listbox.hasAttribute('hidden');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) renderOptions(input.value);
      setActive(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && visible[activeIndex]) {
        selectForm(visible[activeIndex]);
      } else if (isOpen && visible.length === 1) {
        selectForm(visible[0]);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });

  // Close on outside click.
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  return {
    element: wrap,
    refresh: () => { if (!listbox.hasAttribute('hidden')) renderOptions(input.value); },
    focus: () => input.focus(),
  };
}

/* ── GENERAL panel ─────────────────────────────────────────────── */

/**
 * Add a labelled text input to a panel.
 * @param {HTMLElement} panel
 * @param {{id:string, label:string, placeholder?:string, hint?:string}} opts
 */
function addTextField(panel, opts) {
  const group = el('div', { class: 'mkto-field' });
  group.append(el('label', { class: 'mkto-label', text: opts.label, attrs: { for: opts.id } }));
  group.append(el('input', {
    class: 'mkto-input',
    attrs: { id: opts.id, type: 'text', placeholder: opts.placeholder || '' },
  }));
  if (opts.hint) group.append(el('p', { class: 'mkto-hint', text: opts.hint }));
  panel.append(group);
}

/**
 * Build the GENERAL panel: form picker, presentation and post-submit behaviour.
 * @param {(formId:string)=>void} onFormChange
 * @returns {{ panel: HTMLElement, picker: object }}
 */
function buildGeneralPanel(onFormChange) {
  const panel = el('section', { class: 'mkto-panel is-active', attrs: { 'data-panel': 'general' } });

  // ── Form picker ──
  const formGroup = el('div', { class: 'mkto-field' });
  const label = el('label', { class: 'mkto-label', text: 'Form', attrs: { for: 'mkto-form-input' } });
  label.append(el('span', { class: 'mkto-required', text: ' *' }));
  formGroup.append(label);

  const picker = createFormPicker(onFormChange);
  formGroup.append(picker.element);

  formGroup.append(el('p', {
    class: 'mkto-hint',
    attrs: { id: 'mkto-form-status' },
    text: isManualMode() ? 'Enter the numeric Form ID from Marketo.' : 'Loading forms…',
  }));
  formGroup.append(el('p', { class: 'mkto-hint mkto-error', attrs: { id: 'mkto-form-error' } }));
  panel.append(formGroup);

  addTextField(panel, {
    id: 'mkto-title',
    label: 'Title',
    placeholder: 'e.g. Contact Us',
    hint: 'Heading (h2) displayed above the form.',
  });

  addTextField(panel, {
    id: 'mkto-description',
    label: 'Description',
    placeholder: 'e.g. Fill out the form below',
    hint: 'Subtext (h3) displayed below the title.',
  });

  addTextField(panel, {
    id: 'mkto-submit-text',
    label: 'Submit Button Text',
    placeholder: 'Submit (default)',
    hint: 'Custom text for the form submit button.',
  });

  addTextField(panel, {
    id: 'mkto-success-url',
    label: 'Success URL',
    placeholder: '/path/to/thank-you',
    hint: 'Redirect here after a successful submit. Takes precedence over the success message below.',
  });

  addTextField(panel, {
    id: 'mkto-success-message',
    label: 'Success Message',
    placeholder: 'e.g. Thank you — we will be in touch.',
    hint: 'Shown in place of the form after submit. Ignored if a Success URL is set.',
  });

  // ── Sandbox toggle ──
  const sandboxGroup = el('div', { class: 'mkto-field' });
  const sandboxLabel = el('label', { class: 'mkto-label', attrs: { for: 'mkto-sandbox' } });
  const sandboxInput = el('input', { attrs: { id: 'mkto-sandbox', type: 'checkbox' } });
  sandboxLabel.append(sandboxInput, document.createTextNode(' Use sandbox Marketo instance'));
  sandboxGroup.append(sandboxLabel);
  sandboxGroup.append(el('p', { class: 'mkto-hint', text: 'For testing only. Leave off for production forms.' }));
  panel.append(sandboxGroup);

  return { panel, picker };
}

/* ── VALUES panel ──────────────────────────────────────────────── */

/**
 * Build a single "Set Value" mapping row.
 * @param {number} index
 * @param {() => void} onChange
 * @param {() => void} onRemove
 * @returns {HTMLElement}
 */
function buildMappingRow(index, onChange, onRemove) {
  const row = el('div', { class: 'mkto-mapping', attrs: { 'data-index': String(index) } });

  // Header with remove control
  const head = el('div', { class: 'mkto-mapping-head' });
  head.append(el('span', { class: 'mkto-mapping-title', text: 'Set Value' }));
  const remove = el('button', { class: 'mkto-icon-btn', text: '🗑', attrs: { type: 'button', title: 'Remove', 'aria-label': 'Remove field' } });
  remove.addEventListener('click', onRemove);
  head.append(remove);
  row.append(head);

  // Field Name (combobox)
  const nameField = el('div', { class: 'mkto-field' });
  nameField.append(el('label', { class: 'mkto-label', text: 'Field Name' }));
  const nameInput = el('input', {
    class: 'mkto-input mkto-map-name',
    attrs: { list: `mkto-field-list-${index}`, placeholder: 'e.g. LeadSource', autocomplete: 'off' },
  });
  const fieldList = el('datalist', { class: 'mkto-field-datalist', attrs: { id: `mkto-field-list-${index}` } });
  state.fields.forEach((name) => fieldList.append(el('option', { attrs: { value: name } })));
  nameInput.addEventListener('input', onChange);
  nameField.append(nameInput, fieldList);
  row.append(nameField);

  // Value
  const valueField = el('div', { class: 'mkto-field' });
  valueField.append(el('label', { class: 'mkto-label', text: 'Value' }));
  const valueInput = el('input', { class: 'mkto-input mkto-map-value', attrs: { type: 'text', placeholder: 'e.g. Website' } });
  valueInput.addEventListener('input', onChange);
  valueField.append(valueInput);
  row.append(valueField);

  return row;
}

/**
 * Build the VALUES panel. Returns the panel plus a `refreshFields` hook so the
 * Field Name suggestions can be updated after a form is selected.
 * @returns {{ panel: HTMLElement, refreshFields: () => void }}
 */
function buildValuesPanel() {
  const panel = el('section', { class: 'mkto-panel', attrs: { 'data-panel': 'values' } });
  panel.append(el('p', { class: 'mkto-group-label', text: 'Hidden Field Values' }));
  panel.append(el('p', {
    class: 'mkto-hint',
    text: 'Prefill hidden Marketo fields — e.g. attribution or routing values. Leave empty if not needed.',
  }));

  const list = el('div', { class: 'mkto-mapping-list' });
  panel.append(list);

  const addBtn = el('button', { class: 'mkto-btn mkto-btn-secondary', text: 'Add', attrs: { type: 'button' } });
  panel.append(addBtn);

  let counter = 0;

  const sync = () => {
    state.mappings = [...list.querySelectorAll('.mkto-mapping')].map((rowEl) => ({
      fieldName: rowEl.querySelector('.mkto-map-name').value.trim(),
      value: rowEl.querySelector('.mkto-map-value').value.trim(),
    }));
  };

  const addRow = () => {
    const index = counter;
    counter += 1;
    const rowEl = buildMappingRow(index, sync, () => { rowEl.remove(); sync(); });
    list.append(rowEl);
    sync();
  };

  addBtn.addEventListener('click', addRow);
  addRow(); // start with one empty row

  const refreshFields = () => {
    list.querySelectorAll('.mkto-field-datalist').forEach((dl) => {
      dl.textContent = '';
      state.fields.forEach((name) => dl.append(el('option', { attrs: { value: name } })));
    });
  };

  return { panel, refreshFields };
}

/* ── main ──────────────────────────────────────────────────────── */

(async function init() {
  const { actions } = await DA_SDK;

  // Allow a ?service= override for local / cross-origin development, and as a
  // way to point a shared codebase at a different environment's service.
  const params = new URLSearchParams(window.location.search);
  const serviceOverride = params.get('service');
  if (serviceOverride) state.serviceBase = serviceOverride.replace(/\/$/, '');

  const root = document.getElementById('marketo-plugin');
  root.textContent = '';
  root.removeAttribute('aria-busy');

  // Tab bar
  const tabBar = el('div', { class: 'mkto-tabs', attrs: { role: 'tablist' } });
  [['general', 'General'], ['values', 'Values']].forEach(([tab, label], i) => {
    const btn = el('button', {
      class: `mkto-tab${i === 0 ? ' is-active' : ''}`,
      text: label,
      attrs: { type: 'button', role: 'tab', 'data-tab': tab, 'aria-selected': i === 0 ? 'true' : 'false' },
    });
    tabBar.append(btn);
  });
  root.append(tabBar);

  // Field-suggestion loading is debounced/serialised via a monotonic token so
  // that a stale response can't overwrite a newer selection.
  let fieldsToken = 0;
  let valuesUI;

  const onFormChange = (formId) => {
    if (!formId) return;
    fieldsToken += 1;
    const token = fieldsToken;
    loadFields(formId).then(() => {
      if (token === fieldsToken && valuesUI) valuesUI.refreshFields();
    });
  };

  // Panels
  const general = buildGeneralPanel(onFormChange);
  valuesUI = buildValuesPanel();
  root.append(general.panel, valuesUI.panel);

  const activate = initTabs(root);

  // Footer
  const footer = el('div', { class: 'mkto-footer' });
  const insertBtn = el('button', { class: 'mkto-btn mkto-btn-primary', text: 'Insert', attrs: { type: 'button' } });
  footer.append(insertBtn);
  root.append(footer);

  const formInput = root.querySelector('#mkto-form-input');
  const formError = root.querySelector('#mkto-form-error');
  const formStatus = root.querySelector('#mkto-form-status');

  // Load the form catalog asynchronously so the UI is interactive immediately.
  if (!isManualMode()) {
    loadForms().then(() => {
      if (state.formsError) {
        formStatus.textContent = '';
        formError.textContent = 'Unable to load the form catalog — you can still enter a Form ID.';
      } else {
        formStatus.textContent = `${state.forms.length} form${state.forms.length === 1 ? '' : 's'} available.`;
        formError.textContent = '';
      }
      general.picker.refresh();
    });
  }

  const validateForm = () => {
    const id = state.selectedFormId;
    if (!id) {
      formError.textContent = isManualMode()
        ? 'Please enter a numeric Form ID.'
        : 'Please select a form, or enter a numeric Form ID.';
      return '';
    }
    formError.textContent = '';
    return id;
  };

  insertBtn.addEventListener('click', () => {
    const formId = validateForm();
    if (!formId) { activate('general'); formInput.focus(); return; }

    const config = {
      formId,
      title: root.querySelector('#mkto-title').value.trim(),
      description: root.querySelector('#mkto-description').value.trim(),
      submitButtonText: root.querySelector('#mkto-submit-text').value.trim(),
      successMessage: root.querySelector('#mkto-success-message').value.trim(),
      redirectUrl: root.querySelector('#mkto-success-url').value.trim(),
      sandbox: root.querySelector('#mkto-sandbox').checked,
      mappings: state.mappings.filter((m) => m.fieldName),
    };

    actions.sendHTML(buildBlockHTML(config));
    actions.closeLibrary();
  });
}());
