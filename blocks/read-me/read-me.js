/**
 * Decorates the read-me block
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  block.classList.add('read-me');

  // Collect all content from rows
  const rows = block.querySelectorAll(':scope > div');
  const allContent = document.createElement('div');
  
  rows.forEach((row) => {
    const content = row.querySelector(':scope > div');
    if (content) {
      allContent.appendChild(content.cloneNode(true));
    }
  });

  // Find all h2 elements to create tabs
  const h2Elements = allContent.querySelectorAll('h2');
  
  if (h2Elements.length === 0) {
    // No tabs, just process the content normally
    processContent(allContent, block);
    return;
  }

  // Create tabs structure
  const tabsContainer = document.createElement('div');
  tabsContainer.classList.add('read-me-tabs');
  
  const tabButtons = document.createElement('div');
  tabButtons.classList.add('read-me-tab-buttons');
  tabsContainer.appendChild(tabButtons);
  
  const tabContents = document.createElement('div');
  tabContents.classList.add('read-me-tab-contents');
  tabsContainer.appendChild(tabContents);

  // Create tabs from h2 elements
  h2Elements.forEach((h2, index) => {
    const tabName = h2.textContent.trim();
    
    // Create tab button
    const button = document.createElement('button');
    button.classList.add('read-me-tab-button');
    if (index === 0) button.classList.add('active');
    button.textContent = tabName;
    button.setAttribute('data-tab', index);
    tabButtons.appendChild(button);

    // Create tab content
    const tabContent = document.createElement('div');
    tabContent.classList.add('read-me-tab-content');
    if (index === 0) tabContent.classList.add('active');
    tabContent.setAttribute('data-tab', index);
    
    // Collect content until next h2
    let nextElement = h2.nextElementSibling;
    while (nextElement) {
      if (nextElement.tagName === 'H2') break;
      tabContent.appendChild(nextElement.cloneNode(true));
      nextElement = nextElement.nextElementSibling;
    }
    
    // Process content in this tab
    processContent(tabContent, null, true);
    tabContents.appendChild(tabContent);
  });

  // Clear original content and add tabs
  block.innerHTML = '';
  block.appendChild(tabsContainer);

  // Add tab button click handlers
  const buttons = block.querySelectorAll('.read-me-tab-button');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabIndex = button.getAttribute('data-tab');
      
      // Remove active from all buttons and contents
      buttons.forEach((b) => b.classList.remove('active'));
      block.querySelectorAll('.read-me-tab-content').forEach((content) => {
        content.classList.remove('active');
      });
      
      // Add active to clicked button and corresponding content
      button.classList.add('active');
      block.querySelector(`[data-tab="${tabIndex}"]`).classList.add('active');
    });
  });
}

function processContent(container, block, isTabContent = false) {
  // Process headings
  const headings = container.querySelectorAll('h1, h3, h4, h5, h6');
  headings.forEach((heading) => {
    heading.classList.add('read-me-heading');
  });

  // Process lists
  const lists = container.querySelectorAll('ul, ol');
  lists.forEach((list) => {
    list.classList.add('read-me-list');
    list.querySelectorAll('li').forEach((item) => {
      item.classList.add('read-me-list-item');
    });
  });

  // Process paragraphs
  const paragraphs = container.querySelectorAll('p');
  paragraphs.forEach((p) => {
    p.classList.add('read-me-text');
  });

  // Process links
  const links = container.querySelectorAll('a');
  links.forEach((link) => {
    link.classList.add('read-me-link');
  });

  // Process code blocks
  const preBlocks = container.querySelectorAll('pre');
  preBlocks.forEach((pre) => {
    pre.classList.add('read-me-code-block');
  });

  // Process inline code
  const codeElements = container.querySelectorAll('code');
  codeElements.forEach((code) => {
    code.classList.add('read-me-code');
  });

  // Process blockquotes
  const blockquotes = container.querySelectorAll('blockquote');
  blockquotes.forEach((bq) => {
    bq.classList.add('read-me-blockquote');
  });

  if (block && !isTabContent) {
    block.appendChild(container);
  }
}
