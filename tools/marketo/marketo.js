/*
 * Marketo Forms — Runtime renderer for AEM Edge Delivery Services
 *
 * Renders Marketo forms within EDS pages using the MktoForms2 API.
 * Authors configure form ID, optional title/description, success behavior,
 * and hidden field mappings via the standard EDS block table in DA.
 *
 * NOTHING CLIENT-SPECIFIC LIVES IN THIS FILE. Instance host, Munchkin ID,
 * copy and behaviour toggles all come from ./marketo-config.js.
 *
 * Architecture:
 *   1. Block init parses authored table rows into a typed config object.
 *   2. Instance settings resolve (inline config, optionally overridden by a
 *      per-site DA config sheet).
 *   3. The MktoForms2 SDK is loaded once (deduped) from the Marketo instance.
 *   4. The form is embedded into a container inside the block.
 *   5. Hidden/static fields are injected before submission.
 *   6. On success, the block shows an inline message or redirects.
 *   7. Munchkin tracking is initialized alongside the form (if enabled).
 */

import CONFIG from './marketo-config.js';

/* ── site config loader (cached) ───────────────────────────────── */

let siteConfigPromise = null;

/**
 * Fetch the optional DA config sheet and return a key→value map.
 * Cached per page load. Returns an empty map when no sheet is configured or
 * the fetch fails — the inline config in marketo-config.js then stands alone.
 * @returns {Promise<Record<string, string>>}
 */
