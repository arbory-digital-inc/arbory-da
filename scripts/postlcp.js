// Local implementation of loadBlock to avoid dependency cycle
async function loadBlock(block) {
  const { classList } = block;
  const name = classList[0];
  block.dataset.blockName = name;
  const blockPath = `/blocks/${name}/${name}`;

  const loaded = [new Promise((resolve) => {
    (async () => {
      try {
        await (await import(`${blockPath}.js`)).default(block);
      } catch (e) {
        // Block loading failed, continue silently
      }
      resolve();
    })();
  })];

  if (!classList.contains('cmp')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${blockPath}.css`;
    document.head.appendChild(link);
  }

  await Promise.all(loaded);
  return block;
}

export default async function loadPostLCP() {
  const header = document.querySelector('header');
  if (header) await loadBlock(header);
  import('./utils/font.js');
}
