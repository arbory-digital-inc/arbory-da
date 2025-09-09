import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // Check if a footerPath was provided via the data attribute
  const footerPathFromData = block.closest('footer').dataset.footerPath;

  const footerMeta = getMetadata('footer');
  block.textContent = '';

  // load footer fragment
  // Use the footerPath if provided, otherwise fall back to metadata or default
  const footerPath = footerPathFromData || (footerMeta ? footerMeta.footer : '/footer');
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  block.append(footer);
}