function loadSiteConfig() {
  if (siteConfigPromise) return siteConfigPromise;

  const path = CONFIG.sheet?.path;
  if (!path) {
    siteConfigPromise = Promise.resolve({});
    return siteConfigPromise;
  }

  siteConfigPromise = (async () => {
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Config fetch failed: ${resp.status}`);
      const json = await resp.json();
      const rows = json.data || json[':items'] || [];
      const map = {};
      rows.forEach(({ key, value }) => {
        if (key && value) map[key] = value;
      });
      return map;
    } catch (err) {
      // Non-fatal: the sheet is an optional per-site override layer.
      // eslint-disable-next-line no-console
      console.warn('Marketo block: no site config sheet at', path, err);
      return {};
    }
  })();

  return siteConfigPromise;
}

/**
 * Resolve the Marketo instance settings for this page.
 * Sheet values (if any) override the inline config; the sandbox flag selects
 * which Munchkin ID is used.
 * @param {boolean} sandbox
 * @returns {Promise<{ baseUrl: string, munchkinId: string }>}
 */
async function resolveSettings(sandbox) {
  const sheet = await loadSiteConfig();
  const keys = CONFIG.sheet?.keys || {};

  const baseUrl = sheet[keys.baseUrl] || CONFIG.baseUrl || '';
  const munchkinId = sandbox
    ? sheet[keys.munchkinIdSandbox] || CONFIG.munchkinIdSandbox || ''
    : sheet[keys.munchkinId] || CONFIG.munchkinId || '';

  // Normalize: accept 'https://host', '//host' or 'host' — MktoForms2 wants a
  // scheme-bearing or protocol-relative origin with no trailing slash.
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  return {
    baseUrl: normalized && !/^(https?:)?\/\//.test(normalized) ? `//${normalized}` : normalized,
    munchkinId: munchkinId.trim(),
  };
}

/* ── helpers ───────────────────────────────────────────────────── */

/**
 * Sanitize a string for safe DOM insertion — strips HTML tags.
 * @param {string} raw
 * @returns {string}
 */
function sanitize(raw) {
  if (!raw) return '';
  const div = document.createElement('div');
  div.textContent = raw;
  return div.innerHTML;
}

/**
 * Validate that a form ID is a positive integer.
 * @param {string} id
 * @returns {boolean}
 */
function isValidFormId(id) {
  return /^\d+$/.test(id) && Number(id) > 0;
}

/**
 * Validate a URL string (relative or absolute).
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!url) return false;
  // Allow relative paths
  if (url.startsWith('/')) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/* ── field sanitization patterns ───────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d\s().-]{7,20}$/;
// Matches explicit links only: full URLs (http/https), protocol-relative URLs
// (//host), and www. links. Bare domains (foo.biz) are intentionally NOT
// matched — they add false-positive risk for the least-common spam shape, and
// the two arms below already cover any TLD.
const URL_RE = /(?:https?:)?\/\/\S+|\bwww\.\S+/gi;

/**
 * Defang a matched URL so the text is preserved but it is no longer a live,
 * clickable link: http→hxxp, https→hxxps, and every "." → "[.]". No mainstream
 * CRM, mail client, or Marketo view auto-links a host with a bracketed dot, so
 * a spammer's link loses its payoff while a lead's real URL stays readable.
 * @param {string} match
 * @returns {string}
 */
function defangUrl(match) {
  return match.replace(/https?/gi, (s) => s.replace(/t/gi, 'x')).replace(/\./g, '[.]');
}

/**
 * Clean and validate a single submitted field value. PURE — no DOM access; the
 * caller is responsible for passing only visible, user-entered fields (never
 * hidden/system fields).
 *
 * Order: strip HTML → clamp length → defang URLs → validate email/phone by
 * field-name heuristic. Each step is individually switchable in
 * marketo-config.js → `sanitize`.
 *
 * URL defanging and HTML stripping are silent. Email/phone problems return a
 * human-readable message in `errors`, which the caller uses to block submission.
 *
 * @param {string} key - the field name
 * @param {string} val - the raw submitted value
 * @returns {{ value: string, errors: string[] }}
 */
export function sanitizeFieldValue(key, val) {
  const errors = [];
  if (typeof val !== 'string') return { value: val, errors };

  const opts = CONFIG.sanitize || {};
  const messages = CONFIG.messages || {};

  // Strip HTML tags and trim
  let clean = val.replace(/<[^>]*>/g, '').trim();

  // Max length
  const max = opts.maxFieldLength;
  if (max && clean.length > max) {
    clean = clean.substring(0, max);
  }

  // Defang URLs (anti-spam). Silent — links are neutralized in place, the
  // text is preserved, and submission is not blocked.
  if (opts.defangUrls !== false) {
    clean = clean.replace(URL_RE, defangUrl);
  }

  const keyLower = key.toLowerCase();

  // Email validation (field name heuristic)
  if (opts.validateEmailFields !== false
    && keyLower.includes('email') && clean && !EMAIL_RE.test(clean)) {
    errors.push(messages.invalidEmail || 'Please enter a valid email address.');
  }

  // Phone validation (field name heuristic)
  if (opts.validatePhoneFields !== false
    && (keyLower.includes('phone') || keyLower.includes('mobile'))
    && clean && !PHONE_RE.test(clean)) {
    errors.push(messages.invalidPhone || 'Please enter a valid phone number.');
  }

  return { value: clean, errors };
}

/* ── config parser ─────────────────────────────────────────────── */

/**
 * Parse authored block rows into a structured config object.
 *
 * Expected DA table layout (each row = key | value):
 *
 *   | Marketo Form                                  |
 *   | ------          | ------                      |
 *   | Form ID         | 1234                        |
 *   | Title           | Contact Us                  |
 *   | Description     | Fill out the form below...  |
 *   | Success Message | Thank you for contacting us |
 *   | Redirect URL    | /contact/thank-you          |
 *   | Field Mapping   | LeadSource=Website          |
 *   | Field Mapping   | MktoPersonNotes=General     |
 *
 * @param {HTMLElement} block
 * @returns {{ formId: string, title: string, description: string,
 *             successMessage: string, redirectUrl: string,
 *             submitButtonText: string, sandbox: boolean,
 *             fieldMappings: Array<{fieldName:string, value:string}> }}
 */
export function parseConfig(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const config = {
    formId: '',
    title: '',
    description: '',
    successMessage: '',
    redirectUrl: '',
    submitButtonText: '',
    sandbox: false,
    fieldMappings: [],
  };

  rows.forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;

    const key = cells[0].textContent.trim().toLowerCase().replace(/\s+/g, '-');
    const rawValue = cells[1].textContent.trim();

    switch (key) {
      case 'form-id':
        config.formId = rawValue;
        break;
      case 'title':
        config.title = rawValue;
        break;
      case 'description':
        config.description = rawValue;
        break;
      case 'success-message':
        config.successMessage = rawValue;
        break;
      case 'redirect-url':
        config.redirectUrl = rawValue;
        break;
      case 'submit-button-text':
        config.submitButtonText = rawValue;
        break;
      case 'sandbox':
        config.sandbox = rawValue.toLowerCase() === 'true';
        break;
      case 'field-mapping':
      case 'hidden-fields': {
        // Format: fieldName=value
        const eqIdx = rawValue.indexOf('=');
        if (eqIdx > 0) {
          const fieldName = rawValue.substring(0, eqIdx).trim();
          const value = rawValue.substring(eqIdx + 1).trim();
          if (fieldName) {
            config.fieldMappings.push({ fieldName, value });
          }
        }
        break;
      }
      default:
        break;
    }
  });

  return config;
}

