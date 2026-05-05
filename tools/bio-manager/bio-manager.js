import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const SHEET_PATH = '/private-bios';
const FRAGMENTS_FOLDER = '/en/fragments/bios';
const MEDIA_FOLDER = '/en/fragments/bios/media';

const COL_EMAIL = 'Email';
const COL_PATH = 'DA Fragment URL';
const COL_NAME = 'Name';
const COL_CREATED = 'Created';

const ADMIN_BASE = 'https://admin.da.live/source';
const CONTENT_BASE = 'https://content.da.live';
const EDIT_BASE = 'https://da.live/edit';

const FOLDER_CHAIN = [
  '/en',
  '/en/fragments',
  '/en/fragments/bios',
  '/en/fragments/bios/media',
];

let SDK_TOKEN = '';
let ORG = '';
let SITE = '';

const els = {};
let activeTab = 'create';
let selectedImage = null;
let lastUploadedImageUrl = null;
let bannerRetryHandler = null;
let manageRows = [];
let manageSearch = '';

function authHeaders() {
  return { Authorization: `Bearer ${SDK_TOKEN}` };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function rowEmail(row) {
  return row?.[COL_EMAIL] ?? row?.email ?? '';
}
function rowPath(row) {
  return row?.[COL_PATH] ?? row?.path ?? '';
}
function rowName(row) {
  return row?.[COL_NAME] ?? row?.name ?? '';
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'untitled'
  );
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function showBanner(type, message, retry) {
  els.banner.className = `bm-banner is-visible is-${type}`;
  els.banner.textContent = message;
  bannerRetryHandler = null;
  if (retry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bm-banner-action';
    btn.textContent = retry.label || 'Retry';
    btn.addEventListener('click', retry.handler);
    bannerRetryHandler = retry.handler;
    els.banner.appendChild(btn);
  }
}

function hideBanner() {
  els.banner.className = 'bm-banner';
  els.banner.textContent = '';
  bannerRetryHandler = null;
}

async function ensureFolder(folderPath) {
  const url = `${ADMIN_BASE}/${ORG}/${SITE}${folderPath}`;
  const resp = await fetch(url, { method: 'POST', headers: authHeaders() });
  if (resp.ok) return true;
  if (resp.status === 409 || resp.status === 400 || resp.status === 304) return true;
  if (resp.status === 200 || resp.status === 201) return true;
  throw new Error(`Failed to create folder ${folderPath}: ${resp.status}`);
}

async function ensureFolderChain() {
  for (const folder of FOLDER_CHAIN) {
    // eslint-disable-next-line no-await-in-loop
    await ensureFolder(folder);
  }
}

let sheetEnvelope = null;

async function fetchSheet() {
  const url = `${ADMIN_BASE}/${ORG}/${SITE}${SHEET_PATH}.json`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (resp.status === 404) {
    sheetEnvelope = { kind: 'single' };
    return [];
  }
  if (!resp.ok) throw new Error(`Failed to load sheet (${resp.status})`);
  const json = await resp.json();

  if (Array.isArray(json?.data)) {
    sheetEnvelope = { kind: 'single' };
    return json.data;
  }

  if (Array.isArray(json?.[':names'])) {
    const names = json[':names'];
    const sheetName = names.includes('data') ? 'data' : names[0];
    const inner = json[sheetName];
    const rows = Array.isArray(inner?.data) ? inner.data : [];
    sheetEnvelope = { kind: 'multi', names, primary: sheetName, raw: json };
    return rows;
  }

  sheetEnvelope = { kind: 'single' };
  return [];
}

function buildSingleSheetJson(rows) {
  return {
    total: rows.length,
    limit: rows.length,
    offset: 0,
    data: rows,
    ':type': 'sheet',
  };
}

async function saveSheet(rows) {
  let payload;
  if (sheetEnvelope?.kind === 'multi') {
    const cloned = { ...sheetEnvelope.raw };
    cloned[sheetEnvelope.primary] = {
      total: rows.length,
      limit: rows.length,
      offset: 0,
      data: rows,
    };
    cloned[':type'] = 'multi-sheet';
    cloned[':names'] = sheetEnvelope.names;
    payload = cloned;
  } else {
    payload = buildSingleSheetJson(rows);
  }
  const url = `${ADMIN_BASE}/${ORG}/${SITE}${SHEET_PATH}.json`;
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('data', blob);
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!resp.ok) throw new Error(`Failed to save sheet (${resp.status})`);
  return true;
}

