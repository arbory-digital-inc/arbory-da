/**
 * Decorates the read-me block
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  block.classList.add('read-me');

  // Process each row in the block
  const rows = block.querySelectorAll(':scope > div');
  
  rows.forEach((row) => {
    const content = row.querySelector(':scope > div');
    if (!content) return;

    // Add appropriate classes for styling
    row.classList.add('read-me-section');
    
    // Process headings
    const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading) => {
      heading.classList.add('read-me-heading');
    });

    // Process lists
    const lists = content.querySelectorAll('ul, ol');
    lists.forEach((list) => {
      list.classList.add('read-me-list');
      // Add classes to list items for nested list styling
      list.querySelectorAll('li').forEach((item) => {
        item.classList.add('read-me-list-item');
      });
    });

    // Process paragraphs
    const paragraphs = content.querySelectorAll('p');
    paragraphs.forEach((p) => {
      p.classList.add('read-me-text');
    });

    // Process links
    const links = content.querySelectorAll('a');
    links.forEach((link) => {
      link.classList.add('read-me-link');
    });

    // Process code blocks
    const preBlocks = content.querySelectorAll('pre');
    preBlocks.forEach((pre) => {
      pre.classList.add('read-me-code-block');
    });

    // Process inline code
    const codeElements = content.querySelectorAll('code');
    codeElements.forEach((code) => {
      code.classList.add('read-me-code');
    });

    // Process blockquotes
    const blockquotes = content.querySelectorAll('blockquote');
    blockquotes.forEach((bq) => {
      bq.classList.add('read-me-blockquote');
    });
  });
}
