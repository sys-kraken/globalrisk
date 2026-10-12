'use strict';
/*
 * Event data access for the server-rendered pages. Prefers the Redis history
 * (30 days, so country pages have real depth) and falls back to polling the
 * live feeds when storage isn't configured. Results are cached in memory so a
 * warm function instance doesn't re-read Redis for every page.
 */
const store = require('../store');
const { fetchAllEvents } = require('../feeds');
const world = require('./world');

const TTL_MS = 10 * 60 * 1000;
const WINDOW_MS = 30 * 24 * 3600e3;
const MAX_EVENTS = 6000;

let cache = { at: 0, events: null, source: 'none' };

function annotate(e) {
  if (e.cs !== undefined) return e;
  const c = world.countryForPoint(e.lon, e.lat) || world.countryFromText(e.place || e.country || '');
  e.cs = c ? c.slug : '';
  return e;
}

async function fromStore(sinceMs) {
  const ids = await store.cmd(['ZRANGE', 'wm:ev:z', '+inf', sinceMs, 'BYSCORE', 'REV', 'LIMIT', 0, MAX_EVENTS]);
  if (!ids || !ids.length) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 1000) chunks.push(['HMGET', 'wm:ev:h', ...ids.slice(i, i + 1000)]);
  const res = await store.pipeline(chunks);
  const out = [];
  for (const arr of res) for (const b of arr || []) {
    if (!b) continue;
    try { out.push(JSON.parse(b)); } catch { /* skip corrupt */ }
  }
  return out;
}

async function loadEvents() {
  const now = Date.now();
  if (cache.events && now - cache.at < TTL_MS) return cache.events;
  let events = [], source = 'live';
  if (store.configured()) {
    try { events = await fromStore(now - WINDOW_MS); source = 'store'; } catch { events = []; }
  }
  if (!events.length) {
    try { events = (await fetchAllEvents()).events; source = 'live'; } catch { events = []; }
  }
  if (!events.length && cache.events) return cache.events; // upstream hiccup: serve stale
  const seen = new Set();
  const list = [];
  for (const e of events) {
    if (!e || !e.id || seen.has(e.id) || !isFinite(e.lat) || !isFinite(e.lon)) continue;
    seen.add(e.id);
    list.push(annotate(e));
  }
  list.sort((a, b) => b.time - a.time);
  cache = { at: now, events: list, source };
  return list;
}

async function getEvent(id) {
  const list = await loadEvents();
  const hit = list.find((e) => e.id === id);
  if (hit) return hit;
  if (store.configured()) {
    try {
      const v = await store.cmd(['HGET', 'wm:ev:h', id]);
      if (v) return annotate(JSON.parse(v));
    } catch { /* fall through */ }
  }
  return null;
}

// Worth its own indexable page (sitemap + ads)? Kept deliberately strict: a new
// domain with hundreds of near-identical generated pages gets crawled slowly and
// reads as low-value to Google/AdSense. Pages below the bar still render for
// visitors, just with noindex.
const SIG_MAG = 5.5;
const SIG_KINDS = /storm|cyclone|hurricane|typhoon|volcano/i;   // EONET kinds with a clear, named event
function significant(e) {
  if (e.layer === 'quakes') return (e.mag || 0) >= SIG_MAG;
  if (e.layer === 'alerts') return true;                          // GDACS Orange/Red only are stored
  return SIG_KINDS.test(e.kind || '');                            // skip bulk wildfire/ice/dust items
}

// A country page needs a few events before it has enough to say.
const COUNTRY_MIN_EVENTS = 3;
const countryIndexable = (n) => n >= COUNTRY_MIN_EVENTS;

module.exports = { loadEvents, getEvent, significant, countryIndexable, SIG_MAG, source: () => cache.source };
