export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // 12-column grid variants: e.g. columns (6-6), columns (4-4-4), columns (4-8)
  const gridVariant = [...block.classList].find((cls) => /^\d+(-\d+)+$/.test(cls));
  if (gridVariant) {
    const spans = gridVariant.split('-').map(Number);
    const template = spans.map((s) => `${s}fr`).join(' ');
    block.style.setProperty('--columns-grid-template', template);
    block.classList.add('columns-grid');
  }

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });
}