/* ── SDK loader (deduped) ──────────────────────────────────────── */

let sdkPromise = null;

/**
 * Load the MktoForms2 SDK script exactly once.
 * @param {string} baseUrl - the Marketo instance origin
 * @returns {Promise<object>} resolves with window.MktoForms2
 */
function loadMarketoSDK(baseUrl) {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (window.MktoForms2) {
      resolve(window.MktoForms2);
      return;
    }

    const script = document.createElement('script');
    script.src = `${baseUrl}/js/forms2/js/forms2.min.js`;
    script.async = true;

    script.onload = () => {
      if (window.MktoForms2) {
        resolve(window.MktoForms2);
      } else {
        reject(new Error('MktoForms2 not available after script load'));
      }
    };

    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('Failed to load Marketo Forms SDK'));
    };

    document.head.append(script);
  });

  return sdkPromise;
}

/* ── Munchkin loader (deduped) ─────────────────────────────────── */

let munchkinLoaded = false;

/**
 * Initialize Munchkin tracking. Called once per page, and skipped entirely
 * when `enableMunchkin` is false in marketo-config.js (e.g. because a tag
 * manager or consent framework owns it instead).
 * @param {string} baseUrl - the Marketo instance origin
 * @param {string} munchkinId - The resolved Munchkin account ID
 */
function initMunchkin(baseUrl, munchkinId) {
  if (CONFIG.enableMunchkin === false) return;
  if (!munchkinId || !baseUrl || munchkinLoaded || window.Munchkin) {
    munchkinLoaded = true;
    return;
  }

  const script = document.createElement('script');
  script.src = `${baseUrl}/js/munchkin.js`;
  script.async = true;
  script.onload = () => {
    if (window.Munchkin) {
      window.Munchkin.init(munchkinId, CONFIG.munchkinOptions || { asyncOnly: true });
      munchkinLoaded = true;
    }
  };
  document.head.append(script);
}

/* ── DOM builders ──────────────────────────────────────────────── */

/**
 * Build the block's inner DOM structure.
 * @param {object} config
 * @returns {{ container: HTMLElement, formEl: HTMLElement }}
 */
function buildFormDOM(config) {
  const container = document.createElement('div');
  container.className = 'marketo-form-container';

  // Title
  if (config.title) {
    const heading = document.createElement('h2');
    heading.className = 'marketo-form-title';
    heading.textContent = config.title;
    container.append(heading);
  }

  // Description
  if (config.description) {
    const desc = document.createElement('h3');
    desc.className = 'marketo-form-description';
    desc.textContent = config.description;
    container.append(desc);
  }

  // Form target element — MktoForms2 renders into this
  const formId = `mktoForm_${sanitize(config.formId)}`;
  const formEl = document.createElement('form');
  formEl.id = formId;
  formEl.setAttribute('aria-label', config.title || 'Marketo Form');
  container.append(formEl);

  return { container, formEl };
}

/**
 * Show an inline success message, replacing the form.
 * @param {HTMLElement} container
 * @param {string} message
 */
function showSuccessMessage(container, message) {
  const wrapper = document.createElement('div');
  wrapper.className = 'marketo-form-success';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');

  const heading = document.createElement('h3');
  heading.className = 'marketo-form-success-heading';
  heading.textContent = CONFIG.messages?.successHeading || 'Success';

  const msg = document.createElement('p');
  msg.className = 'marketo-form-success-message';
  msg.textContent = message;

  wrapper.append(heading, msg);

  // Replace form content with success message
  const form = container.querySelector('form');
  if (form) form.replaceWith(wrapper);
}

/**
 * Show an error state inside the block.
 * @param {HTMLElement} container
 * @param {string} message
 */
function showError(container, message) {
  const wrapper = document.createElement('div');
  wrapper.className = 'marketo-form-error';
  wrapper.setAttribute('role', 'alert');

  const msg = document.createElement('p');
  msg.textContent = message;
  wrapper.append(msg);

  container.append(wrapper);
}

/* ── required-field marking ────────────────────────────────────── */

