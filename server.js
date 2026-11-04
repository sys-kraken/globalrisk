/*
 * WORLDWATCH — static file server + allowlisted upstream proxy.
 * No dependencies. Node 18+ (uses global fetch).
 *
 *   node server.js            → http://localhost:4173
 *   PORT=8080 node server.js  → custom port
 *
 * The proxy exists so the browser can read RSS/JSON feeds that don't send
 * CORS headers. Only the hosts in ALLOWED_HOSTS can be reached through it.
 */
'use strict';

// Local dev only: load secrets (VAPID keys, INGEST_SECRET, Upstash creds) from
// .env.local so the monitor endpoints work under `node server.js`. On Vercel
// these come from the project's Environment Variables instead.
try { process.loadEnvFile('.env.local'); } catch { /* no env file — fine */ }

const http = require('http');
const fs = require('fs');
const path = require('path');

// Adapt a Vercel-style handler (req.query / req.body / res.status().json())
// to this hand-rolled http server so /api/* behaves identically in local dev.
function mountVercel(modPath, req, res, u) {
  req.query = Object.fromEntries(u.searchParams.entries());
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
  res.send = (b) => res.end(b);
  const run = () => {
    let handler;
    try { handler = require(modPath); } catch (e) { res.statusCode = 500; return res.end('load error: ' + e.message); }
    Promise.resolve(handler(req, res)).catch((e) => { if (!res.writableEnded) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); } });
  };
  if (req.method === 'POST' || req.method === 'DELETE' || req.method === 'PUT') {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { req.body = data ? JSON.parse(data) : {}; } catch { req.body = {}; } run(); });
  } else { run(); }
}

const PORT = Number(process.env.PORT) || 4173;
// Static files live at the project root (Vercel-friendly layout). This local
// dev server serves them and also implements /api/fetch + /api/live so the
// app behaves identically to the deployed Vercel functions.
 const PUBLIC_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

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

// Small in-memory cache so refreshes and multiple panels don't hammer upstreams.
const CACHE_TTL_MS = 150 * 1000;
const cache = new Map(); // href -> { at, status, type, body }

// soft=true: never surface an error STATUS to the browser (so a flaky upstream
// like GDACS's crashing getgeometry doesn't spam the console); the client
// detects failure from the (non-JSON) body instead.
async function handleProxy(res, targetUrl, soft) {
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    res.writeHead(soft ? 200 : 400, { 'Content-Type': 'text/plain' });
    return res.end('bad url');
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    res.writeHead(soft ? 200 : 403, { 'Content-Type': 'text/plain' });
    return res.end('host not allowed');
  }

  const hit = cache.get(target.href);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    res.writeHead(hit.status, { 'Content-Type': hit.type, 'X-Cache': 'HIT' });
    return res.end(hit.body);
  }

  try {
    const upstream = await fetch(target.href, {
      headers: OUTBOUND_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get('content-type') || 'text/plain';
    if (upstream.ok) {
      cache.set(target.href, { at: Date.now(), status: upstream.status, type, body });
    }
    const status = soft && !upstream.ok ? 200 : upstream.status;
    res.writeHead(status, { 'Content-Type': type, 'X-Cache': 'MISS', 'X-Upstream-Status': String(upstream.status) });
    res.end(body);
  } catch (err) {
    if (soft) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(''); }
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('upstream error: ' + err.message);
  }
}

// handle (lowercased) -> YouTube channel id, for the Data API path.
const CHANNEL_IDS = {
  '@aljazeeraenglish': 'UCfiwzLy-8yKzIbsmZTzxDgw', '@dwnews': 'UCbbS1GE942k3UVqpLklyhIA',
  '@skynews': 'UCkFclpi8U9VJjfxLYoms7Aw', '@abcnews': 'UCBi2mrWuNuyYy4gbM6fU18Q',
  '@channelnewsasia': 'UC83jt4dlz1Gjl58fzQrrKZg', '@euronews': 'UCSrZ3UV4jOidv8ppoVuvW9Q',
  '@trtworld': 'UCnyCrv8b7bu0oWFXGyHaPzg', '@markets': 'UCIALMKvObZNtJ6AmdCLP7Lg',
  '@livenowfox': 'UCDiPds0v60wueil5B8w3fPQ', '@gmanews': 'UCqYw-CTd1dU2yGI71sEyqNw',
  '@abscbnnews': 'UCE2606prvXQc_noEqKxVJXA', '@news5everywhere': 'UCGEbMwiX774cseKvJqF9R2g',
};

