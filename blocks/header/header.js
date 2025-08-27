import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { getLanguage, getLangMenuPageUrl, isLanguageSupported } from '../../scripts/lang.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * Creates a language selector dropdown
 * @returns {Element} The language selector element
 */
function createLanguageSelector() {
  const currentLang = getLanguage();
  // Only include languages that are configured in helix-query.yaml
  const supportedLanguages = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
    { code: 'it', label: 'Italiano' },
    { code: 'ja', label: '日本語' },
    { code: 'pt', label: 'Português' },
    { code: 'pl', label: 'Polski' },
    { code: 'ko', label: '한국어' },
    { code: 'zh-tw', label: '繁體中文' },
    { code: 'zh-cn', label: '简体中文' },
  ];

  const langSelector = document.createElement('div');
  langSelector.className = 'language-selector';

  const currentLangButton = document.createElement('button');
  currentLangButton.className = 'current-language';
  currentLangButton.textContent = currentLang.toUpperCase();
  currentLangButton.setAttribute('aria-label', 'Select language');
  currentLangButton.setAttribute('aria-expanded', 'false');

  const langDropdown = document.createElement('ul');
  langDropdown.className = 'language-dropdown';

  // Add current language first
  const currentLangItem = document.createElement('li');
  const currentLangLink = document.createElement('a');
  // Use current page URL for the current language
  currentLangLink.href = window.location.href;
  currentLangLink.textContent = supportedLanguages.find(l => l.code === currentLang)?.label || 'English';
  currentLangLink.classList.add('active');
  // Prevent navigation when clicking on current language
  currentLangLink.addEventListener('click', (e) => {
    e.preventDefault();
  });
  currentLangItem.appendChild(currentLangLink);
  langDropdown.appendChild(currentLangItem);

  // Add language selector elements to DOM immediately
  langSelector.appendChild(currentLangButton);
  langSelector.appendChild(langDropdown);

  // Add other supported languages
  const loadLanguageOptions = async () => {
    const langPromises = supportedLanguages
      .filter(lang => isLanguageSupported(lang.code) && lang.code !== currentLang)
      .map(async (lang) => {
        try {
          // Create a simple language switch link without checking page existence
          // This avoids the .html extension issues
          const langItem = document.createElement('li');
          const langLink = document.createElement('a');

          // Get the current path without language prefix
          const pathParts = window.location.pathname.split('/');
          // Remove empty first element and language code if present
          pathParts.splice(0, pathParts[1] && pathParts[1].length <= 5 ? 2 : 1);
          const currPagePath = pathParts.join('/');

          // Construct direct language URL
          const langUrl = `/${lang.code}/${currPagePath}`;

          // Ensure it's an absolute URL with origin
          langLink.href = `${window.location.origin}${langUrl}`;

          // Add data attribute for debugging
          langLink.setAttribute('data-lang', lang.code);
          langLink.textContent = lang.label;
          langItem.appendChild(langLink);
          return langItem;
        } catch (error) {
          // console.log(`Error creating language link for ${lang.code}:`, error);
        }
        return null;
      });

    // Wait for all language checks to complete
    const langItems = await Promise.all(langPromises);

    // Filter out null items and add to dropdown
    langItems.filter((item) => item !== null).forEach((item) => {
      langDropdown.appendChild(item);
    });

    // If no other languages are available, hide the selector
    if (langDropdown.children.length <= 1) {
      langSelector.style.display = 'none';
    }
  };

  // Start loading language options
  loadLanguageOptions();

  // Add event listeners
  currentLangButton.addEventListener('click', () => {
    const expanded = currentLangButton.getAttribute('aria-expanded') === 'true';
    currentLangButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    langDropdown.style.display = expanded ? 'none' : 'block';
  });

  // Close dropdown when clicking outside
  const closeDropdownHandler = (e) => {
    if (!langSelector.contains(e.target)) {
      currentLangButton.setAttribute('aria-expanded', 'false');
      langDropdown.style.display = 'none';
    }
  };

  // Use a named function so we can remove it later if needed
  document.addEventListener('click', closeDropdownHandler);

  // Store the handler on the langSelector element for potential cleanup
  langSelector.closeDropdownHandler = closeDropdownHandler;

  return langSelector;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // Check if a headerPath was provided via the data attribute
  const headerPathFromData = block.closest('header').dataset.headerPath;

  // load nav as fragment
  const navMeta = getMetadata('nav');
  // Use the headerPath if provided, otherwise fall back to metadata or default
  const navPath = headerPathFromData || (navMeta ? new URL(navMeta, window.location).pathname : '/nav');
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  // Add language selector to tools section
  const navTools = nav.querySelector('.nav-tools');
  if (navTools) {
    const langSelector = createLanguageSelector();
    if (langSelector) {
      navTools.appendChild(langSelector);
    }
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
