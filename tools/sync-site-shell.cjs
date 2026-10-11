// Run after changing tools/site-footer.html. Root HTML and public profile are deployed pages.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = [...fs.readdirSync(root).filter(f => f.endsWith('.html')), 'u/index.html'];
const template = fs.readFileSync(path.join(__dirname, 'site-footer.html'), 'utf8').trim();
for (const file of pages) {
  const target = path.join(root, file);
  let html = fs.readFileSync(target, 'utf8');
  if (!/<body\b/i.test(html)) continue; // Domain-verification text is not a page.
  const base = file.includes('/') ? '../' : './';
  const footer = template.replaceAll('{{base}}', base);
  if (/<footer\b/i.test(html)) html = html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/i, footer);
  else html = html.replace(/<\/body>/i, footer + '\n</body>');
  if (!html.includes('site-shell.css')) html = html.replace(/<\/head>/i, '<link rel="stylesheet" href="' + base + 'site-shell.css?v=20261011-shell1">\n</head>');
  if (!html.includes('id="site-top"')) html = html.replace(/<body\b([^>]*)>/i, '<body$1 id="site-top">');
  html = html.replace(/<h5>\s*<header>[\s\S]*?<\/header>\s*<\/h5>/gi, '<h5 class="site-brand-wrap"><a class="site-brand" href="' + base + 'index.html"><img src="' + base + 'logos.png" width="88" height="88" alt=""><span>Sponsor Sorter</span></a></h5>');
  if (!/<header\b/i.test(html)) {
    const header = '<header class="header"><a class="brand" href="' + base + 'index.html"><img src="' + base + 'logos.png" width="88" height="88" alt=""><span>Sponsor Sorter</span></a><nav aria-label="Main navigation"><a href="' + base + 'index.html">Home</a><a href="' + base + 'finder.html">Finder</a><a href="' + base + 'signup.html">Signup</a><a href="' + base + 'login.html">Login</a></nav></header>';
    html = html.replace(/(<body\b[^>]*>)/i, '$1\n' + header);
  }
  if (!html.includes('connectionHeader.js')) html = html.replace(/<\/head>/i, '<script type="module" src="' + base + 'js/connectionHeader.js?v=20261011-grid4"></script>\n</head>');
  fs.writeFileSync(target, html);
}
