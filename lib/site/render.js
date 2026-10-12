'use strict';
const world = require('./world');
const data = require('./data');
const guides = require('./guides');
const { ORIGIN, esc, shell, breadcrumbs } = require('./layout');

const DAY = 864e5;
const SEV_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High', extreme: 'Extreme' };
const SEV_RANK = { extreme: 4, high: 3, moderate: 2, low: 1 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* -------- small helpers -------------------------------------------------- */
const pad = (n) => String(n).padStart(2, '0');
function fmtUTC(ms) {
  const d = new Date(ms);
  return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ' UTC';
}
function fmtDay(ms) { const d = new Date(ms); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
function rel(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 90) return 'moments ago';
  const m = Math.round(s / 60); if (m < 90) return m + ' minutes ago';
  const h = Math.round(m / 60); if (h < 36) return h + ' hours ago';
  const d = Math.round(h / 24); return d + ' days ago';
}
const iso = (ms) => new Date(ms).toISOString();
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const countryPath = (c) => '/country/' + c.slug;
const sevBadge = (s) => '<span class="badge sev-' + esc(s || 'low') + '">' + esc(SEV_LABEL[s] || 'Low') + '</span>';

function evTitle(e) {
  if (e.layer === 'quakes') return 'M' + (e.mag || 0).toFixed(1) + ' earthquake' + (e.place ? ' — ' + e.place : '');
  return (e.kind ? e.kind + ': ' : '') + (e.title || 'Event');
}
function evPath(e) {
  const slug = world.slugify([e.layer === 'quakes' ? 'm' + (e.mag || 0).toFixed(1) + ' earthquake' : e.kind, e.layer === 'quakes' ? e.place : e.title].join(' ')).slice(0, 70).replace(/-+$/, '');
  return '/event/' + encodeURIComponent(e.id) + (slug ? '/' + slug : '');
}
const countryOf = (e) => (e.cs ? world.load().bySlug.get(e.cs) : null);
function layerLabel(e) { return e.layer === 'quakes' ? 'Earthquake' : e.kind || 'Event'; }

function magClass(m) {
  if (m >= 8) return ['Great', 'Can cause serious damage across regions hundreds of kilometers wide and may generate tsunamis. About one quake of this size occurs worldwide each year on average.'];
  if (m >= 7) return ['Major', 'Can cause serious damage over large areas. Roughly 15 earthquakes of this size occur worldwide each year.'];
  if (m >= 6) return ['Strong', 'Can be destructive in populated areas within tens of kilometers of the epicenter. Around 130 earthquakes of this size occur worldwide each year.'];
  if (m >= 5) return ['Moderate', 'Can damage poorly built structures near the epicenter, while well-designed buildings usually suffer slight damage at most. Roughly 1,300 earthquakes of this size occur worldwide each year.'];
  if (m >= 4) return ['Light', 'Usually causes noticeable shaking and rattling of indoor objects, but significant damage is unlikely.'];
  return ['Minor', 'Often felt by people near the epicenter but rarely causes damage.'];
}
const CAT_WIND = { 1: '119–153 km/h (74–95 mph)', 2: '154–177 km/h (96–110 mph)', 3: '178–208 km/h (111–129 mph)', 4: '209–251 km/h (130–156 mph)', 5: '252 km/h (157 mph) or higher' };
const KIND_BLURB = {
  Wildfires: 'NASA EONET tracks wildfires using satellite observations and agency reports. Fire locations are approximate and the burned area can grow or shrink quickly.',
  'Severe Storms': 'Severe storm events include tropical cyclones and other intense systems. Track and strength change as the storm moves, so check your national weather service for current forecasts.',
  Volcanoes: 'Volcano events mark current eruptions or unrest reported by monitoring agencies. Hazards can include ash, lava, gas, and mudflows, and conditions can change without much notice.',
  Floods: 'Flood events are reported from satellite and agency sources and can cover large areas. Water levels and extent may change as rain continues or recedes.',
  Drought: 'Drought events develop slowly and are tracked over weeks or months, so the date shown reflects the most recent update rather than a single moment.',
  Landslides: 'Landslide events are often triggered by heavy rain or earthquakes and may be reported after they happen.',
  'Dust and Haze': 'Dust and haze events describe airborne particles from storms, fires or other sources that can reduce air quality and visibility.',
  'Sea and Lake Ice': 'Sea and lake ice events track large icebergs and ice conditions observed by satellite.',
};
function kindGuides(e) {
  const g = [];
  if (e.layer === 'quakes' || e.eventtype === 'EQ') g.push('earthquake-magnitude-explained', 'earthquake-safety-what-to-do');
  if (e.eventtype === 'TC' || /storm|cyclone|hurricane|typhoon/i.test(e.kind || '')) g.push('tropical-cyclone-categories-explained');
  if (/wildfire/i.test(e.kind || '') || e.eventtype === 'WF') g.push('how-satellite-fire-detection-works');
  if (e.layer === 'alerts') g.push('gdacs-alert-levels-explained');
  if (!g.length) g.push('gdacs-alert-levels-explained');
  return [...new Set(g)].map((s) => guides.bySlug(s)).filter(Boolean);
}
const guideLinks = (list) => '<ul class="plain">' + list.map((g) => '<li><a href="/guides/' + g.slug + '">' + esc(g.title) + '</a></li>').join('') + '</ul>';

const SOURCE_NAME = { usgs: 'USGS Earthquake Hazards Program', eonet: 'NASA EONET', gdacs: 'GDACS' };
function sourceBlock(e) {
  const name = SOURCE_NAME[e.source] || e.source || 'the original source';
  const link = e.url && /^https?:\/\//.test(e.url) ? ' <a href="' + esc(e.url) + '" target="_blank" rel="noopener nofollow">View the original report ↗</a>' : '';
  return '<p>Source: <strong>' + esc(name) + '</strong>.' + link + '</p>';
}

/* -------- not found ------------------------------------------------------ */
function notFound(what) {
  return {
    status: 404, cache: 'public, s-maxage=60',
    html: shell({
      title: 'Page not found | GlobalRisk', desc: 'This page could not be found.', path: '/404', index: false,
      body: '<article class="legal-card"><p class="eyebrow">404</p><h2>' + esc(what || 'Page not found') + '</h2>' +
        '<p>We could not find that page. Older events are removed from our archive after about two months. You can browse <a href="/events">recent events</a>, the <a href="/countries">country index</a>, or return to the <a href="/">live dashboard</a>.</p></article>',
    }),
  };
}

/* -------- headlines (optional enrichment, never blocks the page) --------- */
const newsCache = new Map();
async function headlines(countryName) {
  const hit = newsCache.get(countryName);
  if (hit && Date.now() - hit.at < 20 * 60e3) return hit.items;
  let items = [];
  try {
    const q = encodeURIComponent('"' + countryName + '" (earthquake OR flood OR wildfire OR storm OR volcano OR conflict)');
    const r = await fetch('https://news.google.com/rss/search?q=' + q + '+when:7d&hl=en-US&gl=US&ceid=US:en', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GlobalRiskBot/1.0; +https://globalrisk.site)' },
      signal: AbortSignal.timeout(3500),
    });
    if (r.ok) {
      const xml = await r.text();
      const dec = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
      for (const blk of xml.split(/<item>/i).slice(1, 9)) {
        const t = /<title>([\s\S]*?)<\/title>/i.exec(blk), l = /<link>([\s\S]*?)<\/link>/i.exec(blk);
        const s = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(blk), p = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(blk);
        if (!t || !l) continue;
        let title = dec(t[1]); const src = s ? dec(s[1]) : '';
        if (src && title.endsWith(' - ' + src)) title = title.slice(0, -(src.length + 3));
        const link = dec(l[1]);
        if (!/^https?:\/\//.test(link)) continue;
        items.push({ title, link, source: src, time: p ? Date.parse(dec(p[1])) || 0 : 0 });
        if (items.length >= 6) break;
      }
    }
  } catch { /* optional */ }
  newsCache.set(countryName, { at: Date.now(), items });
  return items;
}

/* -------- country page --------------------------------------------------- */
function topKinds(evs, n = 6) {
  const m = new Map();
  for (const e of evs) { const k = layerLabel(e); m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

async function countryPage(slug) {
  const w = world.load();
  const c = w.bySlug.get(slug);
  if (!c) return notFound('Country not found');
  const all = await data.loadEvents();
  const now = Date.now();
  const store = data.source() === 'store';
  const span = store ? 'the last 30 days' : 'the most recent feed data';
  const evs = all.filter((e) => e.cs === slug);
  const d1 = evs.filter((e) => e.time >= now - DAY);
  const d7 = evs.filter((e) => e.time >= now - 7 * DAY);
  const quakes = evs.filter((e) => e.layer === 'quakes');
  const alerts = evs.filter((e) => e.layer === 'alerts');
  const nat = evs.filter((e) => e.layer === 'events');
  const strongest = quakes.slice().sort((a, b) => (b.mag || 0) - (a.mag || 0))[0];
  const kinds = topKinds(evs);
  const indexable = data.countryIndexable(evs.length);
  const name = c.name;

  // ---- prose summary (all numbers derived from the data) ----
  const prose = [];
  if (!evs.length) {
    prose.push('GlobalRisk has not recorded any earthquakes of magnitude 2.5 or above, active natural events or Orange/Red disaster alerts located in ' + esc(name) + ' in ' + span + '. A quiet feed is not a guarantee of safety: coverage depends on what our sources report, and events outside the thresholds we track are not shown.');
  } else {
    let p = 'In ' + span + ', GlobalRisk recorded <strong>' + plural(evs.length, 'event') + '</strong> in or near ' + esc(name) + ': ' +
      [quakes.length ? plural(quakes.length, 'earthquake') : '', alerts.length ? plural(alerts.length, 'disaster alert') : '', nat.length ? plural(nat.length, 'natural event') : ''].filter(Boolean).join(', ') + '. ';
    p += d1.length ? plural(d1.length, 'event') + ' occurred in the past 24 hours and ' + d7.length + ' in the past 7 days.' : 'Nothing new was recorded in the past 24 hours; ' + d7.length + ' event' + (d7.length === 1 ? ' was' : 's were') + ' recorded in the past 7 days.';
    prose.push(p);
    if (strongest) {
      prose.push('The strongest earthquake was <a href="' + esc(evPath(strongest)) + '">M' + (strongest.mag || 0).toFixed(1) + ' ' + esc(strongest.place || 'earthquake') + '</a> on ' + fmtDay(strongest.time) + ', which falls in the <em>' + magClass(strongest.mag || 0)[0].toLowerCase() + '</em> class. ' +
        magClass(strongest.mag || 0)[1]);
    }
    if (alerts.length) {
      const red = alerts.filter((a) => a.sev === 'extreme').length;
      prose.push('There ' + (alerts.length === 1 ? 'is ' : 'are ') + plural(alerts.length, 'GDACS alert') + ' for ' + esc(name) + ' (' + red + ' Red, ' + (alerts.length - red) + ' Orange). Orange and Red alerts indicate events that may have a significant humanitarian impact; see <a href="/guides/gdacs-alert-levels-explained">how GDACS alert levels work</a>.');
    }
    if (kinds.length > 1) prose.push('The most common event type is <strong>' + esc(kinds[0][0].toLowerCase()) + '</strong> (' + kinds[0][1] + ' of ' + evs.length + ').');
  }

  // ---- stat tiles ----
  const tile = (k, v, sub) => '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="s">' + esc(sub) + '</div>' : '') + '</div>';
  const tiles = '<div class="stat-grid">' + tile('Past 24 hours', d1.length, 'events') + tile('Past 7 days', d7.length, 'events') +
    tile(store ? 'Past 30 days' : 'Tracked now', evs.length, 'events') +
    tile('Strongest quake', strongest ? 'M' + (strongest.mag || 0).toFixed(1) : '—', strongest ? fmtDay(strongest.time) : 'none recorded') +
    tile('Active alerts', alerts.length, 'Orange / Red') + '</div>';

  // ---- map ----
  const dots = evs.slice(0, 80).map((e) => ({ lon: e.lon, lat: e.lat, sev: e.sev, href: evPath(e), label: evTitle(e) }));
  // Frame the country plus any of its events that sit just offshore (within ~10°).
  const frame = c.bbox.slice();
  for (const d of dots) {
    if (d.lon < c.bbox[0] - 10 || d.lon > c.bbox[2] + 10 || d.lat < c.bbox[1] - 10 || d.lat > c.bbox[3] + 10) continue;
    frame[0] = Math.min(frame[0], d.lon); frame[2] = Math.max(frame[2], d.lon);
    frame[1] = Math.min(frame[1], d.lat); frame[3] = Math.max(frame[3], d.lat);
  }
  const map = world.renderMap({ bbox: frame, highlight: slug, dots, label: 'Map of recent events in ' + name,
    caption: 'Recent events in and around ' + name + '. Marker color shows severity; select a marker to open its page.' });

  // ---- table ----
  const rows = evs.slice(0, 25).map((e) => '<tr><td data-l="When"><time datetime="' + iso(e.time) + '">' + fmtUTC(e.time) + '</time><br><span class="dim">' + rel(e.time, now) + '</span></td>' +
    '<td data-l="Type">' + esc(layerLabel(e)) + '</td><td data-l="Event"><a href="' + esc(evPath(e)) + '">' + esc(evTitle(e)) + '</a></td><td data-l="Severity">' + sevBadge(e.sev) + '</td></tr>').join('');
  const table = evs.length ? '<div class="table-wrap"><table class="src-table ev-table"><thead><tr><th>When</th><th>Type</th><th>Event</th><th>Severity</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    (evs.length > 25 ? '<p class="dim">Showing the 25 most recent of ' + evs.length + ' events.</p>' : '') : '<p>No events to list.</p>';

  // ---- breakdown bars ----
  const max = kinds.length ? kinds[0][1] : 1;
  const bars = kinds.length ? '<div class="bars">' + kinds.map(([k, n]) => '<div class="bar-row"><span class="bl">' + esc(k) + '</span><span class="bt"><i style="width:' + Math.max(4, Math.round((n / max) * 100)) + '%"></i></span><span class="bn">' + n + '</span></div>').join('') + '</div>' : '';

  // ---- FAQ ----
  const faq = [];
  const q24 = d1.filter((e) => e.layer === 'quakes');
  faq.push(['Has there been an earthquake in ' + name + ' today?', q24.length
    ? 'Yes. GlobalRisk shows ' + plural(q24.length, 'earthquake') + ' of magnitude 2.5 or above located in or near ' + name + ' in the past 24 hours. The strongest was M' + Math.max(...q24.map((e) => e.mag || 0)).toFixed(1) + '. Magnitudes are preliminary and can be revised by the USGS.'
    : 'GlobalRisk has not recorded any earthquake of magnitude 2.5 or above in or near ' + name + ' in the past 24 hours. Smaller quakes are not tracked, and reports can lag by several minutes.']);
  faq.push(['What is the strongest recent earthquake in ' + name + '?', strongest
    ? 'In ' + span + ', the strongest earthquake recorded in or near ' + name + ' was M' + (strongest.mag || 0).toFixed(1) + (strongest.place ? ' (' + strongest.place + ')' : '') + ' on ' + fmtDay(strongest.time) + '.'
    : 'No earthquakes of magnitude 2.5 or above have been recorded in or near ' + name + ' in ' + span + '.']);
  faq.push(['Are there active disaster alerts for ' + name + '?', alerts.length
    ? 'Yes. There ' + (alerts.length === 1 ? 'is' : 'are') + ' ' + plural(alerts.length, 'Orange or Red GDACS alert') + ' associated with ' + name + ' in ' + span + '. Open the event pages above for details and the original report.'
    : 'GlobalRisk has no Orange or Red GDACS alerts for ' + name + ' in ' + span + '. Check local authorities for official warnings.']);
  faq.push(['Where does this information come from?', 'Earthquakes come from the USGS, natural events from NASA EONET and disaster alerts from GDACS. GlobalRisk normalizes them, assigns each event to a country using its coordinates, and links to the original report. See the methodology page for details.']);
  const faqHtml = '<div class="faq">' + faq.map(([q, a]) => '<details><summary>' + esc(q) + '</summary><p>' + esc(a) + '</p></details>').join('') + '</div>';

  // ---- guidance ----
  const glist = [];
  if (quakes.length || alerts.some((a) => a.eventtype === 'EQ')) glist.push(guides.bySlug('earthquake-safety-what-to-do'), guides.bySlug('earthquake-magnitude-explained'));
  if (alerts.some((a) => a.eventtype === 'TC') || nat.some((n) => /storm/i.test(n.kind || ''))) glist.push(guides.bySlug('tropical-cyclone-categories-explained'));
  if (nat.some((n) => /wildfire/i.test(n.kind || ''))) glist.push(guides.bySlug('how-satellite-fire-detection-works'));
  glist.push(guides.bySlug('gdacs-alert-levels-explained'));
  const gl = [...new Set(glist.filter(Boolean))];

  // ---- neighbors + news ----
  const counts = new Map();
  for (const e of all) if (e.cs) counts.set(e.cs, (counts.get(e.cs) || 0) + 1);
  const nb = world.neighbors(c).sort((a, b) => (counts.get(b.slug) || 0) - (counts.get(a.slug) || 0)).slice(0, 8);
  const nbHtml = nb.length ? '<h3>Nearby countries</h3><ul class="chips">' + nb.map((o) => '<li><a href="' + countryPath(o) + '">' + esc(o.name) + (counts.get(o.slug) ? ' <span class="dim">· ' + counts.get(o.slug) + '</span>' : '') + '</a></li>').join('') + '</ul>' : '';
  const news = await headlines(name);
  const newsHtml = news.length ? '<h3>Latest headlines</h3><p class="dim">Headlines are linked from their original publishers via Google News. GlobalRisk does not host or edit this content.</p><ul class="plain">' +
    news.map((n) => '<li><a href="' + esc(n.link) + '" target="_blank" rel="noopener nofollow">' + esc(n.title) + '</a>' + (n.source ? ' <span class="dim">— ' + esc(n.source) + '</span>' : '') + '</li>').join('') + '</ul>' : '';

  const bc = breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Countries', path: '/countries' }, { name, path: countryPath(c) }]);
  const body = '<article class="legal-card">' + bc.html + '<p class="eyebrow">Country risk monitor</p><h2>' + esc(name) + ': live earthquakes, disasters and events</h2>' +
    '<p class="dim">Updated <time datetime="' + iso(now) + '">' + fmtUTC(now) + '</time> · Data from USGS, NASA EONET and GDACS</p>' +
    tiles + prose.map((p) => '<p>' + p + '</p>').join('') + map +
    '<h3>Recent events in ' + esc(name) + '</h3>' + table +
    (bars ? '<h3>What kinds of events</h3>' + bars : '') +
    '<h3>Frequently asked questions</h3>' + faqHtml +
    '<h3>Safety and background</h3><p>These guides explain how the hazards in this region are measured and what to do when they occur:</p>' + guideLinks(gl) +
    nbHtml + newsHtml +
    '<p class="dim">GlobalRisk is for situational awareness only and is not an official warning service. Follow your national and local authorities for emergency guidance. <a href="/methodology">How this data is collected</a> · <a href="/">Open the live map</a></p></article>';

  const title = name + ' Earthquakes, Disasters & Risk Events (Live) | GlobalRisk';
  const desc = evs.length
    ? 'Live earthquakes, disaster alerts and natural events in ' + name + ': ' + plural(evs.length, 'event') + ' tracked' + (strongest ? ', strongest earthquake M' + (strongest.mag || 0).toFixed(1) : '') + '. Map, recent events and safety guidance.'
    : 'Recent earthquakes, disaster alerts and natural events in ' + name + ', with a map and safety guidance. No significant events currently tracked.';
  return {
    status: 200, cache: 'public, s-maxage=600, stale-while-revalidate=3600',
    html: shell({
      title, desc, path: countryPath(c), body, index: indexable,
      jsonld: [bc.json, { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
    }),
  };
}

/* -------- event page ----------------------------------------------------- */
function explainEvent(e) {
  const out = [];
  if (e.layer === 'quakes') {
    const m = e.mag || 0, [cls, txt] = magClass(m);
    out.push('This was a <strong>' + cls.toLowerCase() + '</strong> earthquake of magnitude ' + m.toFixed(1) + '. ' + txt);
    out.push('Magnitude measures the energy released at the source. How strongly the ground shook at any particular place depends on distance from the epicenter, the depth of the quake, local geology and building construction, so the same magnitude can be harmless in one place and damaging in another. First magnitudes are preliminary and are often revised by a few tenths as more stations report.');
    if (m >= 6.5) out.push('Earthquakes of this size can generate tsunamis when they occur beneath or near the ocean. Coastal communities should follow official tsunami guidance.');
  } else if (e.layer === 'alerts') {
    const level = e.sev === 'extreme' ? 'Red' : 'Orange';
    out.push('GDACS rated this event <strong>' + level + '</strong>, which means it may have a ' + (level === 'Red' ? 'high' : 'significant') + ' humanitarian impact. Alert levels combine the physical size of the event with estimates of the population exposed and local vulnerability, so they reflect potential impact rather than confirmed damage.');
    if (e.cat) out.push('GDACS reports this storm at <strong>Category ' + e.cat + '</strong> on the Saffir-Simpson scale' + (CAT_WIND[e.cat] ? ', corresponding to sustained winds of ' + CAT_WIND[e.cat] : '') + '. The category describes wind only; storm surge and rainfall flooding are often more dangerous.');
    out.push('Alerts are automated and can be revised as better data arrives. They are intended for humanitarian coordination, not as a public warning service. Follow your local authorities for official guidance.');
  } else {
    out.push(KIND_BLURB[e.kind] || 'This is a natural event tracked by NASA\'s Earth Observatory Natural Event Tracker (EONET), which compiles events reported by satellites and science agencies. The location shown is approximate.');
    out.push('GlobalRisk assigns each event a default <em>moderate</em> severity because EONET does not publish an impact rating. Use the original report for the most accurate status.');
  }
  return out;
}

async function eventPage(id) {
  if (!id) return notFound('Event not found');
  const e = await data.getEvent(id);
  if (!e) return notFound('Event not found');
  const all = await data.loadEvents();
  const now = Date.now();
  const c = countryOf(e);
  const indexable = data.significant(e);

  const near = all.filter((o) => o.id !== e.id && Math.abs(o.time - e.time) <= 14 * DAY && world.haversineKm(e.lat, e.lon, o.lat, o.lon) <= 300)
    .map((o) => ({ o, km: Math.round(world.haversineKm(e.lat, e.lon, o.lat, o.lon)) })).sort((a, b) => b.o.time - a.o.time).slice(0, 10);

  const span = e.layer === 'quakes' ? 3 : 4;
  const bbox = [e.lon - span, e.lat - span * 0.55, e.lon + span, e.lat + span * 0.55];
  const map = world.renderMap({
    bbox, highlight: c ? c.slug : '', dots: near.map(({ o }) => ({ lon: o.lon, lat: o.lat, sev: o.sev, href: evPath(o), label: evTitle(o) })),
    pin: { lon: e.lon, lat: e.lat, sev: e.sev, label: evTitle(e) }, label: 'Map showing the location of ' + evTitle(e),
    caption: 'Location of this event (ringed) with other events within about ' + Math.round(span * 111) + ' km. Approximate position.',
  });

  const facts = [
    ['Event', esc(layerLabel(e))],
    e.layer === 'quakes' ? ['Magnitude', 'M' + (e.mag || 0).toFixed(1) + ' (' + esc(magClass(e.mag || 0)[0]) + ')'] : null,
    ['Severity', sevBadge(e.sev)],
    ['Time', '<time datetime="' + iso(e.time) + '">' + fmtUTC(e.time) + '</time> (' + rel(e.time, now) + ')'],
    ['Location', esc(e.place || (c ? c.name : 'See map'))],
    ['Country', c ? '<a href="' + countryPath(c) + '">' + esc(c.name) + '</a>' : 'Open ocean / not assigned'],
    ['Coordinates', e.lat.toFixed(3) + '°, ' + e.lon.toFixed(3) + '°'],
    ['Source', esc(SOURCE_NAME[e.source] || e.source || '')],
  ].filter(Boolean);
  const dl = '<dl class="facts">' + facts.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>';

  const nearHtml = near.length ? '<h3>Other events within 300 km (±14 days)</h3><ul class="plain">' + near.map(({ o, km }) =>
    '<li><a href="' + esc(evPath(o)) + '">' + esc(evTitle(o)) + '</a> <span class="dim">— ' + km + ' km away, ' + fmtUTC(o.time) + '</span></li>').join('') + '</ul>' +
    (e.layer === 'quakes' ? '<p class="dim">Smaller earthquakes close in time and space to a larger one are often aftershocks or foreshocks, though GlobalRisk does not classify them.</p>' : '') : '';

  const cstats = c ? all.filter((o) => o.cs === c.slug) : [];
  const ctx = c ? '<h3>More from ' + esc(c.name) + '</h3><p>GlobalRisk has recorded ' + plural(cstats.length, 'event') + ' in or near ' + esc(c.name) + ' in the data we hold. <a href="' + countryPath(c) + '">See the full ' + esc(c.name) + ' risk monitor</a>.</p>' : '';

  const title = evTitle(e);
  const bcItems = [{ name: 'Home', path: '/' }, { name: 'Events', path: '/events' }];
  if (c) bcItems.splice(2, 0, { name: c.name, path: countryPath(c) });
  const bc = breadcrumbs(bcItems.concat([{ name: title.length > 60 ? title.slice(0, 57) + '…' : title, path: evPath(e) }]));
  const body = '<article class="legal-card">' + bc.html + '<p class="eyebrow">' + esc(layerLabel(e)) + ' · ' + esc(fmtDay(e.time)) + '</p><h2>' + esc(title) + '</h2>' +
    dl + map + '<h3>What this means</h3>' + explainEvent(e).map((p) => '<p>' + p + '</p>').join('') +
    nearHtml + ctx + '<h3>Source and attribution</h3>' + sourceBlock(e) +
    '<p class="dim">GlobalRisk republishes only basic facts (type, time, location, magnitude or alert level) and links to the original report. Details may be revised by the source after this page was generated on ' + fmtUTC(now) + '.</p>' +
    '<h3>Related guides</h3>' + guideLinks(kindGuides(e)) +
    '<p class="dim">For situational awareness only, not an official warning. Follow local authorities. <a href="/">Open the live map</a></p></article>';

  const where = e.place || (c ? c.name : '');
  const desc = (e.layer === 'quakes' ? 'M' + (e.mag || 0).toFixed(1) + ' earthquake' + (where ? ' ' + where : '') : layerLabel(e) + (e.title ? ': ' + e.title : '')) +
    ' on ' + fmtDay(e.time) + '. ' + (e.layer === 'quakes' ? magClass(e.mag || 0)[0] + ' class. ' : '') + 'Location map, nearby events, what it means and a link to the original report.';
  return {
    status: 200, cache: 'public, s-maxage=900, stale-while-revalidate=86400',
    html: shell({ title: title + ' | ' + fmtDay(e.time) + ' | GlobalRisk', desc: desc.slice(0, 300), path: evPath(e), body, index: indexable, jsonld: [bc.json] }),
  };
}

/* -------- hubs ----------------------------------------------------------- */
async function countriesHub() {
  const all = await data.loadEvents();
  const now = Date.now();
  const counts = new Map(), strong = new Map();
  for (const e of all) if (e.cs) {
    counts.set(e.cs, (counts.get(e.cs) || 0) + 1);
    if (e.layer === 'quakes') strong.set(e.cs, Math.max(strong.get(e.cs) || 0, e.mag || 0));
  }
  const list = world.load().list.slice();
  const active = list.filter((c) => counts.get(c.slug)).sort((a, b) => counts.get(b.slug) - counts.get(a.slug));
  const alpha = list.slice().sort((a, b) => a.name.localeCompare(b.name));
  const cards = active.slice(0, 24).map((c) => '<a class="card" href="' + countryPath(c) + '"><strong>' + esc(c.name) + '</strong><span>' + counts.get(c.slug) + ' events' +
    (strong.get(c.slug) ? ' · max M' + strong.get(c.slug).toFixed(1) : '') + '</span></a>').join('');
  const bc = breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Countries', path: '/countries' }]);
  const body = '<article class="legal-card">' + bc.html + '<p class="eyebrow">Countries</p><h2>Global risk by country</h2>' +
    '<p>Every event GlobalRisk tracks is matched to a country from its coordinates. Choose a country to see its recent earthquakes, disaster alerts and natural events on a map, with the strongest recent activity, answers to common questions and safety guidance. Updated ' + fmtUTC(now) + '.</p>' +
    (cards ? '<h3>Most active right now</h3><div class="card-grid">' + cards + '</div>' : '') +
    '<h3>All countries and territories</h3><ul class="chips wide">' + alpha.map((c) => '<li><a href="' + countryPath(c) + '">' + esc(c.name) + '</a></li>').join('') + '</ul></article>';
  return { status: 200, cache: 'public, s-maxage=900, stale-while-revalidate=3600',
    html: shell({ title: 'Global Risk by Country: Earthquakes, Disasters & Events | GlobalRisk', desc: 'Browse live earthquakes, disaster alerts and natural events for every country, with maps, recent activity and safety guidance.', path: '/countries', body, jsonld: [bc.json] }) };
}

async function eventsHub() {
  const all = await data.loadEvents();
  const now = Date.now();
  const sig = all.filter((e) => data.significant(e) && e.time >= now - 7 * DAY).slice(0, 120);
  const rows = sig.map((e) => {
    const c = countryOf(e);
    return '<tr><td data-l="When"><time datetime="' + iso(e.time) + '">' + fmtUTC(e.time) + '</time></td><td data-l="Type">' + esc(layerLabel(e)) + '</td><td data-l="Event"><a href="' + esc(evPath(e)) + '">' + esc(evTitle(e)) + '</a></td>' +
      '<td data-l="Country">' + (c ? '<a href="' + countryPath(c) + '">' + esc(c.name) + '</a>' : '—') + '</td><td data-l="Severity">' + sevBadge(e.sev) + '</td></tr>';
  }).join('');
  const bc = breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Events', path: '/events' }]);
  const body = '<article class="legal-card">' + bc.html + '<p class="eyebrow">Events</p><h2>Significant events in the past 7 days</h2>' +
    '<p>This list shows the events GlobalRisk considers significant: earthquakes of magnitude ' + data.SIG_MAG + ' and above, Orange and Red disaster alerts, and active tropical storms and volcanic eruptions. Each links to a page with a location map, nearby activity and the original report. Updated ' + fmtUTC(now) + '. For minor earthquakes and the live view, open the <a href="/">dashboard</a>.</p>' +
    (rows ? '<div class="table-wrap"><table class="src-table ev-table"><thead><tr><th>When</th><th>Type</th><th>Event</th><th>Country</th><th>Severity</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p>No significant events are currently available. Please check back shortly.</p>') + '</article>';
  return { status: 200, cache: 'public, s-maxage=300, stale-while-revalidate=1800',
    html: shell({ title: 'Recent Significant Earthquakes, Disasters & Events | GlobalRisk', desc: 'Significant earthquakes (M' + data.SIG_MAG + '+), Orange and Red disaster alerts, tropical storms and volcanic eruptions from the past 7 days, each with a map and source link.', path: '/events', body, jsonld: [bc.json] }) };
}

function guidesHub() {
  const bc = breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }]);
  const body = '<article class="legal-card">' + bc.html + '<p class="eyebrow">Guides</p><h2>Understanding global risk events</h2>' +
    '<p>Plain-language explainers for the hazards and alert systems behind the data on GlobalRisk: how earthquake magnitude works, what a disaster alert color means, how satellites find wildfires, and what to do when an event affects you.</p>' +
    '<div class="card-grid">' + guides.GUIDES.map((g) => '<a class="card" href="/guides/' + g.slug + '"><strong>' + esc(g.title) + '</strong><span>' + esc(g.short) + '</span></a>').join('') + '</div></article>';
  return { status: 200, cache: 'public, s-maxage=3600, stale-while-revalidate=86400',
    html: shell({ title: 'Guides: Earthquakes, Disaster Alerts, Cyclones & Wildfires Explained | GlobalRisk', desc: 'Plain-language guides to earthquake magnitude, GDACS alert levels, tropical cyclone categories, satellite fire detection and safety steps.', path: '/guides', body, jsonld: [bc.json] }) };
}

function guidePage(slug) {
  const g = guides.bySlug(slug);
  if (!g) return notFound('Guide not found');
  const bc = breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }, { name: g.title, path: '/guides/' + g.slug }]);
  const others = guides.GUIDES.filter((x) => x.slug !== g.slug);
  const body = '<article class="legal-card guide-body">' + bc.html + '<p class="eyebrow">Guide</p><h2>' + esc(g.title) + '</h2>' +
    '<p class="dim">By the GlobalRisk team · Published ' + g.published + '</p>' + g.body +
    '<h3>More guides</h3>' + guideLinks(others) + '<p class="dim">General information only, not professional or emergency advice. <a href="/methodology">Our methodology</a> · <a href="/countries">Browse by country</a></p></article>';
  return { status: 200, cache: 'public, s-maxage=3600, stale-while-revalidate=86400',
    html: shell({ title: g.title + ' | GlobalRisk', desc: g.desc, path: '/guides/' + g.slug, body,
      jsonld: [bc.json, { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, datePublished: g.published, dateModified: g.published,
        author: { '@type': 'Organization', name: 'GlobalRisk' }, publisher: { '@type': 'Organization', name: 'GlobalRisk' }, mainEntityOfPage: ORIGIN + '/guides/' + g.slug }] }) };
}

