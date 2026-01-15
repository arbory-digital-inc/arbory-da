/**
 * decorate the block
 * @param {Element} block the block
 */
export default async function decorate(block) {
  const links = block.querySelectorAll('a');
  
  if (links.length === 0) return;

  const linkList = document.createElement('ul');
  linkList.className = 'link-list';

  links.forEach((link) => {
    const listItem = document.createElement('li');
    listItem.className = 'link-item';

    const linkWrapper = document.createElement('div');
    linkWrapper.className = 'link-content';

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'link-icon';
    iconWrapper.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

    const textWrapper = document.createElement('div');
    textWrapper.className = 'link-text';
    textWrapper.textContent = link.textContent;

    const arrowIcon = document.createElement('div');
    arrowIcon.className = 'link-arrow';
    arrowIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

    link.className = 'link-wrapper';
    link.innerHTML = '';
    linkWrapper.append(iconWrapper, textWrapper);
    link.append(linkWrapper, arrowIcon);
    listItem.append(link);
    linkList.append(listItem);
  });

  block.replaceChildren(linkList);
}
