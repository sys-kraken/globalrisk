'use strict';
/*
 * Vercel serverless function — allow-listed upstream feed proxy.
 * Mirrors the /api/fetch route in server.js so the browser can read
 * RSS/JSON feeds that don't send CORS headers.
 */
const ALLOWED_HOSTS = new Set([
  'news.google.com',
  'earthquake.usgs.gov',
  'eonet.gsfc.nasa.gov',
  'www.gdacs.org',
  'www.nhc.noaa.gov',       // NOAA National Hurricane Center active storms
  'celestrak.org',          // satellite TLE orbital elements
  'translate.googleapis.com', // headline translation
]);

const OUTBOUND_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.8',
};

module.exports = async (req, res) => {
  const targetUrl = (req.query && req.query.url) || '';
  // soft=1: don't surface upstream error STATUS to the browser (avoids console
  // spam from flaky upstreams like GDACS getgeometry); client checks the body.
  const soft = req.query && req.query.soft === '1';
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    res.status(soft ? 200 : 400).send('bad url');
    return;
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    res.status(soft ? 200 : 403).send('host not allowed');
    return;
  }
  try {
    const upstream = await fetch(target.href, {
      headers: OUTBOUND_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/plain');
    res.setHeader('X-Upstream-Status', String(upstream.status));
    // Let Vercel's edge cache absorb repeat hits so the function rarely runs.
    res.setHeader('Cache-Control', 's-maxage=150, stale-while-revalidate=600');
    res.status(soft && !upstream.ok ? 200 : upstream.status).send(buf);
  } catch (err) {
    if (soft) { res.status(200).send(''); return; }
    res.status(502).send('upstream error: ' + err.message);
  }
};