async function checkSlugAvailable(slug) {
  const url = `${ADMIN_BASE}/${ORG}/${SITE}${FRAGMENTS_FOLDER}/${slug}.html`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (resp.status === 404) return true;
  if (resp.status === 200) return false;
  throw new Error(`Slug check failed (${resp.status})`);
}

async function resolveUniqueSlug(base) {
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (!(await checkSlugAvailable(candidate))) {
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 200) throw new Error('Could not resolve a unique slug');
  }
  return candidate;
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function uploadImage(file, slug) {
  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase() || '.jpg';
  const baseName = sanitizeFilename(file.name.replace(/\.[a-z0-9]+$/i, '')) || slug;
  const filename = `${slug}-${baseName}${ext}`.replace(/\.{2,}/g, '.');
  const url = `${ADMIN_BASE}/${ORG}/${SITE}${MEDIA_FOLDER}/${filename}`;
  const formData = new FormData();
  formData.append('data', file, filename);
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!resp.ok) throw new Error(`Image upload failed (${resp.status})`);
  let json = null;
  try {
    json = await resp.json();
  } catch (e) { /* no body */ }
  const contentUrl = json?.source?.contentUrl;
  if (contentUrl) return contentUrl;
  const altUrl = json?.url || json?.source?.url || json?.aem?.previewUrl;
  if (altUrl) return altUrl;
  return `${CONTENT_BASE}/${ORG}/${SITE}${MEDIA_FOLDER}/${filename}`;
}

function buildFragmentHtml({ name, title, imageUrl, imageAlt, bodyHtml }) {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeUrl = escapeAttr(imageUrl);
  const safeAlt = escapeAttr(imageAlt || name);
  return `<body>
  <header></header>
  <main>
    <div>
      <p>
        <picture>
          <img src="${safeUrl}" alt="${safeAlt}" />
        </picture>
      </p>
      <h1>${safeName}</h1>
      <p><strong><u>${safeTitle}</u></strong></p>
      ${bodyHtml}
    </div>
  </main>
  <footer></footer>
</body>`;
}

async function saveFragment(slug, html) {
  const url = `${ADMIN_BASE}/${ORG}/${SITE}${FRAGMENTS_FOLDER}/${slug}.html`;
  const blob = new Blob([html], { type: 'text/html' });
  const formData = new FormData();
  formData.append('data', blob);
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!resp.ok) throw new Error(`Fragment save failed (${resp.status})`);
  return true;
}

async function deleteFragment(path) {
  const url = `${ADMIN_BASE}/${ORG}/${SITE}${path}.html`;
  const resp = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  if (resp.ok || resp.status === 404) return true;
  throw new Error(`Fragment delete failed (${resp.status})`);
}

