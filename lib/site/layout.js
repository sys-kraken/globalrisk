'use strict';
const ORIGIN = 'https://globalrisk.site';
const ADS = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1863473523633296"\n    crossorigin="anonymous"></script>';
const ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='42' fill='none' stroke='%2338e1ff' stroke-width='6'/><circle cx='50' cy='50' r='10' fill='%23ff4d5e'/></svg>";

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// JSON for <script type="application/ld+json">: escape '<' so content can't close the tag.
const ld = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';

/*
 * shell({ title, desc, path, body, index, jsonld[] })
 * `index:false` → noindex AND no AdSense script (low-value pages never carry ads).
 */
function shell({ title, desc, path, body, index = true, jsonld = [] }) {
  const url = ORIGIN + path;
  return '<!doctype html>\n<html lang="en">\n<head>\n' +
    '  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    '  <title>' + esc(title) + '</title>\n' +
    '  <meta name="description" content="' + esc(desc) + '" />\n' +
    '  <meta name="robots" content="' + (index ? 'index, follow, max-image-preview:large' : 'noindex, follow') + '" />\n' +
    '  <link rel="canonical" href="' + esc(url) + '" />\n' +
    '  <link rel="icon" href="' + ICON + '" />\n  <link rel="stylesheet" href="/styles.css" />\n' +
    '  <meta property="og:type" content="website" />\n  <meta property="og:site_name" content="GlobalRisk" />\n' +
    '  <meta property="og:title" content="' + esc(title) + '" />\n  <meta property="og:description" content="' + esc(desc) + '" />\n' +
    '  <meta property="og:url" content="' + esc(url) + '" />\n  <meta property="og:image" content="' + ORIGIN + '/og-image.svg" />\n' +
    '  <meta name="twitter:card" content="summary_large_image" />\n' +
    jsonld.map(ld).join('\n') + '\n' + (index ? '  ' + ADS + '\n' : '') +
    '</head>\n<body class="legal-page">\n' +
    '  <header class="legal-header">\n    <div class="brand legal-brand">\n      <div class="globe" aria-hidden="true"></div>\n      <div>\n        <h1>GLOBALRISK</h1>\n        <div class="sub">Global Situation Monitor</div>\n      </div>\n    </div>\n' +
    '    <nav class="legal-nav" aria-label="Site">\n      <a href="/">Live dashboard</a>\n      <a href="/countries">Countries</a>\n      <a href="/events">Events</a>\n      <a href="/guides">Guides</a>\n      <a href="/about">About</a>\n    </nav>\n  </header>\n' +
    '  <main class="legal-shell">\n' + body + '\n  </main>\n' +
    '  <footer class="legal-footer">\n    <a href="/">Live dashboard</a> · <a href="/countries">Countries</a> · <a href="/events">Events</a> · <a href="/guides">Guides</a> · <a href="/about">About</a> · <a href="/methodology">Methodology</a> ·\n    <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/contact">Contact</a>\n    <div>© 2026 GlobalRisk. Data from public sources; not an official emergency service.</div>\n  </footer>\n  <script defer src="/_vercel/speed-insights/script.js"></script>\n</body>\n</html>\n';
}

function breadcrumbs(items) {
  // items: [{name, path}] — last item is the current page (no link)
  const html = '<nav class="crumbs" aria-label="Breadcrumb">' + items.map((it, i) =>
    i < items.length - 1 ? '<a href="' + esc(it.path) + '">' + esc(it.name) + '</a>' : '<span>' + esc(it.name) + '</span>').join(' › ') + '</nav>';
  const json = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: ORIGIN + it.path })),
  };
  return { html, json };
}

module.exports = { ORIGIN, esc, ld, shell, breadcrumbs };
