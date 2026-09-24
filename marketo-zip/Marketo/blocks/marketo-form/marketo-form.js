/*
 * Marketo Form Block
 *
 * EDS block wrapper that delegates to the Marketo plugin in tools/marketo/.
 * The block name in DA is "marketo-form" — authors insert it as a table
 * with the header "Marketo Form".
 */
import initMarketo from '../../tools/marketo/marketo.js';

export default async function init(el) {
  await initMarketo(el);
}
