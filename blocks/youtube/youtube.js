/*
 * Youtube Block
 * Auto-blocks a bare YouTube link on its own line into the embed player.
 */

import decorateEmbed from '../embed/embed.js';

export default function decorate(block) {
  const href = block.tagName === 'A' ? block.href : block.querySelector('a')?.href;
  const embedBlock = document.createElement('div');
  embedBlock.className = 'block embed';

  const link = document.createElement('a');
  link.href = href;
  link.textContent = href;
  embedBlock.append(link);

  block.replaceWith(embedBlock);
  decorateEmbed(embedBlock);
}