function buildLayout() {
  const app = document.createElement('div');
  app.className = 'bm-app';
  app.innerHTML = `
    <div class="bm-card">
      <div class="bm-header">
        <h1 class="bm-title">Bio Page Manager</h1>
        <p class="bm-subtitle">Create and manage author bio pages.</p>
      </div>
      <div class="bm-tabs" role="tablist">
        <button type="button" class="bm-tab is-active" data-tab="create" role="tab">Create Bio</button>
        <button type="button" class="bm-tab" data-tab="manage" role="tab">Manage Bios</button>
      </div>
      <div class="bm-banner" role="status" aria-live="polite"></div>

      <section class="bm-panel is-active" data-panel="create">
        <div class="bm-field">
          <label class="bm-label" for="bm-name">Author name<span class="bm-required">*</span></label>
          <input id="bm-name" class="bm-input" type="text" placeholder="Frank Townsend" autocomplete="off" />
          <div class="bm-help">Fragment will be saved as: <code data-slug-preview>/en/fragments/bios/untitled</code></div>
          <div class="bm-error-msg" data-error="name"></div>
        </div>

        <div class="bm-field">
          <label class="bm-label" for="bm-title">Title<span class="bm-required">*</span></label>
          <input id="bm-title" class="bm-input" type="text" placeholder="Designer" autocomplete="off" />
          <div class="bm-error-msg" data-error="title"></div>
        </div>

        <div class="bm-field">
          <label class="bm-label">Hero image<span class="bm-required">*</span></label>
          <div class="bm-image-drop" data-image-drop>
            <div class="bm-image-empty" data-image-empty>
              <strong>Browse for an image</strong>
              <div>JPG, PNG, or WebP recommended.</div>
            </div>
            <div class="bm-image-preview" data-image-preview hidden>
              <img class="bm-image-thumb" data-image-thumb alt="" />
              <div class="bm-image-meta">
                <div class="bm-image-name" data-image-name></div>
                <div class="bm-image-size" data-image-size></div>
              </div>
              <button type="button" class="bm-image-remove" data-image-remove>Remove</button>
            </div>
          </div>
          <input type="file" accept="image/*" hidden data-image-input />
          <div class="bm-error-msg" data-error="image"></div>
        </div>

        <div class="bm-field" data-alt-field hidden>
          <label class="bm-label" for="bm-alt">Image alt text</label>
          <input id="bm-alt" class="bm-input" type="text" placeholder="Defaults to author name" autocomplete="off" />
        </div>

        <div class="bm-field">
          <label class="bm-label" for="bm-email">Author email<span class="bm-required">*</span></label>
          <input id="bm-email" class="bm-input" type="email" placeholder="jane@example.com" autocomplete="off" />
          <div class="bm-error-msg" data-error="email"></div>
        </div>

        <div class="bm-field">
          <label class="bm-label">Bio body copy<span class="bm-required">*</span></label>
          <div class="bm-rte" data-rte>
            <div class="bm-rte-toolbar" data-rte-toolbar>
              <button type="button" class="bm-rte-btn" data-cmd="bold" title="Bold"><strong>B</strong></button>
              <button type="button" class="bm-rte-btn" data-cmd="italic" title="Italic"><em>I</em></button>
              <button type="button" class="bm-rte-btn" data-cmd="underline" title="Underline"><u>U</u></button>
              <button type="button" class="bm-rte-btn" data-cmd="insertOrderedList" title="Ordered list">1.</button>
              <button type="button" class="bm-rte-btn" data-cmd="insertUnorderedList" title="Unordered list">&bull;</button>
              <button type="button" class="bm-rte-btn" data-cmd="createLink" title="Link">Link</button>
            </div>
            <div class="bm-rte-content" contenteditable="true" data-rte-content data-placeholder="Write the bio…"></div>
          </div>
          <div class="bm-error-msg" data-error="body"></div>
        </div>

        <div class="bm-actions">
          <button type="button" class="bm-btn bm-btn--full" data-save>
            <span data-save-label>Save &amp; Open Bio Fragment</span>
          </button>
        </div>

        <p class="bm-help" style="margin-top:14px">
          The author email is recorded in the private DA sheet at <code>${SHEET_PATH}</code>
          and is never written into the published fragment.
        </p>
      </section>

      <section class="bm-panel" data-panel="manage">
        <div data-list-region>
          <div class="bm-list-state" data-list-loading>Loading bios…</div>
        </div>
      </section>
    </div>
  `;
  document.body.appendChild(app);

  els.app = app;
  els.banner = app.querySelector('.bm-banner');
  els.tabs = app.querySelectorAll('.bm-tab');
  els.panels = app.querySelectorAll('.bm-panel');
  els.name = app.querySelector('#bm-name');
  els.title = app.querySelector('#bm-title');
  els.email = app.querySelector('#bm-email');
  els.alt = app.querySelector('#bm-alt');
  els.altField = app.querySelector('[data-alt-field]');
  els.slugPreview = app.querySelector('[data-slug-preview]');
  els.imageDrop = app.querySelector('[data-image-drop]');
  els.imageInput = app.querySelector('[data-image-input]');
  els.imageEmpty = app.querySelector('[data-image-empty]');
  els.imagePreview = app.querySelector('[data-image-preview]');
  els.imageThumb = app.querySelector('[data-image-thumb]');
  els.imageName = app.querySelector('[data-image-name]');
  els.imageSize = app.querySelector('[data-image-size]');
  els.imageRemove = app.querySelector('[data-image-remove]');
  els.rte = app.querySelector('[data-rte]');
  els.rteToolbar = app.querySelector('[data-rte-toolbar]');
  els.rteContent = app.querySelector('[data-rte-content]');
  els.saveBtn = app.querySelector('[data-save]');
  els.saveLabel = app.querySelector('[data-save-label]');
  els.listRegion = app.querySelector('[data-list-region]');
  els.errors = {
    name: app.querySelector('[data-error="name"]'),
    title: app.querySelector('[data-error="title"]'),
    image: app.querySelector('[data-error="image"]'),
    email: app.querySelector('[data-error="email"]'),
    body: app.querySelector('[data-error="body"]'),
  };
}