/**
 * Is this required field empty? Handles text/select/textarea plus
 * checkbox/radio groups (a group is empty when nothing is checked).
 * @param {HTMLElement} field
 * @param {HTMLFormElement} formEl
 * @returns {boolean}
 */
export function isFieldEmpty(field, formEl) {
  if (field.type === 'checkbox' || field.type === 'radio') {
    const group = formEl.querySelectorAll(`[name="${CSS.escape(field.name)}"]`);
    return !Array.from(group).some((el) => el.checked);
  }
  return !String(field.value || '').trim();
}

/**
 * Marketo's native validation stops at the FIRST invalid field, so only one
 * field ever gets `aria-invalid`. Run our own pass over every required field
 * and mark them all, so the user sees each field they still have to fill in.
 * Only touches emptiness of required fields — format errors (email, phone)
 * are still Marketo's / sanitizeFieldValue's job.
 * @param {HTMLFormElement} formEl
 */
export function markEmptyRequiredFields(formEl) {
  const required = formEl.querySelectorAll(
    '.mktoField[aria-required="true"], .mktoRequiredField .mktoField',
  );

  required.forEach((field) => {
    if (field.type === 'hidden' || field.offsetParent === null) return;

    if (isFieldEmpty(field, formEl)) {
      field.setAttribute('aria-invalid', 'true');
      field.classList.add('mkto-field-invalid');
    } else {
      field.classList.remove('mkto-field-invalid');
    }
  });
}

/**
 * Clear a field's own invalid marking as soon as the user starts filling it in,
 * so the red only ever reflects what is still outstanding.
 * @param {HTMLFormElement} formEl
 */
export function wireInvalidClearing(formEl) {
  const clear = (event) => {
    const field = event.target.closest('.mktoField');
    if (!field || !field.classList.contains('mkto-field-invalid')) return;
    if (isFieldEmpty(field, formEl)) return;
    field.classList.remove('mkto-field-invalid');
    field.removeAttribute('aria-invalid');
  };

  formEl.addEventListener('input', clear);
  formEl.addEventListener('change', clear);
}

/* ── main init ─────────────────────────────────────────────────── */

/**
 * Block entry point. Parses config, loads SDK, renders form.
 * @param {HTMLElement} block - The .marketo-form block element
 */
