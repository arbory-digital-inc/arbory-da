import { loadCSS, loadScript } from '../../scripts/aem.js';

const IS_MAC = /Mac|iPhone|iPad/i.test(navigator.platform);

/* jspreadsheet-ce is the same engine DA sheets run on, loaded on demand so
   the sheet playground's weight is paid only by pages that use it */
const JSUITES_JS = 'https://cdn.jsdelivr.net/npm/jsuites@5/dist/jsuites.js';
const JSUITES_CSS = 'https://cdn.jsdelivr.net/npm/jsuites@5/dist/jsuites.css';
const JSPREADSHEET_JS = 'https://cdn.jsdelivr.net/npm/jspreadsheet-ce@4/dist/index.js';
const JSPREADSHEET_CSS = 'https://cdn.jsdelivr.net/npm/jspreadsheet-ce@4/dist/jspreadsheet.css';

const PLAYGROUND_DATA = [
  ['Write the shortcuts post', 'Content', 'Done'],
  ['Build the sheet demo', 'Engineering', 'In progress'],
  ['QA on mobile', 'Design', 'Not started'],
  ['Schedule publish', 'Content', 'Not started'],
];

const PLAYGROUND_COLUMNS = [
  { title: 'Task', width: 220 },
  { title: 'Team', width: 140 },
  { title: 'Status', width: 140 },
];

const KEY_LABELS = {
  mod: IS_MAC ? '⌘' : 'Ctrl',
  cmd: '⌘',
  ctrl: IS_MAC ? '⌃' : 'Ctrl',
  alt: IS_MAC ? '⌥' : 'Alt',
  shift: IS_MAC ? '⇧' : 'Shift',
  enter: '↵ Enter',
  backspace: '⌫',
  delete: 'Del',
  space: 'Space',
  esc: 'Esc',
  tab: 'Tab',
  f2: 'F2',
  home: 'Home',
  end: 'End',
  arrow: '←↑↓→',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

/* trailing "(some note)" on a keys cell, e.g. "Enter (adds a row on the last row)" */
const NOTE_RE = /\s*(\([^)]*\))\s*$/;

/* "Ctrl" is a literal, platform-invariant key (used e.g. for spreadsheet
   Ctrl+Arrow, which is Ctrl on both Mac and Windows, unlike Mod). On
   non-Mac it's physically the same key as Mod, so normalize it for matching
   real keydown events, which can't otherwise tell the two apart */
function normalizeKeyForMatch(key) {
  return key === 'ctrl' && !IS_MAC ? 'mod' : key;
}

/* Turn "Mod+Shift+Z" into a row of <kbd> keycaps */
function renderCombo(combo) {
  const span = document.createElement('span');
  span.className = 'keyboard-shortcuts-combo';
  span.dataset.combo = combo
    .toLowerCase()
    .replace(/\s/g, '')
    .split('+')
    .map(normalizeKeyForMatch)
    .join('+');
  combo.split('+').forEach((key, i) => {
    if (i > 0) span.append('+');
    const kbd = document.createElement('kbd');
    kbd.textContent = KEY_LABELS[key.trim().toLowerCase()] || key.trim();
    span.append(kbd);
  });
  return span;
}

/* Turn "Mod+B / Mod+I" or free text into rendered keys, with an optional
   trailing parenthetical note rendered as muted text rather than a keycap */
function renderKeys(text) {
  const frag = document.createDocumentFragment();
  const parts = text.split(' / ');
  parts.forEach((part, i) => {
    if (i > 0) frag.append(' or ');
    let keys = part.trim();
    const noteMatch = keys.match(NOTE_RE);
    const note = noteMatch ? noteMatch[1] : null;
    if (noteMatch) keys = keys.slice(0, noteMatch.index).trim();
    if (keys.includes('+') || KEY_LABELS[keys.toLowerCase()]) {
      frag.append(renderCombo(keys));
    } else {
      frag.append(keys); // free text like "type --- then Enter"
    }
    if (note) {
      const noteEl = document.createElement('span');
      noteEl.className = 'keyboard-shortcuts-note';
      noteEl.textContent = ` ${note}`;
      frag.append(noteEl);
    }
  });
  return frag;
}

