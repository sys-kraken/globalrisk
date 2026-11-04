'use strict';
/*
 * /el-nino — live ENSO tracker. Readings come straight from NOAA's public
 * text files and are rendered on the server; the interactive map itself is
 * client side (el-nino.js) and draws NASA GIBS imagery.
 *
 * A source that fails keeps its last good value, or shows "unavailable"; one
 * flaky upstream never takes the page down.
 */
const { esc, shell, breadcrumbs } = require('./layout');

const CPC = 'https://www.cpc.ncep.noaa.gov';
const SOURCES = {
  weekly: CPC + '/data/indices/wksst9120.for',
  roni: CPC + '/data/indices/RONI.ascii.txt',
  oni: CPC + '/data/indices/oni.ascii.txt',
  advisory: CPC + '/products/analysis_monitoring/enso_advisory/ensodisc.shtml',
};
const TTL_MS = 60 * 60 * 1000;
const WEEKS_KEPT = 53;

// Boxes the map outlines and the table lists. Longitudes run east past 180 so
// the Niño 4 box stays one rectangle across the date line.
const REGIONS = [
  { id: 'nino12', name: 'Niño 1+2', w: 270, e: 280, n: 0, s: -10, box: '0–10°S, 90–80°W', note: 'Off Peru and Ecuador' },
  { id: 'nino3', name: 'Niño 3', w: 210, e: 270, n: 5, s: -5, box: '5°N–5°S, 150–90°W', note: 'Eastern equatorial Pacific' },
  { id: 'nino34', name: 'Niño 3.4', w: 190, e: 240, n: 5, s: -5, box: '5°N–5°S, 170–120°W', note: 'The benchmark box' },
  { id: 'nino4', name: 'Niño 4', w: 160, e: 210, n: 5, s: -5, box: '5°N–5°S, 160°E–150°W', note: 'Central Pacific, by the warm pool' },
];

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

/* ---- parsers (pure, one per NOAA file format) --------------------------- */

// " 28OCT2026     26.7 5.4     29.5 4.4     30.2 3.4     30.1 1.4"
// Columns can touch ("20.6-0.1"), so pull the numbers out rather than split.
function parseWeekly(text) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    const m = /^\s*(\d{2})([A-Z]{3})(\d{4})\s+(.*)$/.exec(line);
    if (!m || !(m[2] in MONTHS)) continue;
    const n = (m[4].match(/-?\d+\.\d/g) || []).map(Number);
    if (n.length !== 8) continue;
    const date = new Date(Date.UTC(+m[3], MONTHS[m[2]], +m[1])).toISOString().slice(0, 10);
    rows.push({
      date,
      nino12: { sst: n[0], anom: n[1] }, nino3: { sst: n[2], anom: n[3] },
      nino34: { sst: n[4], anom: n[5] }, nino4: { sst: n[6], anom: n[7] },
    });
  }
  return rows.length ? rows.slice(-WEEKS_KEPT) : null;
}

// Both files end in "<season> <year> ... <anomaly>"; ONI adds a total column.
function parseSeasonal(text) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    const m = /^\s*([A-Z]{3})\s+(\d{4})(?:\s+-?\d+\.\d+)?\s+(-?\d+\.\d+)\s*$/.exec(line);
    if (!m) continue;
    const value = Number(m[3]);
    if (value > -90) rows.push({ season: m[1], year: +m[2], value });
  }
  return rows.length ? rows[rows.length - 1] : null;
}