// Resolve a channel's *current* live video id.
//  - YouTube Data API v3 when YOUTUBE_API_KEY is set (reliable from any IP).
//  - Otherwise scrape the /live page (works from residential IPs / local dev).
async function handleLive(res, handle, scrapeOnly) {
  const sendJson = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };
  if (!/^@[\w.\-]{2,40}$/.test(handle || '')) return sendJson(400, { error: 'bad handle' });

  const ck = 'live:' + handle + (scrapeOnly ? ':s' : '');
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < 120000) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'HIT' });
    return res.end(hit.body);
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  const cid = CHANNEL_IDS[handle.toLowerCase()];
  try {
    if (apiKey && cid && !scrapeOnly) {
      try {
        const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&type=video&eventType=live&maxResults=1&channelId=${cid}&key=${apiKey}`, { signal: AbortSignal.timeout(15000) });
        const j = await r.json();
        const vid = j && j.items && j.items[0] && j.items[0].id && j.items[0].id.videoId;
        if (vid) {
          const body = JSON.stringify({ videoId: vid, live: true, src: 'api' });
          cache.set(ck, { at: Date.now(), body });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MISS' });
          return res.end(body);
        }
      } catch (e) { /* fall back to scrape */ }
    }
    const upstream = await fetch(`https://www.youtube.com/${handle}/live?hl=en&gl=US`, {
      headers: { ...OUTBOUND_HEADERS, Cookie: 'SOCS=CAISNQgDEitib21fdWlfMjAyNTAxMjcuMDNfcDAaAmVuIAEaBgiAwOLABg; CONSENT=YES+; PREF=hl=en&gl=US' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    const html = await upstream.text();
    const m = html.match(/"videoDetails":\{[^}]*?"videoId":"([\w-]{11})"/) || html.match(/"videoId":"([\w-]{11})"/);
    const videoId = m ? m[1] : null;
    const live = /hlsManifestUrl|"isLiveNow":true|BADGE_STYLE_TYPE_LIVE_NOW/.test(html);
    const body = JSON.stringify({ videoId, live });
    if (videoId) cache.set(ck, { at: Date.now(), body });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MISS' });
    res.end(body);
  } catch (err) {
    sendJson(502, { error: err.message });
  }
}

function handleStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/') rel = '/index.html';
  else if (!path.extname(rel)) rel += '.html'; // clean URLs, mirrors vercel.json routes
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/api/fetch') {
      return handleProxy(res, u.searchParams.get('url') || '', u.searchParams.get('soft') === '1');
    }
    if (u.pathname === '/api/live') {
      return handleLive(res, u.searchParams.get('h') || '', u.searchParams.get('t') === '1');
    }
    if (u.pathname === '/api/ingest') return mountVercel('./api/ingest', req, res, u);
    if (u.pathname === '/api/events') return mountVercel('./api/events', req, res, u);
    if (u.pathname === '/api/subscribe') return mountVercel('./api/subscribe', req, res, u);
    if (u.pathname === '/api/firms') return mountVercel('./api/firms', req, res, u);
    if (u.pathname === '/api/flights') return mountVercel('./api/flights', req, res, u);
    if (u.pathname === '/sitemap.xml') return mountVercel('./api/pages', req, res, new URL('/?t=sitemap', 'http://localhost'));
    {
      const p = u.pathname; let m;
      const to = (qs) => mountVercel('./api/pages', req, res, new URL('/?' + qs, 'http://localhost'));
      if (p === '/api/briefing') return to('t=briefing');
      if (p === '/countries') return to('t=countries');
      if (p === '/events') return to('t=events');
      if (p === '/guides') return to('t=guides');
      if (p === '/el-nino') return to('t=enso');
      if (p === '/api/enso') return to('t=ensodata');
      if ((m = /^\/country\/([^/]+)$/.exec(p))) return to('t=country&slug=' + m[1]);
      if ((m = /^\/event\/([^/]+)(?:\/[^/]*)?$/.exec(p))) return to('t=event&id=' + m[1]);
      if ((m = /^\/guides\/([^/]+)$/.exec(p))) return to('t=guide&slug=' + m[1]);
    }
    if (u.pathname === '/api/webcams') return mountVercel('./api/webcams', req, res, u);
    handleStatic(res, u.pathname);
  })
  .listen(PORT, () => {
    console.log(`WORLDWATCH monitoring station on http://localhost:${PORT}`);
  });
