'use strict';
/*
 * NASA FIRMS active-fire hotspots (VIIRS/MODIS) → compact JSON.
 *
 *   GET /api/firms[?limit=1500]
 *
 * With FIRMS_MAP_KEY set (a free MAP_KEY from
 * https://firms.modaps.eosdis.nasa.gov/api/) it queries the area API; the key
 * stays server-side. Without one it reads FIRMS's public, keyless "last 24h"
 * global CSV files instead, so the layer works out of the box.
 *
 * A single global ("world") VIIRS query is ~6 MB and FIRMS 502s on it, so we
 * fetch the world as a grid of bounding-box tiles in parallel and merge them —
 * each tile is small enough to succeed, and partial failures are tolerated.
 * Result is cached 10 min (FIRMS updates a few times/day; each tile is one of
 * the key's 5000 transactions / 10 min).
 */
const KEY = process.env.FIRMS_MAP_KEY || '';
const SOURCE = process.env.FIRMS_SOURCE || 'VIIRS_SNPP_NRT';

// Optional shared cache (Upstash) so the slow global fetch runs at most once per
// TTL across all serverless instances, not once per cold start.
let store = null;
try { store = require('../lib/store'); } catch { /* fires still work with in-memory cache */ }

let cache = { at: 0, body: null };     // L1: per-instance memory
const TTL = 15 * 60 * 1000;
const SHARED_KEY = 'wm:firms';
const KEEP = 2000;   // strongest fires retained (keeps the cached blob small)

function confLabel(c) {
  const s = String(c || '').trim().toLowerCase();
  if (s === 'l') return 'low';
  if (s === 'n') return 'nominal';
  if (s === 'h') return 'high';
  return c ? String(c) : '';
}
function firmsTime(date, time) {
  if (!date) return Date.now();
  const t = String(time || '0').padStart(4, '0');
  const ms = Date.parse(date + 'T' + t.slice(0, 2) + ':' + t.slice(2, 4) + ':00Z');
  return isNaN(ms) ? Date.now() : ms;
}
// Parse one FIRMS CSV response → array of fire objects (no capping here).
function parseRows(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',').map((s) => s.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  const iLat = col('latitude'), iLon = col('longitude'), iFrp = col('frp'),
    iConf = col('confidence'), iSat = col('satellite'),
    iDate = col('acq_date'), iTime = col('acq_time'), iDN = col('daynight');
  if (iLat < 0 || iLon < 0) return [];
  const out = [];
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].split(',');
    const lat = +c[iLat], lon = +c[iLon];
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const frp = iFrp >= 0 ? +c[iFrp] : 0;
    out.push({
      lat, lon,
      frp: isFinite(frp) ? Math.round(frp * 10) / 10 : 0,
      conf: iConf >= 0 ? confLabel(c[iConf]) : '',
      sat: iSat >= 0 ? c[iSat] : '',
      dn: iDN >= 0 ? (c[iDN] === 'D' ? 'day' : c[iDN] === 'N' ? 'night' : '') : '',
      ts: firmsTime(iDate >= 0 ? c[iDate] : '', iTime >= 0 ? c[iTime] : ''),
    });
  }
  return out;
}
// World as a 6-lon × 3-lat grid of 60°×60° boxes "west,south,east,north".
// Smaller than quadrants so fire-dense regions (boreal, tropics) don't 502.
function worldTiles() {
  const lons = [-180, -120, -60, 0, 60, 120, 180], lats = [-90, -30, 30, 90], boxes = [];
  for (let i = 0; i < lons.length - 1; i++)
    for (let j = 0; j < lats.length - 1; j++)
      boxes.push(`${lons[i]},${lats[j]},${lons[i + 1]},${lats[j + 1]}`);
  return boxes;
}
async function fetchTile(area) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${SOURCE}/${area}/1`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6500) });   // tight, so all tiles fit the function budget
  const text = await r.text();
  // A key/quota problem returns a short non-CSV message — treat that as fatal;
  // an empty ocean tile (few/no rows) is fine and parses to [].
  if (text.indexOf(',') < 0 && /invalid|error|exceed|denied|not\s*found/i.test(text)) {
    throw new Error(text.slice(0, 80).replace(/\s+/g, ' ').trim());
  }
  return parseRows(text);
}

// Keyless: FIRMS's open 24-hour global files. MODIS goes first: it is ~1 MB
// against VIIRS's ~5 MB, and since only the KEEP strongest fires are kept,
// the extra small VIIRS detections would be dropped anyway. A satellite that
// had a bad day publishes a header-only file, so fall through to the next.
const PUBLIC_FILES = [
  ['MODIS_NRT', 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv'],
  ['VIIRS_NOAA20_NRT', 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv'],
  ['VIIRS_SNPP_NRT', 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv'],
];
async function fetchPublic() {
  let lastErr = null;
  for (const [source, url] of PUBLIC_FILES) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('FIRMS ' + r.status);
      const rows = parseRows(await r.text());
      if (rows.length) return { source, rows };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('no public fire data');
}

async function readShared() {
  if (!store || !store.configured()) return null;
  try { const v = await store.cmd(['GET', SHARED_KEY]); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function writeShared(body) {
  if (!store || !store.configured()) return;
  store.cmd(['SET', SHARED_KEY, JSON.stringify(body), 'EX', Math.round(TTL / 1000)]).catch(() => {});
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const limit = Math.min(Math.max(parseInt(req.query && req.query.limit, 10) || 1500, 100), KEEP);
  const reply = (body, extra) => {
    const sliced = body.fires.slice(0, limit);
    res.status(200).json({ ...body, ...extra, count: sliced.length, fires: sliced });
  };

  // L1: this instance's memory
  if (cache.body && Date.now() - cache.at < TTL) return reply(cache.body, { cached: 'mem' });
  // L2: shared Upstash cache (fast; avoids the slow global fetch on cold starts)
  const shared = await readShared();
  if (shared && shared.fires) { cache = { at: Date.now(), body: shared }; return reply(shared, { cached: 'shared' }); }

  if (!KEY) {
    try {
      const { source, rows } = await fetchPublic();
      rows.sort((a, b) => b.frp - a.frp);
      const body = { configured: true, source, total: rows.length, fires: rows.slice(0, KEEP) };
      cache = { at: Date.now(), body };
      writeShared(body);
      return reply(body);
    } catch (e) {
      return res.status(502).json({ configured: true, error: e.message, fires: [] });
    }
  }

  try {
    const tiles = worldTiles();
    const settled = await Promise.allSettled(tiles.map(fetchTile));
    const okTiles = settled.filter((s) => s.status === 'fulfilled');
    if (!okTiles.length) {
      const err = settled.find((s) => s.status === 'rejected');
      return res.status(502).json({ configured: true, error: (err && err.reason && err.reason.message) || 'FIRMS unavailable', fires: [] });
    }
    const all = [];
    for (const t of okTiles) all.push(...t.value);
    const total = all.length;
    all.sort((a, b) => b.frp - a.frp);            // keep the most intense fires
    const body = { configured: true, source: SOURCE, total, tiles: okTiles.length + '/' + tiles.length, fires: all.slice(0, KEEP) };
    cache = { at: Date.now(), body };
    writeShared(body);
    return reply(body);
  } catch (e) {
    return res.status(502).json({ configured: true, error: e.message, fires: [] });
  }
};