function setActiveTab(tab) {
  activeTab = tab;
  els.tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
  els.panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === tab));
  if (tab === 'manage') loadAndRenderList();
}

function setError(field, message) {
  const node = els.errors[field];
  if (!node) return;
  if (message) {
    node.textContent = message;
    node.classList.add('is-visible');
    if (field === 'name') els.name.classList.add('is-error');
    if (field === 'title') els.title.classList.add('is-error');
    if (field === 'email') els.email.classList.add('is-error');
    if (field === 'image') els.imageDrop.classList.add('is-error');
    if (field === 'body') els.rte.classList.add('is-error');
  } else {
    node.textContent = '';
    node.classList.remove('is-visible');
    if (field === 'name') els.name.classList.remove('is-error');
    if (field === 'title') els.title.classList.remove('is-error');
    if (field === 'email') els.email.classList.remove('is-error');
    if (field === 'image') els.imageDrop.classList.remove('is-error');
    if (field === 'body') els.rte.classList.remove('is-error');
  }
}

function clearAllErrors() {
  Object.keys(els.errors).forEach((k) => setError(k, ''));
}

function updateSlugPreview() {
  const slug = slugify(els.name.value || '');
  els.slugPreview.textContent = `${FRAGMENTS_FOLDER}/${slug}`;
}

function setSelectedImage(file) {
  selectedImage = file;
  lastUploadedImageUrl = null;
  if (!file) {
    els.imageInput.value = '';
    els.imageEmpty.hidden = false;
    els.imagePreview.hidden = true;
    els.imageThumb.removeAttribute('src');
    els.imageDrop.classList.remove('has-image');
    els.altField.hidden = true;
    return;
  }
  const url = URL.createObjectURL(file);
  els.imageThumb.src = url;
  els.imageName.textContent = file.name;
  els.imageSize.textContent = formatBytes(file.size);
  els.imageEmpty.hidden = true;
  els.imagePreview.hidden = false;
  els.imageDrop.classList.add('has-image');
  els.altField.hidden = false;
  setError('image', '');
}