/* -------- homepage briefing (HTML fragment, injected into index.html) ----- */
async function briefing() {
  const all = await data.loadEvents();
  const now = Date.now();
  const d1 = all.filter((e) => e.time >= now - DAY);
  const quakes = d1.filter((e) => e.layer === 'quakes');
  const topQ = quakes.slice().sort((a, b) => (b.mag || 0) - (a.mag || 0)).slice(0, 5);
  const alerts = all.filter((e) => e.layer === 'alerts' && e.time >= now - 7 * DAY);
  const nat = all.filter((e) => e.layer === 'events');
  const storms = [...alerts.filter((e) => e.eventtype === 'TC'), ...nat.filter((e) => /storm|cyclone|hurricane|typhoon/i.test((e.kind || '') + ' ' + (e.title || '')))];

  const counts = new Map(), maxMag = new Map();
  for (const e of d1) if (e.cs) {
    counts.set(e.cs, (counts.get(e.cs) || 0) + 1);
    if (e.layer === 'quakes') maxMag.set(e.cs, Math.max(maxMag.get(e.cs) || 0, e.mag || 0));
  }
  const w = world.load();
  const topC = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, n]) => ({ c: w.bySlug.get(s), n })).filter((x) => x.c);

  const out = ['<h3>Briefing for ' + fmtDay(now) + '</h3>'];
  if (!d1.length) {
    out.push('<p>Fresh event data is still loading. In the meantime, browse the <a href="/events">most recent significant events</a> or the <a href="/countries">country index</a>.</p>');
    return out.join('');
  }
  let p1 = 'Over the past 24 hours GlobalRisk tracked <strong>' + plural(quakes.length, 'earthquake') + '</strong> of magnitude 2.5 or above';
  if (topQ.length) p1 += ', led by <a href="' + esc(evPath(topQ[0])) + '">a magnitude ' + (topQ[0].mag || 0).toFixed(1) + ' event' + (topQ[0].place ? ' ' + esc(topQ[0].place) : '') + '</a>';
  p1 += '. ' + (alerts.length ? 'There ' + (alerts.length === 1 ? 'is' : 'are') + ' <strong>' + plural(alerts.length, 'Orange or Red disaster alert') + '</strong> from GDACS in the past week' : 'No Orange or Red disaster alerts were issued by GDACS in the past week') +
    ' and <strong>' + plural(nat.length, 'active natural event') + '</strong> on NASA\'s tracker.';
  out.push('<p>' + p1 + '</p>');

  if (topQ.length && (topQ[0].mag || 0) >= 6) {
    out.push('<p>An earthquake of magnitude 6 or more is classed as <em>strong</em> and can be destructive within tens of kilometers of the epicenter. If it struck near the coast, official tsunami guidance matters more than the magnitude figure. Read <a href="/guides/earthquake-magnitude-explained">how magnitude and intensity differ</a>.</p>');
  } else if (topQ.length) {
    out.push('<p>The strongest quake in this window was in the <em>' + magClass(topQ[0].mag || 0)[0].toLowerCase() + '</em> class. ' + magClass(topQ[0].mag || 0)[1].split('. ')[0] + '. Most earthquakes recorded each day are small and cause no damage.</p>');
  }
  if (storms.length) {
    // GDACS titles are full notification sentences ("... tropical cyclone SIMON-26. Population ..."),
    // so pull out just the storm name; EONET titles ("Hurricane Simon") are already clean and win ties.
    const byName = new Map();
    const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
    for (const s of storms) {
      const t = s.title || '';
      const m = /tropical cyclone\s+([A-Za-z-]+?)(?:-\d{2})?[\s.,]/i.exec(t);
      const key = world.slugify(m ? m[1] : t.replace(/^(super |severe |major )?(tropical storm|tropical cyclone|hurricane|typhoon|cyclone)\s+/i, '')).replace(/-/g, '');
      if (!key || key.length > 24) continue;
      const clean = m ? 'Tropical cyclone ' + cap(m[1]) : t;
      if (!byName.has(key) || s.layer === 'events') byName.set(key, clean);
    }
    const names = [...byName.values()].slice(0, 5);
    if (names.length) out.push('<p><strong>Tropical systems:</strong> ' + esc(names.join(', ')) + '. Wind categories describe only part of the danger; storm surge and flooding rain often do the most harm. See <a href="/guides/tropical-cyclone-categories-explained">how cyclone categories work</a> and watch the live tracks on the map above.</p>');
  }
  if (topC.length) {
    out.push('<p><strong>Where activity is concentrated:</strong> ' + topC.map(({ c, n }) => '<a href="' + countryPath(c) + '">' + esc(c.name) + '</a> (' + n + (maxMag.get(c.slug) ? ', max M' + maxMag.get(c.slug).toFixed(1) : '') + ')').join(', ') +
      '. Earthquakes cluster along plate boundaries such as the <a href="/guides/pacific-ring-of-fire-explained">Pacific Ring of Fire</a>, so some countries appear again and again.</p>');
  }
  if (topQ.length > 1) {
    out.push('<h3>Strongest earthquakes, last 24 hours</h3><ul class="plain">' + topQ.map((e) => '<li><a href="' + esc(evPath(e)) + '">M' + (e.mag || 0).toFixed(1) + ' ' + esc(e.place || 'earthquake') + '</a> <span class="dim">— ' + rel(e.time, now) + '</span></li>').join('') + '</ul>');
  }
  out.push('<p class="dim">Generated ' + fmtUTC(now) + ' from USGS, NASA EONET and GDACS data. <a href="/events">All significant events</a> · <a href="/countries">Browse by country</a> · <a href="/methodology">Methodology</a></p>');
  return out.join('');
}

