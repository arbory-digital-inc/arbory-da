/**
 * Decorates the liveblog-meta block
 * manifested with light and shadow energy by ur boy frank
 */

export default function decorate(block) {
  // Ensure not processing an already decorated block
  if (block.querySelector('.left-column')) {
    return;
  }

  const rows = [...block.children];

  // Clear the block's content
  block.textContent = '';

  // Create semantic containers for each metadata type
  const titleContent = rows[0]?.children[1]?.textContent || '';
  const authorContent = rows[1]?.children[1]?.textContent || '';
  const dateContent = rows[2]?.children[1]?.textContent?.trim() || '';
  const tagsContent = rows[3]?.children[1]?.textContent || '';

  // Format the date
  const formatDate = (dateStr) => {
    try {
      const [month, day, year] = dateStr.split('-').map((num) => parseInt(num.trim(), 10));
      if (!month || !day || !year
        || Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) {
        // console.warn('Invalid date format:', dateStr);
        return dateStr;
      }
      const date = new Date(2000 + year, month - 1, day);
      if (Number.isNaN(date.getTime())) {
        // console.warn('Invalid date:', dateStr);
        return dateStr;
      }
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      // console.warn('Error formatting date:', error);
      return dateStr;
    }
  };

  // Create left column
  const leftColumn = document.createElement('div');
  leftColumn.className = 'left-column';

  // Create title section
  const titleSection = document.createElement('div');
  titleSection.className = 'title';
  titleSection.innerHTML = `<h3>${titleContent}</h3>`;

  // Create author section
  const authorSection = document.createElement('div');
  authorSection.className = 'author';
  authorSection.innerHTML = `<h4>${authorContent}</h4>`;

  leftColumn.append(titleSection, authorSection);

  // Create right column
  const rightColumn = document.createElement('div');
  rightColumn.className = 'right-column';

  // Create date section
  const dateSection = document.createElement('div');
  dateSection.className = 'date';
  const formattedDate = formatDate(dateContent);
  dateSection.innerHTML = `<h5>${formattedDate}</h5>`;

  // Create tags section
  const tagsSection = document.createElement('div');
  tagsSection.className = 'tags';
  const tagsList = tagsContent.split(',').map((tag) => `<span class="tag">${tag.trim()}</span>`);
  tagsSection.innerHTML = tagsList.join('');

  rightColumn.append(dateSection, tagsSection);

  // Add columns to the block
  block.append(leftColumn, rightColumn);
}
