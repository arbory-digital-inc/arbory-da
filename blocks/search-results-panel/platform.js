/*
 * What the search block needs from the site it runs on — the ONE file that
 * differs between the two Arbory sites that carry this block:
 *
 *   arbory-da  (blog.arborydigital.com, AEM boilerplate)  — this file
 *   arbory-www (arborydigital.com, Author Kit)            — its own platform.js
 *
 * Every other file under blocks/search-results-panel/, scripts/search/ and
 * scripts/search-mock/ is copied between the two repositories byte for byte.
 * Change one there, copy it to the other; change something site-specific, and
 * it belongs here.
 */
import { loadCSS } from '../../scripts/aem.js';

/** Awaitable, idempotent stylesheet load (keyed on the href). */
export { loadCSS };

/**
 * The path code is served under, '' when code and content share the host root
 * (always, on EDS). No trailing slash.
 *
 * @returns {string}
 */
export const codeBasePath = () => window.hlx?.codeBasePath || '';

/**
 * Where the blog lives, for links into it: '' here, because this IS the blog,
 * so a blog page's root-relative URL already points at the right host.
 */
export const BLOG_ORIGIN = '';

/**
 * The blog's language folder for a language of this site. Identity here: the
 * search page's language is a blog language.
 *
 * @param {string} lang e.g. 'de'
 * @returns {string}
 */
export const blogLocale = (lang) => lang;

/**
 * Extra stylesheets the panel loads after its own, for this site's theme.
 * None here: search-results-panel.css is written in the blog's tokens.
 *
 * @returns {string[]} Root-relative hrefs
 */
export const siteStyles = () => [];