/* -------- sitemap -------------------------------------------------------- */
async function sitemap() {
  const all = await data.loadEvents();
  const now = Date.now();
  const urls = [];
  const add = (p, last, freq, pri) => urls.push('  <url><loc>' + ORIGIN + esc(p) + '</loc><lastmod>' + last + '</lastmod><changefreq>' + freq + '</changefreq><priority>' + pri + '</priority></url>');
  const today = iso(now).slice(0, 10);
  add('/', today, 'hourly', '1.0');
  for (const p of ['/countries', '/events']) add(p, today, 'hourly', '0.9');
  add('/guides', '2026-10-06', 'monthly', '0.8');
  for (const g of guides.GUIDES) add('/guides/' + g.slug, g.published, 'monthly', '0.7');
  for (const p of ['/about', '/methodology']) add(p, '2026-10-06', 'monthly', '0.6');
  for (const p of ['/privacy', '/terms', '/contact']) add(p, '2026-10-06', 'yearly', '0.3');
  const latest = new Map(), counts = new Map();
  for (const e of all) if (e.cs) {
    latest.set(e.cs, Math.max(latest.get(e.cs) || 0, e.time));
    counts.set(e.cs, (counts.get(e.cs) || 0) + 1);
  }
  for (const c of world.load().list) if (data.countryIndexable(counts.get(c.slug) || 0)) add(countryPath(c), iso(latest.get(c.slug)).slice(0, 10), 'daily', '0.8');
  for (const e of all) {
    if (!data.significant(e) || e.time < now - 30 * DAY) continue;
    if (urls.length > 4500) break;
    add(evPath(e), iso(e.time).slice(0, 10), 'monthly', '0.5');
  }
  return { status: 200, type: 'application/xml; charset=utf-8', cache: 'public, s-maxage=1800, stale-while-revalidate=86400',
    html: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n' };
}

module.exports = { countryPage, eventPage, countriesHub, eventsHub, guidesHub, guidePage, sitemap, briefing, notFound, evPath };
