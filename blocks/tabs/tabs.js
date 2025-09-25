// eslint-disable-next-line import/no-unresolved
import { toClassName } from '../../scripts/aem.js';

function processListContent(container, sourceCell, type) {
  container.innerHTML = ''; // Clear existing content

  const header = document.createElement('h4');
  header.className = `${type}-header`;
  header.innerHTML = `<span class="icon">${type === 'benefit' ? '+' : '-'}</span>`;

  // Use simpler header text
  const headerText = type === 'benefit' ? 'Pros' : 'Cons';
  header.appendChild(document.createTextNode(headerText));
  container.appendChild(header);

  // Process list items
  const listContainer = document.createElement('ul');
  listContainer.className = `${type}-list`;

  // Look for existing lists or create from content
  const existingLists = sourceCell.querySelectorAll('ul, ol');
  if (existingLists.length > 0) {
    existingLists.forEach((list) => {
      const items = list.querySelectorAll('li');
      items.forEach((item) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = item.innerHTML;
        listContainer.appendChild(listItem);
      });
    });
  } else {
    // If no lists, try to create from paragraph content
    const paragraphs = sourceCell.querySelectorAll('p');
    paragraphs.forEach((p) => {
      if (p.textContent.trim()) {
        const listItem = document.createElement('li');
        listItem.innerHTML = p.innerHTML;
        listContainer.appendChild(listItem);
      }
    });
  }

  container.appendChild(listContainer);
}

function processProConsContent(tabpanel) {
  // Look for the structure: 1st=title, 2nd=badge, 3rd=description, 4th=pros, 5th=cons
  const contentDivs = tabpanel.querySelectorAll(':scope > div');

  if (contentDivs.length >= 5) {
    // Extract badge text from 2nd column and store it on the tabpanel for later use
    const badgeText = contentDivs[1].textContent.trim();
    tabpanel.setAttribute('data-badge', badgeText);

    // Create new structure
    const wrapper = document.createElement('div');
    wrapper.className = 'comparison-content-wrapper';

    // Create platform header section (title from 1st column)
    const platformHeader = document.createElement('div');
    platformHeader.className = 'platform-header';

    // Platform summary (first div - title)
    const platformSummary = document.createElement('div');
    platformSummary.className = 'platform-summary';
    platformSummary.innerHTML = contentDivs[0].innerHTML;
    platformHeader.appendChild(platformSummary);

    // Add badge to platform header (right-aligned)
    const badge = document.createElement('span');
    badge.className = 'platform-badge';
    badge.textContent = badgeText;
    platformHeader.appendChild(badge);

    // Add description content (3rd column)
    if (contentDivs[2] && contentDivs[2].textContent.trim()) {
      const description = document.createElement('div');
      description.className = 'platform-description';
      description.innerHTML = contentDivs[2].innerHTML;
      platformHeader.appendChild(description);
    }

    // Create pros-cons container
    const prosConsContainer = document.createElement('div');
    prosConsContainer.className = 'pros-cons-container';

    // Benefits (4th div - pros)
    const benefitsDiv = document.createElement('div');
    benefitsDiv.className = 'benefits';
    processListContent(benefitsDiv, contentDivs[3], 'benefit');
    prosConsContainer.appendChild(benefitsDiv);

    // Disadvantages (5th div - cons)
    const disadvantagesDiv = document.createElement('div');
    disadvantagesDiv.className = 'disadvantages';
    processListContent(disadvantagesDiv, contentDivs[4], 'disadvantage');
    prosConsContainer.appendChild(disadvantagesDiv);

    // Assemble the new structure
    wrapper.appendChild(platformHeader);
    wrapper.appendChild(prosConsContainer);

    // Replace the original content
    tabpanel.innerHTML = '';
    tabpanel.appendChild(wrapper);
  }
}

export default async function decorate(block) {
  // Check if this is the pros-cons variant
  const isProsCons = block.classList.contains('pros-cons');

  // build tablist
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  // decorate tabs and tabpanels
  const tabs = [...block.children].map((child) => child.firstElementChild);
  tabs.forEach((tab, i) => {
    // Generate ID from text content, or use index if empty (for images)
    let idText = tab.textContent.trim();
    if (!idText) {
      // If no text (likely an image), use a fallback based on index or alt text
      const img = tab.querySelector('img');
      idText = img?.alt || `tab-${i}`;
    }
    const id = toClassName(idText);

    // decorate tabpanel
    const tabpanel = block.children[i];
    tabpanel.className = 'tabs-panel';
    tabpanel.id = `tabpanel-${id}`;
    tabpanel.setAttribute('aria-hidden', !!i);
    tabpanel.setAttribute('aria-labelledby', `tab-${id}`);
    tabpanel.setAttribute('role', 'tabpanel');

    // Enhanced processing for pros-cons tabs
    if (isProsCons) {
      processProConsContent(tabpanel);
    }

    // build tab button
    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = `tab-${id}`;
    button.innerHTML = tab.innerHTML;
    button.setAttribute('aria-controls', `tabpanel-${id}`);
    button.setAttribute('aria-selected', !i);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      // Fade out current active panel
      const currentPanel = block.querySelector('[role=tabpanel][aria-hidden="false"]');
      if (currentPanel && currentPanel !== tabpanel) {
        const currentWrapper = currentPanel.querySelector('.comparison-content-wrapper');
        if (currentWrapper) {
          currentWrapper.style.opacity = '0';
          setTimeout(() => {
            currentPanel.setAttribute('aria-hidden', true);
            currentWrapper.style.opacity = '1';
          }, 300);
        } else {
          currentPanel.setAttribute('aria-hidden', true);
        }
      }

      // Update button states
      tablist.querySelectorAll('button').forEach((btn) => {
        btn.setAttribute('aria-selected', false);
      });
      button.setAttribute('aria-selected', true);

      // Fade in new panel
      setTimeout(() => {
        tabpanel.setAttribute('aria-hidden', false);
        const newWrapper = tabpanel.querySelector('.comparison-content-wrapper');
        if (newWrapper) {
          newWrapper.style.opacity = '0';
          setTimeout(() => {
            newWrapper.style.opacity = '1';
          }, 50);
        }
      }, currentPanel && currentPanel !== tabpanel ? 300 : 0);
    });
    tablist.append(button);
    tab.remove();
  });

  block.prepend(tablist);
}
