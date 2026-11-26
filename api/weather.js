'use strict';
/*
 * NOAA GFS weather model → compact binary grids for the map's forecast
 * layers (wind, temperature, humidity, pressure).
 *
 *   GET /api/weather              → { run, steps: [{ step, t }] }   latest complete run
 *   GET /api/weather?run=YYYYMMDDHH&step=N → one forecast step, binary (see below)
 *
 * Source: NOAA's GFS on the AWS Open Data registry (noaa-gfs-bdp-pds). Public
 * domain, no key, no rate limit. Each step is cut out of NOAA's GRIB2 files
 * with HTTP range requests (only the five fields we need, ~1 MB) and decoded
 * by lib/grib2.js.
 *
 * Step body (gzip), all grids row-major from 90°N, 0°E, north → south, east:
 *   wind  0.5° 720 × 361   Int8 u, then Int8 v      m/s × 2   (±63.5 m/s)
 *   temp  1°   360 × 181   Int8                     °C
 *   rh    1°   360 × 181   Uint8                    %
 *   pres  1°   360 × 181   Uint8                    hPa − 900
 * Steps never change once a run is published, so they are cached for a day.
 */
const zlib = require('zlib');
const { decode } = require('../lib/grib2');

const BUCKET = 'https://noaa-gfs-bdp-pds.s3.amazonaws.com';
const STEPS = [];
for (let h = 0; h <= 48; h += 3) STEPS.push(h);

const runUrl = (run, res, step) => {
  const d = run.slice(0, 8), h = run.slice(8, 10);
  return `${BUCKET}/gfs.${d}/${h}/atmos/gfs.t${h}z.pgrb2.${res}.f${String(step).padStart(3, '0')}`;
};
const runTime = (run) => Date.UTC(+run.slice(0, 4), +run.slice(4, 6) - 1, +run.slice(6, 8), +run.slice(8, 10)) / 1000;

let metaCache = { at: 0, body: null };
const stepCache = new Map();          // 'run:step' → gzip buffer (small LRU)

// The newest run whose last step we need has been published.
async function latestRun() {
  const now = Date.now();
  let t = Math.floor(now / 21600e3) * 21600e3;
  for (let k = 0; k < 5; k++, t -= 21600e3) {
    const d = new Date(t);
    const run = d.toISOString().slice(0, 10).replace(/-/g, '') + String(d.getUTCHours()).padStart(2, '0');
    const r = await fetch(runUrl(run, '1p00', STEPS[STEPS.length - 1]) + '.idx', { method: 'HEAD', signal: AbortSignal.timeout(6000) });
    if (r.ok) return run;
  }
  throw new Error('no recent GFS run found');
}

// Byte ranges of the wanted fields, from NOAA's .idx inventory.
async function ranges(url, wanted) {
  const r = await fetch(url + '.idx', { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('GFS index ' + r.status);
  const lines = (await r.text()).trim().split('\n').map((l) => l.split(':'));
  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const key = lines[i][3] + ':' + lines[i][4];
    const name = wanted[key];
    if (!name) continue;
    const start = +lines[i][1], end = i + 1 < lines.length ? +lines[i + 1][1] - 1 : '';
    out[name] = start + '-' + end;
  }
  for (const n of Object.values(wanted)) if (!out[n]) throw new Error('GFS field missing: ' + n);
  return out;
}
async function field(url, range) {
  const r = await fetch(url, { headers: { Range: 'bytes=' + range }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('GFS data ' + r.status);
  return decode(Buffer.from(await r.arrayBuffer()));
}

async function buildStep(run, step) {
  const fine = runUrl(run, '0p50', step), coarse = runUrl(run, '1p00', step);
  const [rf, rc] = await Promise.all([
    ranges(fine, { 'UGRD:10 m above ground': 'u', 'VGRD:10 m above ground': 'v' }),
    ranges(coarse, { 'TMP:2 m above ground': 't', 'RH:2 m above ground': 'rh', 'PRMSL:mean sea level': 'p' }),
  ]);
  const [u, v, t, rh, p] = await Promise.all([
    field(fine, rf.u), field(fine, rf.v), field(coarse, rc.t), field(coarse, rc.rh), field(coarse, rc.p),
  ]);
  const nw = u.ni * u.nj, nc = t.ni * t.nj;
  if (u.ni !== 720 || u.nj !== 361 || t.ni !== 360 || t.nj !== 181) throw new Error('unexpected GFS grid');
  const out = Buffer.alloc(nw * 2 + nc * 3);
  const q = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));
  for (let k = 0; k < nw; k++) {
    out.writeInt8(q(u.values[k] * 2, -127, 127), k);
    out.writeInt8(q(v.values[k] * 2, -127, 127), nw + k);
  }
  for (let k = 0; k < nc; k++) {
    out.writeInt8(q(t.values[k] - 273.15, -127, 127), nw * 2 + k);
    out[nw * 2 + nc + k] = q(rh.values[k], 0, 100);
    out[nw * 2 + nc * 2 + k] = q(p.values[k] / 100 - 900, 0, 255);
  }
  return zlib.gzipSync(out, { level: 6 });
}

module.exports = async (req, res) => {
  const q = req.query || {};
  try {
    if (!q.run) {
      if (!metaCache.body || Date.now() - metaCache.at > 10 * 60e3) {
        const run = await latestRun(), base = runTime(run);
        metaCache = { at: Date.now(), body: { source: 'NOAA GFS', run, steps: STEPS.map((s) => ({ step: s, t: base + s * 3600 })) } };
      }
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
      return res.status(200).json(metaCache.body);
    }
    const run = String(q.run), step = +q.step;
    if (!/^\d{10}$/.test(run) || !STEPS.includes(step)) return res.status(400).json({ error: 'bad run or step' });
    const id = run + ':' + step;
    let body = stepCache.get(id);
    if (!body) {
      body = await buildStep(run, step);
      stepCache.set(id, body);
      if (stepCache.size > 20) stepCache.delete(stepCache.keys().next().value);
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600, immutable');
    return res.status(200).send(body);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: e.message });
  }
};
