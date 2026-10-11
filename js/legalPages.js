// Reading tools only: policy wording, dates and account actions remain unchanged.
const content = document.querySelector('main .pp-container, main .tos-container, main.tos-container');
if (content) {
  document.body.classList.add('legal-page');
  content.classList.add('legal-content');
  const title = content.querySelector('h1');
  const headings = [...content.querySelectorAll(':scope > h2')];
  const navigation = document.createElement('details');
  navigation.className = 'legal-navigation';
  navigation.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'On this page';
  const searchLabel = document.createElement('label');
  searchLabel.textContent = 'Find a section';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Try payments, privacy or accounts';
  searchLabel.append(search);
  const links = document.createElement('nav');
  links.setAttribute('aria-label', 'Policy sections');
  const status = document.createElement('p');
  status.className = 'legal-search-status';
  status.setAttribute('role', 'status');
  for (const [index, heading] of headings.entries()) {
    if (!heading.id) heading.id = 'policy-section-' + (index + 1);
    const link = document.createElement('a');
    link.href = '#' + heading.id;
    link.textContent = heading.textContent;
    links.append(link);
    const section = document.createElement('section');
    section.className = 'legal-section';
    section.setAttribute('aria-labelledby', heading.id);
    heading.before(section);
    section.append(heading);
    while (section.nextSibling && !(section.nextSibling.nodeType === 1 && section.nextSibling.tagName === 'H2')) section.append(section.nextSibling);
  }
  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const link of links.children) {
      link.hidden = !link.textContent.toLocaleLowerCase().includes(query);
      if (!link.hidden) count++;
    }
    status.textContent = query ? count + ' matching section' + (count === 1 ? '' : 's') : '';
  });
  navigation.append(summary, searchLabel, links, status);
  content.querySelector('.toc')?.remove();
  const toolbar = document.createElement('div');
  toolbar.className = 'legal-tools';
  const print = document.createElement('button');
  print.type = 'button';
  print.textContent = 'Print / save as PDF';
  print.addEventListener('click', () => window.print());
  toolbar.append(print);
  const root = new URL('../', import.meta.url);
  for (const [label, page] of [['Privacy policy', 'privacy.html'], ['Terms of service', 'terms.html'], ['Get help', 'help.html'], ['Contact us', 'contact.html']]) {
    const link = document.createElement('a');
    link.href = new URL(page, root).href;
    link.textContent = label;
    toolbar.append(link);
  }
  if (headings.length) content.querySelector('.legal-section').before(toolbar, navigation);
  if (title) title.tabIndex = -1;
}
