'use strict';
/*
 * Server-rendered content pages (one function for all of them, to stay well
 * under Vercel's per-deployment function limit). vercel.json rewrites:
 *
 *   /countries            → ?t=countries      /country/:slug        → ?t=country&slug=
 *   /events               → ?t=events         /event/:id[/:slug]    → ?t=event&id=
 *   /guides               → ?t=guides         /guides/:slug         → ?t=guide&slug=
 *   /sitemap.xml          → ?t=sitemap
 *
 * Responses are cached at Vercel's edge (s-maxage) so crawlers and visitors
 * rarely cause a re-render.
 */
const R = require('../lib/site/render');

module.exports = async (req, res) => {
  const q = req.query || {};
  let out;
  try {
    switch (q.t) {
      case 'country': out = await R.countryPage(String(q.slug || '').toLowerCase()); break;
      case 'event': out = await R.eventPage(String(q.id || '')); break;
      case 'countries': out = await R.countriesHub(); break;
      case 'events': out = await R.eventsHub(); break;
      case 'guides': out = R.guidesHub(); break;
      case 'guide': out = R.guidePage(String(q.slug || '').toLowerCase()); break;
      case 'sitemap': out = await R.sitemap(); break;
      case 'briefing': out = { status: 200, cache: 'public, s-maxage=600, stale-while-revalidate=3600', html: await R.briefing() }; break;
      default: out = R.notFound();
    }
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Temporary error rendering this page. Please try again shortly.');
  }
  res.statusCode = out.status;
  res.setHeader('Content-Type', out.type || 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', out.cache || 'public, s-maxage=300');
  res.end(out.html);
};
