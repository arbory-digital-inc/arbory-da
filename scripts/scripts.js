import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  sampleRUM,
} from './aem.js';

import {
  getLanguage,
  getLanguageNav,
  getLanguageFooter,
  isLanguageSupported,
  getSupportedLanguages
} from './lang.js';

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  // check if the first block is called arbory-blog-hero or blog-post-hero and if it is don't make a default hero
  const firstBlock = main.querySelector(':scope > div');
  if (firstBlock && (firstBlock.querySelector('.arbory-blog-hero') || firstBlock.querySelector('.blog-post-hero'))) {
    return;
  }
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

const defaultMetaImage = `${window.location.origin}/icons/arbory-share.jpg`;


/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * If the metaproperty Image is not present, use the default value
 * Default metaimage is located in /icons/arbor-share.jpg.
 */
function setMetaImage() {
  const imageMeta = getMetadata('image');
  if (!imageMeta) {
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', defaultMetaImage);
  }
}

export function getDefaultMetaImage() {
  return defaultMetaImage;
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  // Language is already set in lang.js, no need to set it here
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  sampleRUM.enhance();

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Adds language prefix to internal links to maintain language selection
 * @param {Element} doc The document element
 */
function setupLanguagePreservation(doc) {
  // Import the processLinksForLanguage function from lang.js if available
  if (typeof window.processLinksForLanguage === 'function') {
    window.processLinksForLanguage(doc);
  } else {
    // Fallback to basic language prefix for links if the function isn't available
    const lang = getLanguage();
    if (!lang || lang === 'en') return; // Don't modify links if we're on English pages
    
    doc.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      
      // Skip external links, anchors, and special protocols
      if (href.startsWith('http://') || 
          href.startsWith('https://') || 
          href.startsWith('#') || 
          href.startsWith('javascript:') || 
          href.startsWith('tel:') || 
          href.startsWith('mailto:')) {
        return;
      }
      
      // Skip links that already have the current language code
      if (href.startsWith(`/${lang}/`)) return;
      
      // Skip links to files (like PDFs, images, etc.)
      const fileExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.mp3', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
      if (fileExtensions.some(ext => href.toLowerCase().endsWith(ext))) return;
      
      // Add the current language prefix to the link
      const langUrl = `/${lang}${href.startsWith('/') ? '' : '/'}${href}`;
      a.setAttribute('href', langUrl);
    });
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  // Use language-specific header and footer
  const headerPath = getLanguageNav();
  const footerPath = getLanguageFooter();
  loadHeader(doc.querySelector('header'), headerPath);
  loadFooter(doc.querySelector('footer'), footerPath);
  
  // Set up language preservation for links
  setupLanguagePreservation(doc);

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();

// DA Live Preview
(async function loadDa() {
  if (!new URL(window.location.href).searchParams.get('dapreview')) return;
  // eslint-disable-next-line import/no-unresolved
  import('https://da.live/scripts/dapreview.js').then(({ default: daPreview }) => daPreview(loadPage));
}());