export default async function init(block) {
  const config = parseConfig(block);
  const messages = CONFIG.messages || {};

  // ── validation ──
  if (!config.formId) {
    // eslint-disable-next-line no-console
    console.warn('Marketo block: missing Form ID');
    return;
  }

  if (!isValidFormId(config.formId)) {
    // eslint-disable-next-line no-console
    console.warn('Marketo block: invalid Form ID', config.formId);
    return;
  }

  if (config.redirectUrl && !isValidUrl(config.redirectUrl)) {
    // eslint-disable-next-line no-console
    console.warn('Marketo block: invalid Redirect URL, ignoring', config.redirectUrl);
    config.redirectUrl = '';
  }

  // ── resolve instance settings ──
  const { baseUrl, munchkinId } = await resolveSettings(config.sandbox);

  if (!baseUrl || !munchkinId) {
    // eslint-disable-next-line no-console
    console.error(
      'Marketo block: not configured. Set `baseUrl` and `munchkinId` in '
      + 'tools/marketo/marketo-config.js, or supply them via the config sheet. '
      + `(resolved baseUrl="${baseUrl}", munchkinId="${munchkinId}"${config.sandbox ? ', sandbox' : ''})`,
    );
    block.textContent = '';
    const { container } = buildFormDOM(config);
    block.append(container);
    showError(container, messages.configError
      || 'Form configuration error. Please contact the site administrator.');
    return;
  }

  // ── build DOM ──
  block.textContent = '';
  const { container } = buildFormDOM(config);
  block.append(container);

  // ── load SDK + render ──
  try {
    const MktoForms2 = await loadMarketoSDK(baseUrl);

    MktoForms2.loadForm(
      baseUrl,
      munchkinId,
      Number(config.formId),
      (form) => {
        // SDK calls back with null if the form definition could not be fetched
        if (!form) {
          showError(container, messages.loadError
            || 'Unable to load the form. Please try again later.');
          return;
        }

        // Submit-gate: mark the form as "submit attempted" so CSS only paints
        // invalid fields red AFTER the first submit press — not while the user
        // is still typing/tabbing before ever trying to submit. Capturing phase
        // so it runs before Marketo's own validation. See marketo.css
        // (`.mktoForm[data-submitted] .mktoField[aria-invalid="true"]`).
        const formEl = form.getFormElem()[0];
        if (formEl) {
          const markSubmitted = () => {
            formEl.setAttribute('data-submitted', '');
            // Mark EVERY empty required field, not just the first one Marketo
            // trips over. Runs in the capturing phase, before Marketo validates.
            markEmptyRequiredFields(formEl);
          };
          const submitBtn = formEl.querySelector('.mktoButton');
          if (submitBtn) submitBtn.addEventListener('click', markSubmitted, true);
          formEl.addEventListener('submit', markSubmitted, true);
          wireInvalidClearing(formEl);
        }

        // Marketo clears aria-invalid on the fields it skips while validating,
        // so re-mark all of them after each failed validation pass.
        form.onValidate((valid) => {
          if (valid) return;
          const elem = form.getFormElem()[0];
          if (elem && elem.hasAttribute('data-submitted')) markEmptyRequiredFields(elem);
        });

        // Inject hidden/static field values
        if (config.fieldMappings.length > 0) {
          const hiddenFields = {};
          config.fieldMappings.forEach(({ fieldName, value }) => {
            hiddenFields[fieldName] = value;
          });
          form.addHiddenFields(hiddenFields);
        }

        // Sanitize and validate user input before submission. Only visible,
        // user-entered fields are touched — hidden/system fields (Referrer,
        // tracking params, injected field mappings) are left intact so
        // marketing attribution data is never mangled.
        form.onSubmit(() => {
          const formElem = form.getFormElem()[0];
          const vals = form.vals();
          const sanitized = {};
          const errors = [];

          Object.entries(vals).forEach(([key, val]) => {
            if (typeof val !== 'string') return;

            // Skip anything that isn't a visible, user-editable input.
            const el = formElem && formElem.querySelector(`[name="${CSS.escape(key)}"]`);
            if (!el || el.type === 'hidden' || el.offsetParent === null) return;

            const { value: clean, errors: fieldErrors } = sanitizeFieldValue(key, val);
            errors.push(...fieldErrors);

            if (clean !== val) sanitized[key] = clean;
          });

          // If validation errors, block submission
          if (errors.length) {
            if (formElem) {
              let errEl = formElem.querySelector('.mkto-validation-error');
              if (!errEl) {
                errEl = document.createElement('div');
                errEl.className = 'mkto-validation-error';
                errEl.setAttribute('role', 'alert');
                errEl.setAttribute('aria-live', 'assertive');
                formElem.prepend(errEl);
              }
              // Show every problem, not just the first one.
              errEl.textContent = '';
              const list = document.createElement('ul');
              [...new Set(errors)].forEach((message) => {
                const item = document.createElement('li');
                item.textContent = message;
                list.append(item);
              });
              errEl.append(list);
            }
            return false;
          }

          // Apply sanitized values
          if (Object.keys(sanitized).length) form.vals(sanitized);
          return true;
        });

        // Set up success handler
        form.onSuccess(() => {
          if (config.redirectUrl) {
            window.location.href = config.redirectUrl;
            return false;
          }

          showSuccessMessage(
            container,
            config.successMessage
              || messages.defaultSuccess
              || 'Thank you. Your submission has been received.',
          );
          return false;
        });

        // Custom submit button text
        if (config.submitButtonText) {
          const formElem = form.getFormElem()[0];
          if (formElem) {
            const submitBtn = formElem.querySelector('.mktoButton');
            if (submitBtn) {
              submitBtn.textContent = config.submitButtonText;
            }
          }
        }
      },
    );

    // Accessibility: ensure all form inputs have labels
    MktoForms2.whenReady((form) => {
      const formElem = form.getFormElem()[0];
      if (!formElem || !container.contains(formElem)) return;

      formElem.querySelectorAll('input, select, textarea').forEach((input) => {
        if (!input.id) return;
        const label = formElem.querySelector(`label[for="${input.id}"]`);
        if (!label && !input.getAttribute('aria-label')) {
          const name = input.name || input.id;
          input.setAttribute('aria-label', name);
        }
      });
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Marketo block: failed to load form', err);
    showError(container, messages.loadError
      || 'Unable to load the form. Please try again later.');
  }

  // ── Munchkin tracking ──
  initMunchkin(baseUrl, munchkinId);
}