/* Build a normalized combo string from a real keydown event */
function eventToCombo(e) {
  const parts = [];
  if (IS_MAC ? e.metaKey : e.ctrlKey) parts.push('mod');
  else if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  let key = e.key.toLowerCase();
  if (key.startsWith('arrow')) key = 'arrow';
  if (!['meta', 'control', 'alt', 'shift'].includes(key)) parts.push(key);
  return parts.join('+');
}

/* Highlight the row whose combo matches, scrolling it into view */
function highlightMatch(block, combo) {
  block.querySelectorAll('.keyboard-shortcuts-hit').forEach((el) => el.classList.remove('keyboard-shortcuts-hit'));
  const match = block.querySelector(`[data-combo="${combo}"]`);
  if (!match) return false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const row = match.closest('li');
  row.classList.add('keyboard-shortcuts-hit');
  row.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  return true;
}

/* Doc-editor variant: shortcuts double as page/browser shortcuts too, so
   listen globally and let any matching keydown light up its row */
function enableTryIt(block) {
  const banner = document.createElement('p');
  banner.className = 'keyboard-shortcuts-tryit';
  banner.textContent = '⌨️ Try it: press any shortcut below to light it up.';
  block.prepend(banner);

  document.addEventListener('keydown', (e) => {
    if (highlightMatch(block, eventToCombo(e))) e.preventDefault();
  });
}

/* Sheet variant: instead of simulating shortcuts, embed a real jspreadsheet
   grid (the same engine DA sheets use) so every binding — F2, Alt+Enter,
   Ctrl+Arrow, Ctrl+S — genuinely works. Capture is inherently focus-scoped:
   we only ever see keydowns that bubble out of the grid's own focused cell,
   so arrows/Tab/Space never hijack the surrounding page. We just observe
   and highlight; the grid handles its own defaults natively */
async function enableSheetPlayground(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'keyboard-shortcuts-playground';

  const caption = document.createElement('p');
  caption.className = 'keyboard-shortcuts-tryit';
  caption.textContent = '⌨️ This is a live grid running the same engine as DA sheets — click a cell, then try a shortcut below.';

  const mount = document.createElement('div');
  mount.className = 'keyboard-shortcuts-playground-grid';

  wrapper.append(caption, mount);
  block.prepend(wrapper);

  try {
    await loadScript(JSUITES_JS);
    await loadCSS(JSUITES_CSS);
    await loadScript(JSPREADSHEET_JS);
    await loadCSS(JSPREADSHEET_CSS);

    window.jspreadsheet(mount, {
      data: PLAYGROUND_DATA,
      columns: PLAYGROUND_COLUMNS,
    });

    mount.addEventListener('keydown', (e) => highlightMatch(block, eventToCombo(e)));
  } catch {
    caption.textContent = 'The live grid could not load. The shortcuts below still work as a reference.';
  }
}

export default function decorate(block) {
  const sections = document.createElement('div');
  sections.className = 'keyboard-shortcuts-sections';

  let list;

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length === 1) {
      // single-cell row = section heading
      const section = document.createElement('div');
      section.className = 'keyboard-shortcuts-section';
      const h3 = document.createElement('h3');
      h3.textContent = cells[0].textContent.trim();
      list = document.createElement('ul');
      list.className = 'keyboard-shortcuts-list';
      section.append(h3, list);
      sections.append(section);
      return;
    }
    const [action, keys] = cells;
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'keyboard-shortcuts-action';
    label.textContent = action.textContent.trim();
    li.append(label, renderKeys(keys.textContent.trim()));
    list.append(li);
  });

  block.textContent = '';
  block.append(sections);

  if (block.classList.contains('interactive')) {
    if (block.classList.contains('sheet')) enableSheetPlayground(block);
    else enableTryIt(block);
  }
}