const decode = (s) => String(s)
  .replace(/&ntilde;/g, 'ñ').replace(/&deg;/g, '°').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
  .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function parseAdvisory(html) {
  const status = /Alert System Status:[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i.exec(html);
  if (!status) return null;
  const synopsis = /Synopsis:[\s\S]*?<strong>([\s\S]*?)<\/strong>/i.exec(html);
  const issued = /issued by[\s\S]*?(\d{1,2} [A-Z][a-z]+ \d{4})/.exec(html);
  const next = /next ENSO Diagnostics Discussion is scheduled for (\d{1,2} [A-Z][a-z]+ \d{4})/.exec(html);
  return {
    status: decode(status[1]),
    synopsis: synopsis ? decode(synopsis[1]) : '',
    issued: issued ? issued[1] : '',
    next: next ? next[1] : '',
  };
}

/* ---- loading ------------------------------------------------------------ */

const PARSERS = { weekly: parseWeekly, roni: parseSeasonal, oni: parseSeasonal, advisory: parseAdvisory };
const cached = {}; // source -> { at, value }

async function loadSource(key) {
  const hit = cached[key];
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const r = await fetch(SOURCES[key], { headers: { 'User-Agent': 'GlobalRisk/1.0 (+https://globalrisk.site/about)' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const value = PARSERS[key](await r.text());
    if (!value) throw new Error('unrecognised format');
    cached[key] = { at: Date.now(), value };
    return value;
  } catch (e) {
    console.warn('enso source ' + key + ' failed:', e.message);
    return hit ? hit.value : null; // stale beats nothing
  }
}

async function loadEnso() {
  const keys = Object.keys(SOURCES);
  const values = await Promise.all(keys.map(loadSource));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

/* ---- derived values ----------------------------------------------------- */

// NOAA's strength bands, applied to RONI (its official ENSO index since 2026).
const BANDS = [
  { id: 'nina', label: 'La Niña', from: -2, to: -0.5 },
  { id: 'neutral', label: 'Neutral', from: -0.5, to: 0.5 },
  { id: 'weak', label: 'Weak', from: 0.5, to: 1 },
  { id: 'moderate', label: 'Moderate', short: 'Mod.', from: 1, to: 1.5 },
  { id: 'strong', label: 'Strong', from: 1.5, to: 2 },
  { id: 'vstrong', label: 'Very strong', from: 2, to: 3 },
];
const GAUGE_MIN = BANDS[0].from;
const GAUGE_MAX = BANDS[BANDS.length - 1].to;

function bandFor(v) {
  // Bands are exclusive at the top; anything past the ends stays in the end band.
  return BANDS.find((b) => v < b.to) || BANDS[BANDS.length - 1];
}

const signed = (v, digits = 1) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(digits);
const degC = (v) => signed(v) + '°C';
const seasonLabel = (s) => s.season + ' ' + s.year;
function fmtDate(iso) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/* ---- page sections ------------------------------------------------------ */

function card(label, value, lines) {
  return '<div class="enso-stat"><div class="enso-stat-label">' + esc(label) + '</div>' +
    '<div class="enso-stat-value">' + esc(value) + '</div>' +
    lines.filter(Boolean).map((l) => '<div class="enso-stat-note">' + esc(l) + '</div>').join('') + '</div>';
}

function readings(d) {
  const w = d.weekly;
  const latest = w && w[w.length - 1];
  const prior = w && w[w.length - 5];
  return '<div class="enso-stats">' +
    (latest
      ? card('Niño 3.4, weekly', degC(latest.nino34.anom), [
        'Week of ' + fmtDate(latest.date),
        prior ? signed(latest.nino34.anom - prior.nino34.anom) + '°C over 4 weeks' : '',
      ])
      : card('Niño 3.4, weekly', 'Unavailable', ['NOAA CPC did not respond'])) +
    (d.roni
      ? card('RONI, relative', degC(d.roni.value), [seasonLabel(d.roni), 'NOAA’s official index'])
      : card('RONI, relative', 'Unavailable', ['NOAA CPC did not respond'])) +
    (d.oni
      ? card('ONI, 3-month', degC(d.oni.value), [seasonLabel(d.oni), 'Not adjusted for tropics-wide warming'])
      : card('ONI, 3-month', 'Unavailable', ['NOAA CPC did not respond'])) +
    '</div>';
}

function gauge(d) {
  if (!d.roni) return '';
  const v = d.roni.value;
  const span = GAUGE_MAX - GAUGE_MIN;
  const pct = (Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, v)) - GAUGE_MIN) / span * 100;
  const band = bandFor(v);
  const segs = BANDS.map((b) => '<div class="enso-seg enso-seg-' + b.id + '" style="flex:' + (b.to - b.from) + '"><span class="enso-seg-long">' + esc(b.label) + '</span><span class="enso-seg-short">' + esc(b.short || b.label) + '</span></div>').join('');
  return '<h3>Event strength</h3>' +
    '<p>RONI stands at <strong>' + esc(signed(v, 2)) + '°C</strong> for ' + esc(seasonLabel(d.roni)) + ', in NOAA’s <strong>' + esc(band.label.toLowerCase()) + '</strong> band.</p>' +
    '<div class="enso-gauge" role="img" aria-label="RONI ' + esc(degC(v)) + ', ' + esc(band.label) + '">' +
    '<div class="enso-gauge-marker" style="left:' + pct.toFixed(1) + '%"></div>' +
    '<div class="enso-gauge-bar">' + segs + '</div></div>';
}

function regionTable(d) {
  const w = d.weekly;
  if (!w) return '';
  const latest = w[w.length - 1];
  const prior = w[w.length - 5];
  const rows = REGIONS.map((r) => {
    const c = latest[r.id];
    const change = prior ? signed(c.anom - prior[r.id].anom) + '°C' : '—';
    return '<tr><th scope="row">' + esc(r.name) + '<span>' + esc(r.note) + '</span></th><td>' + esc(r.box) + '</td><td>' + c.sst.toFixed(1) + '°C</td><td><strong>' + esc(degC(c.anom)) + '</strong></td><td>' + esc(change) + '</td></tr>';
  }).join('');
  return '<h3>The four Niño regions</h3>' +
    '<div class="enso-table-wrap"><table class="enso-table"><thead><tr><th scope="col">Region</th><th scope="col">Box</th><th scope="col">Temperature</th><th scope="col">Anomaly</th><th scope="col">4-week change</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="enso-source">Week of ' + esc(fmtDate(latest.date)) + '. NOAA CPC weekly OISST v2.1, compared with 1991–2020 averages.</p>';
}

function trend(d) {
  const w = d.weekly;
  if (!w) return '';
  const rows = w.slice(-12).reverse().map((x) => '<tr><td>' + esc(fmtDate(x.date)) + '</td><td>' + esc(degC(x.nino34.anom)) + '</td></tr>').join('');
  return '<h3>Niño 3.4 anomaly, past year</h3>' +
    '<div id="enso-trend" class="enso-trend" role="img" aria-label="Line chart of the weekly Niño 3.4 anomaly over the past year. Latest: ' + esc(degC(w[w.length - 1].nino34.anom)) + '."></div>' +
    '<details class="enso-details"><summary>Last 12 weeks as a table</summary><div class="enso-table-wrap"><table class="enso-table"><thead><tr><th scope="col">Week of</th><th scope="col">Anomaly</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>';
}

const mapBlock =
  '<section class="enso-map-block" id="enso-map-block" aria-label="Pacific Ocean map">' +
    '<div class="enso-controls">' +
      '<span class="enso-seg-btns" role="group" aria-label="Map layer">' +
        '<button type="button" data-layer="sst" class="on" aria-pressed="true">Sea temperature</button>' +
        '<button type="button" data-layer="rain" aria-pressed="false">Rain</button>' +
      '</span>' +
      '<label class="enso-check"><input type="checkbox" id="enso-boxes" checked /> Niño boxes</label>' +
      '<label class="enso-check"><input type="checkbox" id="enso-labels" checked /> Place names</label>' +
      '<button type="button" class="enso-btn enso-reset" id="enso-reset">Reset view</button>' +
    '</div>' +
    '<div class="enso-map" id="enso-map" tabindex="0" aria-label="Interactive map. Drag or use the arrow keys to pan, plus and minus to zoom.">' +
      '<canvas id="enso-canvas"></canvas>' +
      '<div class="enso-zoom"><button type="button" id="enso-zoom-in" aria-label="Zoom in">+</button><button type="button" id="enso-zoom-out" aria-label="Zoom out">−</button></div>' +
      '<div class="enso-tip" id="enso-tip" hidden></div>' +
      '<div class="enso-map-status" id="enso-status" role="status"></div>' +
      '<noscript><div class="enso-map-status">The interactive map needs JavaScript. The readings below work without it.</div></noscript>' +
    '</div>' +
    '<div class="enso-dates">' +
      '<button type="button" class="enso-btn" id="enso-prev" aria-label="Previous day">‹</button>' +
      '<input type="range" id="enso-date" min="0" max="29" value="29" aria-label="Map date, last 30 days" />' +
      '<button type="button" class="enso-btn" id="enso-next" aria-label="Next day">›</button>' +
      '<output id="enso-date-label" for="enso-date">Finding the latest imagery…</output>' +
    '</div>' +
    '<div class="enso-legend" id="enso-legend"></div>' +
    '<p class="enso-source">Imagery: NASA EOSDIS GIBS (GHRSST MUR sea temperature anomalies, GPM IMERG rain), published daily 1–2 days late. Coastlines via NASA GIBS. <a href="/?enso">See it on the globe</a></p>' +
  '</section>';

const howToRead =
  '<section id="how-to-read"><h3>How to read this map</h3>' +
  '<ul class="enso-howto">' +
    '<li><strong>Colour shows difference, not heat.</strong> The tropical Pacific is always warm, so the map shows how far each patch sits above or below its usual level for the date. Grey is about normal, yellow to red is warmer than usual, and green to purple is cooler.</li>' +
    '<li><strong>Look along the equator.</strong> In an El Niño, a band of warm water stretches west from South America. The further and more unbroken it runs, the stronger the event tends to be. In a La Niña the same band runs cool.</li>' +
    '<li><strong>The boxes are the scoreboard.</strong> The headline number averages the Niño 3.4 outline in mid-ocean. Niño 1+2, against the coast, often runs hottest and drives local impacts in Peru and Ecuador.</li>' +
    '<li><strong>Trust broad shapes, not specks.</strong> Small swirls are ordinary ocean eddies. Move the date slider across the 30 days to see what is really building or fading.</li>' +
    '<li><strong>The rain layer shows the response.</strong> El Niño moves the Pacific’s heavy rain east with the warm water, often leaving Indonesia and northern Australia drier. Any single day is mostly weather, so step through several.</li>' +
    '<li><strong>The map and the numbers will not match exactly.</strong> The map is a high-resolution satellite product with its own baseline. Hover over it, or tap on a phone, for a local value, but use the NOAA readings for the official state of ENSO.</li>' +
  '</ul></section>';

const whyThree =
  '<h3>Why the three readings differ</h3>' +
  '<p>All three track the same stretch of ocean. The <strong>weekly</strong> reading is one week compared with a 30-year average, so it moves fastest. <strong>ONI</strong> averages three months. <strong>RONI</strong> also averages three months but subtracts the warming across the whole tropics, because the atmosphere responds to how much warmer this patch is than its surroundings. That makes RONI lower in today’s warmer climate, and it is the number NOAA uses to rate an event. An index of +0.5°C or more, with a matching response in the atmosphere, marks El Niño conditions.</p>';

const sources =
  '<h3>Sources</h3><p class="enso-source">' +
  '<a href="' + SOURCES.advisory + '" rel="noopener">CPC ENSO diagnostic discussion</a> · ' +
  '<a href="' + SOURCES.weekly + '" rel="noopener">CPC weekly Niño indices</a> · ' +
  '<a href="' + SOURCES.roni + '" rel="noopener">CPC RONI</a> · ' +
  '<a href="' + SOURCES.oni + '" rel="noopener">CPC ONI</a> · ' +
  '<a href="https://earthdata.nasa.gov/gibs" rel="noopener">NASA GIBS</a>. ' +
  'GlobalRisk is for situational awareness only and does not issue forecasts. <a href="/methodology">Methodology</a> · <a href="/">Open the live dashboard</a></p>';

function statusBlock(d) {
  const a = d.advisory;
  if (!a) return '<p class="enso-status"><span class="enso-pill">NOAA status unavailable</span></p>';
  return '<p class="enso-status"><span class="enso-pill">' + esc(a.status) + '</span> <span class="enso-status-src">NOAA Climate Prediction Center' + (a.issued ? ', ' + esc(a.issued) : '') + '</span></p>' +
    (a.synopsis ? '<p class="enso-synopsis">' + esc(a.synopsis) + '</p>' : '') +
    (a.next ? '<p class="enso-source">Next NOAA discussion: ' + esc(a.next) + '.</p>' : '');
}

function payload(d) {
  const w = d.weekly;
  const latest = w && w[w.length - 1];
  return {
    status: d.advisory ? d.advisory.status : null,
    regions: REGIONS.map((r) => ({ id: r.id, name: r.name, w: r.w, e: r.e, n: r.n, s: r.s, anom: latest ? latest[r.id].anom : null })),
    series: w ? w.map((x) => ({ date: x.date, v: x.nino34.anom })) : [],
  };
}

function clientData(d) {
  return '<script type="application/json" id="enso-data">' + JSON.stringify(payload(d)).replace(/</g, '\\u003c') + '</script>';
}

// Same readings for the dashboard's globe layer.
async function ensoJson() {
  const d = await loadEnso();
  const complete = d.weekly && d.roni && d.oni && d.advisory;
  return {
    status: 200, type: 'application/json; charset=utf-8',
    cache: complete ? 'public, s-maxage=1800, stale-while-revalidate=21600' : 'public, s-maxage=60',
    html: JSON.stringify(payload(d)),
  };
}

async function ensoPage() {
  const d = await loadEnso();
  const bc = breadcrumbs([{ name: 'Home', path: '/' }, { name: 'El Niño tracker', path: '/el-nino' }]);
  const body = '<article class="legal-card enso">' + bc.html +
    '<p class="eyebrow">ENSO · Pacific Ocean</p><h2>El Niño tracker</h2>' +
    statusBlock(d) + readings(d) + mapBlock +
    '<div class="enso-cols"><div>' + howToRead + '</div><div>' + gauge(d) + whyThree + '</div>' +
    '<div>' + regionTable(d) + '</div><div>' + trend(d) + '</div></div>' + sources +
    '</article>' + clientData(d) + '<script defer src="/sst-colors.js"></script><script defer src="/el-nino.js"></script>';
  // Short edge cache if a source is missing, so one slow NOAA response isn't pinned for long.
  const complete = d.weekly && d.roni && d.oni && d.advisory;
  return {
    status: 200,
    cache: complete ? 'public, s-maxage=1800, stale-while-revalidate=21600' : 'public, s-maxage=60',
    html: shell({
      title: 'El Niño Tracker: Live Pacific Sea Temperature Map | GlobalRisk',
      desc: 'Track El Niño and La Niña: a live Pacific sea surface temperature anomaly map with 30 days of NASA imagery, plus NOAA’s latest Niño 3.4, RONI and ONI readings.',
      path: '/el-nino', body, jsonld: [bc.json], wide: true,
    }),
  };
}

module.exports = { ensoPage, ensoJson, parseWeekly, parseSeasonal, parseAdvisory, bandFor };