function getBodyHtml() {
  const html = els.rteContent.innerHTML
    .replace(/<div><br\s*\/?><\/div>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return html;
}

function updateRteToolbarState() {
  const cmds = ['bold', 'italic', 'underline', 'insertOrderedList', 'insertUnorderedList'];
  cmds.forEach((cmd) => {
    const btn = els.rteToolbar.querySelector(`[data-cmd="${cmd}"]`);
    if (!btn) return;
    let active = false;
    try { active = document.queryCommandState(cmd); } catch (e) { /* noop */ }
    btn.classList.toggle('is-active', active);
  });
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
  });

  els.name.addEventListener('input', () => {
    updateSlugPreview();
    setError('name', '');
  });
  els.title.addEventListener('input', () => setError('title', ''));
  els.email.addEventListener('input', () => setError('email', ''));

  els.imageDrop.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-image-remove]')) return;
    if (!selectedImage) els.imageInput.click();
  });
  els.imageInput.addEventListener('change', () => {
    const file = els.imageInput.files?.[0];
    if (file) setSelectedImage(file);
  });
  els.imageRemove.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setSelectedImage(null);
  });

  els.rteToolbar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-cmd]');
    if (!btn) return;
    ev.preventDefault();
    const cmd = btn.dataset.cmd;
    els.rteContent.focus();
    if (cmd === 'createLink') {
      const url = window.prompt('Enter URL');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false, null);
    }
    updateRteToolbarState();
  });
  els.rteContent.addEventListener('keyup', updateRteToolbarState);
  els.rteContent.addEventListener('mouseup', updateRteToolbarState);
  els.rteContent.addEventListener('input', () => setError('body', ''));

  els.saveBtn.addEventListener('click', handleSave);
}

function setSaving(saving) {
  els.saveBtn.disabled = saving;
  els.saveLabel.innerHTML = saving
    ? '<span class="bm-spinner"></span> Saving…'
    : 'Save &amp; Open Bio Fragment';
}

async function handleSave() {
  hideBanner();
  clearAllErrors();

  const name = els.name.value.trim();
  const title = els.title.value.trim();
  const email = els.email.value.trim();
  const altRaw = els.alt.value.trim();
  const bodyHtml = getBodyHtml();

  let firstInvalid = null;
  if (!name) { setError('name', 'Author name is required.'); firstInvalid = firstInvalid || els.name; }
  if (!title) { setError('title', 'Title is required.'); firstInvalid = firstInvalid || els.title; }
  if (!selectedImage) { setError('image', 'Hero image is required.'); firstInvalid = firstInvalid || els.imageDrop; }
  if (!email) { setError('email', 'Email is required.'); firstInvalid = firstInvalid || els.email; }
  else if (!isValidEmail(email)) { setError('email', 'Enter a valid email address.'); firstInvalid = firstInvalid || els.email; }
  if (!bodyHtml || !els.rteContent.textContent.trim()) {
    setError('body', 'Bio body copy is required.');
    firstInvalid = firstInvalid || els.rteContent;
  }

  if (firstInvalid) {
    if (typeof firstInvalid.focus === 'function') firstInvalid.focus();
    return;
  }

  setSaving(true);

  let rows = [];
  let uniqueSlug = '';
  let imageUrl = '';

  try {
    await ensureFolderChain();

    try {
      rows = await fetchSheet();
    } catch (err) {
      throw new Error(`Could not read the bios sheet: ${err.message}`);
    }

    const dup = rows.find((r) => rowEmail(r).toLowerCase() === email.toLowerCase());
    if (dup) {
      setError('email', 'A bio with this email already exists.');
      setSaving(false);
      return;
    }

    const baseSlug = slugify(name);
    uniqueSlug = await resolveUniqueSlug(baseSlug);

    if (lastUploadedImageUrl) {
      imageUrl = lastUploadedImageUrl;
    } else {
      try {
        imageUrl = await uploadImage(selectedImage, uniqueSlug);
        lastUploadedImageUrl = imageUrl;
      } catch (err) {
        setSaving(false);
        showBanner('error', `Image upload failed: ${err.message}`, {
          label: 'Retry upload',
          handler: () => {
            hideBanner();
            handleSave();
          },
        });
        return;
      }
    }

    const html = buildFragmentHtml({
      name,
      title,
      imageUrl,
      imageAlt: altRaw || name,
      bodyHtml,
    });

    await saveFragment(uniqueSlug, html);

    const newRow = {
      [COL_EMAIL]: email,
      [COL_PATH]: `${FRAGMENTS_FOLDER}/${uniqueSlug}`,
      [COL_NAME]: name,
      [COL_CREATED]: new Date().toISOString(),
    };
    const updatedRows = rows.concat(newRow);

    try {
      await saveSheet(updatedRows);
    } catch (err) {
      setSaving(false);
      showBanner('error',
        `The bio fragment was created at ${FRAGMENTS_FOLDER}/${uniqueSlug}.html, but the private sheet could not be updated: ${err.message}`,
        {
          label: 'Retry sheet update',
          handler: async () => {
            hideBanner();
            try {
              await saveSheet(updatedRows);
              redirectToFragment(uniqueSlug);
            } catch (e2) {
              showBanner('error', `Sheet update still failed: ${e2.message}`);
            }
          },
        });
      return;
    }

    redirectToFragment(uniqueSlug);
  } catch (err) {
    setSaving(false);
    showBanner('error', err.message || 'Save failed.');
  }
}

