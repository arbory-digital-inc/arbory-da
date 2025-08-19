export default async function decorate(block) {
  const fragmentName = block.textContent.trim();
  if (!fragmentName.startsWith('author-fragment-')) {
    console.warn(`Author block: Invalid fragment name "${fragmentName}"`);
    return;
  }

  // Build the absolute path to /authors/<fragmentName>
  // NEED TO UPDATE WHEN LIVE: CHANGE PATH TO CORRECT ONE
  // NEED TO UPDATE WHEN LIVE: CHANGE PATH TO CORRECT ONE
  // NEED TO UPDATE WHEN LIVE: CHANGE PATH TO CORRECT ONE
  // eg. /en/authors/${fragmentName}
  const fragmentPath = `/0-sandbox/noah/authors/${fragmentName}`;

  try {
    // Fetch published HTML of the fragment
    const resp = await fetch(fragmentPath);
    if (!resp.ok) {
      console.error(`Failed to fetch fragment at ${fragmentPath}`);
      return;
    }

    const html = await resp.text();
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const mainContent = temp.querySelector('main') || temp;
    block.innerHTML = mainContent.innerHTML;
  } catch (err) {
    console.error('Error loading author fragment:', err);
  }
}