function redirectToFragment(slug) {
  const target = `${EDIT_BASE}#/${ORG}/${SITE}${FRAGMENTS_FOLDER}/${slug}`;
  window.top.location.href = target;
}

async function loadAndRenderList() {
  els.listRegion.innerHTML = '<div class="bm-list-state">Loading bios…</div>';
  let rows;
  try {
    rows = await fetchSheet();
  } catch (err) {
    els.listRegion.innerHTML = `<div class="bm-list-state">Could not load bios: ${escapeHtml(err.message)}</div>`;
    return;
  }
  renderList(rows);
}

function renderList(rows) {
  manageRows = rows;
  if (!rows.length) {
    els.listRegion.innerHTML = '<div class="bm-list-state">No bios yet. Create one in the “Create Bio” tab.</div>';
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = `
    <div class="bm-search">
      <input
        type="search"
        class="bm-input bm-search-input"
        placeholder="Search by name, email, or path…"
        data-search
        autocomplete="off"
      />
      <span class="bm-search-count" data-search-count></span>
    </div>
    <div class="bm-table-wrap">
      <table class="bm-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Fragment Path</th>
            <th></th>
          </tr>
        </thead>
        <tbody data-tbody></tbody>
      </table>
    </div>
  `;
  els.listRegion.replaceChildren(container);

  const input = container.querySelector('[data-search]');
  input.value = manageSearch;
  input.addEventListener('input', () => {
    manageSearch = input.value;
    renderManageRows();
  });

  renderManageRows();
}

function renderManageRows() {
  const tbody = els.listRegion.querySelector('[data-tbody]');
  const countEl = els.listRegion.querySelector('[data-search-count]');
  if (!tbody) return;

  const q = manageSearch.trim().toLowerCase();
  const filtered = q
    ? manageRows.filter((r) => (
      rowName(r).toLowerCase().includes(q)
      || rowEmail(r).toLowerCase().includes(q)
      || rowPath(r).toLowerCase().includes(q)
    ))
    : manageRows.slice();

  filtered.sort((a, b) => rowName(a).localeCompare(rowName(b)));

  if (countEl) {
    countEl.textContent = q
      ? `${filtered.length} of ${manageRows.length}`
      : `${manageRows.length} ${manageRows.length === 1 ? 'bio' : 'bios'}`;
  }

  tbody.replaceChildren();

  if (!filtered.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4" class="bm-list-state" style="padding:20px">No matches.</td>';
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach((row) => {
    const tr = document.createElement('tr');
    const path = rowPath(row);
    tr.innerHTML = `
      <td>${escapeHtml(rowName(row))}</td>
      <td>${escapeHtml(rowEmail(row))}</td>
      <td class="bm-table-path">${escapeHtml(path)}</td>
      <td>
        <div class="bm-row-actions">
          <button type="button" class="bm-btn bm-btn--secondary bm-btn--small" data-action="open">Open</button>
          <button type="button" class="bm-btn bm-btn--danger bm-btn--small" data-action="remove">Remove</button>
        </div>
      </td>
    `;
    tr.querySelector('[data-action="open"]').addEventListener('click', () => {
      const url = `${EDIT_BASE}#/${ORG}/${SITE}${path}`;
      window.open(url, '_blank', 'noopener');
    });
    tr.querySelector('[data-action="remove"]').addEventListener('click', () => {
      confirmRemove(row);
    });
    tbody.appendChild(tr);
  });
}

function confirmRemove(row) {
  const backdrop = document.createElement('div');
  backdrop.className = 'bm-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bm-modal" role="dialog" aria-modal="true">
      <h3 class="bm-modal-title">Remove bio</h3>
      <p class="bm-modal-body">
        Remove the bio for ${escapeHtml(rowName(row) || rowEmail(row))}?
        This will delete the fragment and remove the sheet entry. This cannot be undone.
      </p>
      <div class="bm-modal-actions">
        <button type="button" class="bm-btn bm-btn--secondary" data-cancel>Cancel</button>
        <button type="button" class="bm-btn bm-btn--danger" data-confirm>Remove</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('[data-cancel]').addEventListener('click', close);
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });
  backdrop.querySelector('[data-confirm]').addEventListener('click', async () => {
    close();
    await performRemove(row);
  });
}

async function performRemove(row) {
  hideBanner();
  const path = rowPath(row);
  const label = rowName(row) || rowEmail(row);
  try {
    await deleteFragment(path);
  } catch (err) {
    showBanner('error', `Could not delete the fragment: ${err.message}`);
    return;
  }

  let rows;
  try {
    rows = await fetchSheet();
  } catch (err) {
    showBanner('error', `Fragment was deleted, but the sheet could not be loaded: ${err.message}`, {
      label: 'Retry sheet update',
      handler: () => performRemove(row),
    });
    return;
  }
  const updated = rows.filter((r) => rowPath(r) !== path);
  try {
    await saveSheet(updated);
  } catch (err) {
    showBanner('error', `Fragment was deleted, but the sheet could not be updated: ${err.message}`, {
      label: 'Retry sheet update',
      handler: async () => {
        try {
          const fresh = await fetchSheet();
          await saveSheet(fresh.filter((r) => rowPath(r) !== path));
          showBanner('success', `Bio for ${label} removed.`);
          loadAndRenderList();
        } catch (e2) {
          showBanner('error', `Sheet update still failed: ${e2.message}`);
        }
      },
    });
    return;
  }
  showBanner('success', `Bio for ${label} removed.`);
  loadAndRenderList();
}

function showInitError(message) {
  document.body.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'bm-init-error';
  box.innerHTML = `
    <h2>Bio Page Manager could not start</h2>
    <p>${escapeHtml(message)}</p>
  `;
  document.body.appendChild(box);
}

(async function init() {
  try {
    const sdk = await DA_SDK;
    const { context, token } = sdk || {};
    if (!context || !token) {
      showInitError('DA SDK context or token was not provided. Open this app from inside DA.');
      return;
    }
    const org = context.org || context.organization || context.owner;
    const site = context.site || context.repo || context.repository;
    if (!org || !site) {
      showInitError('Could not determine org/site from the DA SDK context.');
      return;
    }
    SDK_TOKEN = token;
    ORG = org;
    SITE = site;

    buildLayout();
    bindEvents();
    updateSlugPreview();
  } catch (err) {
    showInitError(`Initialization failed: ${err?.message || err}`);
  }
}());
