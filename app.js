/* ==========================================================================
   WORLDWATCH — front-end controller
   Renders the world map, pulls live feeds through the local /api/fetch proxy,
   and drives the news wire. No build step, no external libraries.
   ========================================================================== */
'use strict';

/* ---------- proxy + fetch helpers ------------------------------------- */
const proxy = (url) => '/api/fetch?url=' + encodeURIComponent(url);

async function fetchText(url) {
  const r = await fetch(proxy(url), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
const fetchJson = async (url) => JSON.parse(await fetchText(url));

/* ---------- map projection (equirectangular) -------------------------- */
const W = 1000, H = 500;                       // viewBox units (2:1)
const project = (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- reference tables ------------------------------------------ */
const ISO3_TO_ISO2 = {
  AFG:'AF',AGO:'AO',ALB:'AL',ARE:'AE',ARG:'AR',ARM:'AM',ATA:'AQ',ATF:'TF',AUS:'AU',AUT:'AT',AZE:'AZ',
  BDI:'BI',BEL:'BE',BEN:'BJ',BFA:'BF',BGD:'BD',BGR:'BG',BHS:'BS',BIH:'BA',BLR:'BY',BLZ:'BZ',BOL:'BO',
  BRA:'BR',BRN:'BN',BTN:'BT',BWA:'BW',CAF:'CF',CAN:'CA',CHE:'CH',CHL:'CL',CHN:'CN',CIV:'CI',CMR:'CM',
  COD:'CD',COG:'CG',COL:'CO',CRI:'CR',CUB:'CU',CYP:'CY',CZE:'CZ',DEU:'DE',DJI:'DJ',DNK:'DK',DOM:'DO',
  DZA:'DZ',ECU:'EC',EGY:'EG',ERI:'ER',ESP:'ES',EST:'EE',ETH:'ET',FIN:'FI',FJI:'FJ',FLK:'FK',FRA:'FR',
  GAB:'GA',GBR:'GB',GEO:'GE',GHA:'GH',GIN:'GN',GMB:'GM',GNB:'GW',GNQ:'GQ',GRC:'GR',GRL:'GL',GTM:'GT',
  GUY:'GY',HND:'HN',HRV:'HR',HTI:'HT',HUN:'HU',IDN:'ID',IND:'IN',IRL:'IE',IRN:'IR',IRQ:'IQ',ISL:'IS',
  ISR:'IL',ITA:'IT',JAM:'JM',JOR:'JO',JPN:'JP',KAZ:'KZ',KEN:'KE',KGZ:'KG',KHM:'KH',KOR:'KR',KWT:'KW',
  LAO:'LA',LBN:'LB',LBR:'LR',LBY:'LY',LKA:'LK',LSO:'LS',LTU:'LT',LUX:'LU',LVA:'LV',MAR:'MA',MDA:'MD',
  MDG:'MG',MEX:'MX',MKD:'MK',MLI:'ML',MLT:'MT',MMR:'MM',MNE:'ME',MNG:'MN',MOZ:'MZ',MRT:'MR',MWI:'MW',
  MYS:'MY',NAM:'NA',NCL:'NC',NER:'NE',NGA:'NG',NIC:'NI',NLD:'NL',NOR:'NO',NPL:'NP',NZL:'NZ',OMN:'OM',
  PAK:'PK',PAN:'PA',PER:'PE',PHL:'PH',PNG:'PG',POL:'PL',PRI:'PR',PRK:'KP',PRT:'PT',PRY:'PY',PSE:'PS',
  QAT:'QA',ROU:'RO',RUS:'RU',RWA:'RW',SAU:'SA',SDN:'SD',SDS:'SS',SEN:'SN',SLB:'SB',SLE:'SL',SLV:'SV',
  SOM:'SO',SRB:'RS',SUR:'SR',SVK:'SK',SVN:'SI',SWE:'SE',SWZ:'SZ',SYR:'SY',TCD:'TD',TGO:'TG',THA:'TH',
  TJK:'TJ',TKM:'TM',TLS:'TL',TTO:'TT',TUN:'TN',TUR:'TR',TWN:'TW',TZA:'TZ',UGA:'UG',UKR:'UA',URY:'UY',
  USA:'US',UZB:'UZ',VEN:'VE',VNM:'VN',VUT:'VU',YEM:'YE',ZAF:'ZA',ZMB:'ZM',ZWE:'ZW',SSD:'SS',KOS:'XK'
};

// Curated Google News editions (native language) for the biggest markets.
const NEWS_EDITIONS = {
  USA:{hl:'en-US',gl:'US',ceid:'US:en'}, GBR:{hl:'en-GB',gl:'GB',ceid:'GB:en'},
  CAN:{hl:'en-CA',gl:'CA',ceid:'CA:en'}, AUS:{hl:'en-AU',gl:'AU',ceid:'AU:en'},
  IND:{hl:'en-IN',gl:'IN',ceid:'IN:en'}, IRL:{hl:'en-IE',gl:'IE',ceid:'IE:en'},
  NZL:{hl:'en-NZ',gl:'NZ',ceid:'NZ:en'}, ZAF:{hl:'en-ZA',gl:'ZA',ceid:'ZA:en'},
  NGA:{hl:'en-NG',gl:'NG',ceid:'NG:en'}, PAK:{hl:'en-PK',gl:'PK',ceid:'PK:en'},
  PHL:{hl:'en-PH',gl:'PH',ceid:'PH:en'}, SGP:{hl:'en-SG',gl:'SG',ceid:'SG:en'},
  KEN:{hl:'en-KE',gl:'KE',ceid:'KE:en'},
  FRA:{hl:'fr',gl:'FR',ceid:'FR:fr'}, BEL:{hl:'fr',gl:'BE',ceid:'BE:fr'},
  DEU:{hl:'de',gl:'DE',ceid:'DE:de'}, AUT:{hl:'de',gl:'AT',ceid:'AT:de'},
  CHE:{hl:'de',gl:'CH',ceid:'CH:de'}, ITA:{hl:'it',gl:'IT',ceid:'IT:it'},
  ESP:{hl:'es',gl:'ES',ceid:'ES:es'}, MEX:{hl:'es-419',gl:'MX',ceid:'MX:es-419'},
  ARG:{hl:'es-419',gl:'AR',ceid:'AR:es-419'}, COL:{hl:'es-419',gl:'CO',ceid:'CO:es-419'},
  CHL:{hl:'es-419',gl:'CL',ceid:'CL:es-419'}, PER:{hl:'es-419',gl:'PE',ceid:'PE:es-419'},
  VEN:{hl:'es-419',gl:'VE',ceid:'VE:es-419'}, CUB:{hl:'es-419',gl:'CU',ceid:'CU:es-419'},
  PRT:{hl:'pt-PT',gl:'PT',ceid:'PT:pt-150'}, BRA:{hl:'pt-BR',gl:'BR',ceid:'BR:pt-419'},
  NLD:{hl:'nl',gl:'NL',ceid:'NL:nl'}, RUS:{hl:'ru',gl:'RU',ceid:'RU:ru'},
  UKR:{hl:'uk',gl:'UA',ceid:'UA:uk'}, POL:{hl:'pl',gl:'PL',ceid:'PL:pl'},
  TUR:{hl:'tr',gl:'TR',ceid:'TR:tr'}, GRC:{hl:'el',gl:'GR',ceid:'GR:el'},
  ROU:{hl:'ro',gl:'RO',ceid:'RO:ro'}, CZE:{hl:'cs',gl:'CZ',ceid:'CZ:cs'},
  HUN:{hl:'hu',gl:'HU',ceid:'HU:hu'}, SWE:{hl:'sv',gl:'SE',ceid:'SE:sv'},
  NOR:{hl:'no',gl:'NO',ceid:'NO:no'}, DNK:{hl:'da',gl:'DK',ceid:'DK:da'},
  FIN:{hl:'fi',gl:'FI',ceid:'FI:fi'}, BGR:{hl:'bg',gl:'BG',ceid:'BG:bg'},
  SRB:{hl:'sr',gl:'RS',ceid:'RS:sr'}, HRV:{hl:'hr',gl:'HR',ceid:'HR:hr'},
  SVK:{hl:'sk',gl:'SK',ceid:'SK:sk'}, SVN:{hl:'sl',gl:'SI',ceid:'SI:sl'},
  LTU:{hl:'lt',gl:'LT',ceid:'LT:lt'}, LVA:{hl:'lv',gl:'LV',ceid:'LV:lv'},
  CHN:{hl:'zh-CN',gl:'CN',ceid:'CN:zh-Hans'}, TWN:{hl:'zh-TW',gl:'TW',ceid:'TW:zh-Hant'},
  HKG:{hl:'zh-HK',gl:'HK',ceid:'HK:zh-Hant'}, JPN:{hl:'ja',gl:'JP',ceid:'JP:ja'},
  KOR:{hl:'ko',gl:'KR',ceid:'KR:ko'}, IDN:{hl:'id',gl:'ID',ceid:'ID:id'},
  THA:{hl:'th',gl:'TH',ceid:'TH:th'}, VNM:{hl:'vi',gl:'VN',ceid:'VN:vi'},
  MYS:{hl:'ms',gl:'MY',ceid:'MY:ms'}, BGD:{hl:'bn',gl:'BD',ceid:'BD:bn'},
  SAU:{hl:'ar',gl:'SA',ceid:'SA:ar'}, ARE:{hl:'ar',gl:'AE',ceid:'AE:ar'},
  EGY:{hl:'ar',gl:'EG',ceid:'EG:ar'}, LBN:{hl:'ar',gl:'LB',ceid:'LB:ar'},
  MAR:{hl:'ar',gl:'MA',ceid:'MA:ar'}, ISR:{hl:'he',gl:'IL',ceid:'IL:he'},
  IRN:{hl:'fa',gl:'IR',ceid:'IR:fa'}
};

const CATEGORIES = [
  { id:'top',      label:'Top Stories',    type:'topic', topic:null,         worldTopic:'WORLD' },
  { id:'conflict', label:'War & Conflict', type:'search', hot:true, q:'war OR conflict OR military OR strike OR troops OR offensive OR ceasefire' },
  { id:'crisis',   label:'Crisis & Unrest',type:'search', hot:true, q:'crisis OR emergency OR protest OR unrest OR coup OR sanctions OR "state of emergency"' },
  { id:'disaster', label:'Disasters',      type:'search', hot:true, q:'earthquake OR flood OR wildfire OR hurricane OR typhoon OR cyclone OR volcano OR drought OR landslide OR "natural disaster"' },
  { id:'business', label:'Business',       type:'topic', topic:'BUSINESS',   topicWord:'business economy' },
  { id:'tech',     label:'Technology',     type:'topic', topic:'TECHNOLOGY', topicWord:'technology' },
  { id:'science',  label:'Science',        type:'topic', topic:'SCIENCE',    topicWord:'science' },
  { id:'health',   label:'Health',         type:'topic', topic:'HEALTH',     topicWord:'health' },
  { id:'sports',   label:'Sports',         type:'topic', topic:'SPORTS',     topicWord:'sports' }
];

// ---- inline SVG icon set (stroke, currentColor, sized in em) -----------
const _svg = (p) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" `
  + `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = {
  earthquake: _svg('<path d="M2 12h3l2-5 3 10 3-8 2 3h4"/>'),
  cyclone: _svg('<circle cx="12" cy="12" r="1.4"/><path d="M12 8a4 4 0 0 1 4 4M12 16a4 4 0 0 1-4-4"/><path d="M12 4a8 8 0 0 1 8 8M12 20a8 8 0 0 1-8-8"/>'),
  flood: _svg('<path d="M2 13.5c1.5 0 1.5 1.5 3 1.5s1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5"/><path d="M2 18.5c1.5 0 1.5 1.5 3 1.5s1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5"/><path d="M6 9l1.5-3L9 9M14 8l1.5-4L17 8"/>'),
  volcano: _svg('<path d="M3 20h18l-6-9h-6z"/><path d="M12 11V6M9 7 8 5M15 7l1-2"/>'),
  drought: _svg('<circle cx="12" cy="8" r="3.3"/><path d="M12 1.5v1.2M12 12.5v1.2M4.3 8h1.2M18.5 8h1.2M6.4 2.4l.9.9M16.7 2.4l-.9.9"/><path d="M4 18.5h4l2 2 2-3 2 3 2-2h2"/>'),
  wildfire: _svg('<path d="M12 3c1 4 4.5 5 4.5 9a4.5 4.5 0 0 1-9 0c0-1.8.9-3 2-4 .2 1.8 1.2 2.7 2 3-.2-3-1.5-5-1.5-8z"/>'),
  tsunami: _svg('<path d="M3 14.5c0-6 6-9 10-6-3-.3-5 1.5-5 4 3.5-2.5 7-.5 7 3"/><path d="M3 20c1.5 0 1.5 1.5 3 1.5s1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5"/>'),
  ice: _svg('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>'),
  snow: _svg('<path d="M12 2v20M3.3 7 20.7 17M20.7 7 3.3 17M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
  storm: _svg('<path d="M7 16a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3.5 3.5 0 0 1-1 6.9"/><path d="M13 12l-3 4h3l-2 4"/>'),
  dust: _svg('<path d="M3 8h12a2 2 0 1 0-2-2M3 12h16M3 16h11a2 2 0 1 1-2 2M3 20h8"/>'),
  landslide: _svg('<path d="M3 20h18L13 8l-3 4-2-2z"/><circle cx="16" cy="17" r="1"/><circle cx="13" cy="19" r="1"/>'),
  temperature: _svg('<path d="M14 14V6a2 2 0 1 0-4 0v8a4 4 0 1 0 4 0z"/><path d="M12 14V9"/>'),
  gear: _svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19 5l-2 2M7 17l-2 2M19 19l-2-2M7 7 5 5"/>'),
  droplet: _svg('<path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11z"/>'),
  hazard: _svg('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'),
  globe: _svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>'),
  tv: _svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  live: _svg('<circle cx="12" cy="12" r="2.4"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>'),
  offline: _svg('<path d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M2 9c3-2.7 6.5-4 10-4 1 0 2 .1 3 .3M3 3l18 18"/>'),
  trending: _svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  target: _svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  news: _svg('<path d="M4 5h13v15H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v10a2 2 0 0 1-2 2M7 9h7M7 13h7M7 17h5"/>'),
  search: _svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  pin: _svg('<path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>')
};
const svgIcon = (name) => ICONS[name] || ICONS.hazard;

// EONET category id / GDACS type code -> icon name
const EONET_ICON = {
  wildfires:'wildfire', severeStorms:'cyclone', volcanoes:'volcano', seaLakeIce:'ice',
  earthquakes:'earthquake', floods:'flood', drought:'drought', dustHaze:'dust',
  landslides:'landslide', snow:'snow', tempExtremes:'temperature', temperatureExtremes:'temperature',
  manmade:'gear', waterColor:'droplet'
};
const GDACS_TYPE = {
  EQ:{label:'Earthquake',icon:'earthquake'}, TC:{label:'Cyclone',icon:'cyclone'}, FL:{label:'Flood',icon:'flood'},
  VO:{label:'Volcano',icon:'volcano'}, DR:{label:'Drought',icon:'drought'}, WF:{label:'Wildfire',icon:'wildfire'},
  TS:{label:'Tsunami',icon:'tsunami'}
};

// 24/7 live news channels (resolved to their current stream via /api/live).
const CHANNELS = [
  { name:'Sky News',   handle:'@skynews',          cc:'gb' },
  { name:'ABC News',   handle:'@abcnews',          cc:'us' },
  { name:'Bloomberg',  handle:'@markets',          cc:'us' },
  { name:'Euronews',   handle:'@euronews',         cc:'eu' },
  { name:'TRT World',  handle:'@trtworld',         cc:'tr' },
  { name:'LiveNOW FOX',handle:'@livenowfox',       cc:'us' },
  { name:'CNA',        handle:'@channelnewsasia',  cc:'sg' },
  { name:'GMA',        handle:'@gmanews',          cc:'ph' },
  { name:'ABS-CBN',    handle:'@abscbnnews',       cc:'ph' },
  { name:'TV5 · News5',handle:'@News5Everywhere',  cc:'ph' },
  { name:'Al Jazeera', handle:'@aljazeeraenglish', cc:'qa' },
  { name:'DW News',    handle:'@dwnews',           cc:'de' }
];

// Major countries that always get a name label on the map.
const LABEL_SET = new Set(['USA','CAN','BRA','ARG','RUS','CHN','IND','AUS','ZAF','EGY','NGA',
  'COD','DZA','SAU','IRN','TUR','FRA','DEU','ESP','GBR','ITA','UKR','KAZ','MNG','JPN','KOR',
  'IDN','PAK','MEX','COL','PER','CHL','SWE','NOR','FIN','POL','SDN','ETH','KEN','LBY','MLI',
  'NER','TCD','AGO','VEN','THA','VNM','MMR','AFG','IRQ','BOL','MOZ','MDG','SOM','NAM','GRL']);

// NASA "Blue Marble" equirectangular basemap (public domain). Maps lon/lat
// linearly, so it lines up exactly with the SVG projection, markers and labels.
// Served by GIBS with open CORS, so the canvas can read it without a proxy.
const SAT_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap'
  + '&FORMAT=image/jpeg&SRS=EPSG:4326&STYLES=&WIDTH=2048&HEIGHT=1024&BBOX=-180,-90,180,90&LAYERS=BlueMarble_NextGeneration';

const STOPWORDS = new Set(('the a an and or of to in on for with from at by as is are was were be been will '
  + 'says said after over amid into new news world could would about more than that this his her its their '
  + 'they them out up off you your our who what when where why how not but has have had can may might '
  + 'first two three million billion year years day days week amid vs live update updates report reports '
  + 'latest breaking top story stories видео').split(/\s+/));

/* ---------- state ----------------------------------------------------- */
const state = {
  country: null,                 // {id, name} or null (world)
  category: CATEGORIES[0],
  search: '',
  hazards: [],
  layers: { quakes:true, events:true, alerts:true },
  view: { x:0, y:0, w:W, h:H },
  globe: { on:true, lon:121, lat:13, scale:1, auto:true },   // starts centred on PH
  satOn: true,
  mapStyle: 'satellite',         // 'satellite' (Esri imagery) or 'streets' (CARTO dark)
  markerEls: [],
  fires: [],
  fireEls: [],
  labelEls: [],
  tv: null,
  countryPaths: new Map(),
  globePaths: new Map(),
  feedsOk: 0, feedsTotal: 4,
  lastNews: []
};

/* ---------- tiny DOM utils -------------------------------------------- */
const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const escapeHtml = (s) => (s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

// Real flag image (SVG) from flagcdn. Falls back to a globe icon.
function flagImg(cc) {
  if (!cc || cc === 'XK') return svgIcon('globe');
  return `<img class="flag" src="https://flagcdn.com/${cc.toLowerCase()}.svg" alt="" onerror="this.remove()">`;
}
function flag(iso3) { return flagImg(ISO3_TO_ISO2[iso3]); }
function relTime(date) {
  if (!date || isNaN(date)) return '';
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
let toastTimer;
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 3200);
}

/* ---------- motion preference ------------------------------------------
   Two of the app's biggest motions are driven from JS, out of CSS's reach:
   the globe's auto-spin and the ticker's duplicated marquee track. Both
   consult this. */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
reduceMotion.addEventListener('change', () => {
  buildTicker();                        // re-emit with/without the loop copy
  if (reduceMotion.matches) markGlobeDirty();   // repaint once, then hold still
});

/* ---------- overlay layers (focus management) --------------------------
   The drawers and the notice modal are real dialogs, so they have to behave
   like them: focus moves inside on open, Tab stays within, and focus returns
   to whatever opened it on close — otherwise keyboard users tab invisibly
   through the page sitting behind the overlay. Layers stack, so a notice
   opened from the Wanted drawer peels off one Escape at a time. */
const layerStack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root) {
  // offsetParent is null for anything display:none'd inside the panel.
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
}
function focusLayer(root) {
  const f = focusables(root);
  if (f.length) f[0].focus();
  else { root.setAttribute('tabindex', '-1'); root.focus(); }
}
function pushLayer(root, close) {
  if (layerStack.some((l) => l.root === root)) return;   // already open
  layerStack.push({ root, close, restore: document.activeElement });
  focusLayer(root);
}
function popLayer(root) {
  const i = layerStack.findIndex((l) => l.root === root);
  if (i === -1) return;                                   // not open — no-op
  const [layer] = layerStack.splice(i, 1);
  if (layer.restore && document.contains(layer.restore)) layer.restore.focus();
}

document.addEventListener('keydown', (e) => {
  const top = layerStack[layerStack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); top.close(); return; }
  if (e.key !== 'Tab') return;
  const f = focusables(top.root);
  if (!f.length) { e.preventDefault(); return; }
  const first = f[0], last = f[f.length - 1];
  const outside = !top.root.contains(document.activeElement);
  if (e.shiftKey && (outside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (outside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
}, true);

/* ---------- polling scheduler ------------------------------------------
   Every recurring poll registers here instead of owning a raw setInterval,
   so the whole app suspends while the tab is hidden and catches up the
   moment it comes back. A monitor left open overnight would otherwise fire
   several hundred upstream requests nobody is looking at — and, worse, show
   stale data for minutes after you return to it. */
const pollers = new Set();

function armPoll(p) {
  clearInterval(p.id);
  p.id = setInterval(() => { p.last = performance.now(); p.fn(); }, p.ms);
}
function poll(fn, ms) {
  const p = { fn, ms, id: null, last: performance.now() };
  pollers.add(p);
  if (!document.hidden) armPoll(p);
  return p;
}
function unpoll(p) { if (!p) return; clearInterval(p.id); p.id = null; pollers.delete(p); }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    for (const p of pollers) { clearInterval(p.id); p.id = null; }
    return;
  }
  // performance.now() keeps advancing while hidden, so "overdue" is real elapsed
  // time: run whatever fell due while we were away, then resume ticking.
  for (const p of pollers) {
    if (performance.now() - p.last >= p.ms) { p.last = performance.now(); p.fn(); }
    armPoll(p);
  }
});

/* ==========================================================================
   MAP
   ========================================================================== */
const svg = $('#map');
const stage = $('#map-stage');
const tooltip = $('#map-tooltip');
const SVGNS = 'http://www.w3.org/2000/svg';

function ringToPath(coords) {
  let d = '';
  for (const ring of coords) {
    ring.forEach(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    });
    d += 'Z';
  }
  return d;
}

// bbox centre of a feature's largest ring — good enough for a name label.
function featureCentroid(f) {
  const g = f.geometry;
  if (!g) return null;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = null, bestLen = 0;
  for (const poly of polys) { const ring = poly[0]; if (ring && ring.length > bestLen) { bestLen = ring.length; best = ring; } }
  if (!best) return null;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [lon, lat] of best) { if (lon < minx) minx = lon; if (lon > maxx) maxx = lon; if (lat < miny) miny = lat; if (lat > maxy) maxy = lat; }
  return [(minx + maxx) / 2, (miny + maxy) / 2];
}

function buildMap() {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // satellite basemap (hidden until the Satellite toggle is on)
  const sat = document.createElementNS(SVGNS, 'image');
  sat.setAttribute('id', 'sat-layer');
  sat.setAttribute('class', 'sat-layer');
  sat.setAttribute('x', 0); sat.setAttribute('y', 0);
  sat.setAttribute('width', W); sat.setAttribute('height', H);
  sat.setAttribute('preserveAspectRatio', 'none');
  sat.setAttribute('href', SAT_URL);
  sat.setAttributeNS('http://www.w3.org/1999/xlink', 'href', SAT_URL);
  svg.appendChild(sat);

  // El Niño layer on the flat map (see EL NINO LAYER below)
  const enso = document.createElementNS(SVGNS, 'image');
  enso.setAttribute('id', 'enso-layer');
  enso.setAttribute('x', 0); enso.setAttribute('y', 0);
  enso.setAttribute('width', W); enso.setAttribute('height', H);
  enso.setAttribute('preserveAspectRatio', 'none');
  svg.appendChild(enso);
  const ensoBoxes = document.createElementNS(SVGNS, 'g');
  ensoBoxes.setAttribute('id', 'enso-boxes');
  svg.appendChild(ensoBoxes);

  // ocean graticule (meridians / parallels)
  const grat = document.createElementNS(SVGNS, 'g');
  grat.setAttribute('class', 'graticule');
  grat.setAttribute('id', 'flat-grat');
  for (let lon = -150; lon <= 150; lon += 30) {
    const [x] = project(lon, 0);
    const l = document.createElementNS(SVGNS, 'line');
    l.setAttribute('x1', x); l.setAttribute('y1', 0); l.setAttribute('x2', x); l.setAttribute('y2', H);
    grat.appendChild(l);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = project(0, lat);
    const l = document.createElementNS(SVGNS, 'line');
    l.setAttribute('x1', 0); l.setAttribute('y1', y); l.setAttribute('x2', W); l.setAttribute('y2', y);
    grat.appendChild(l);
  }
  svg.appendChild(grat);

  // countries
  const gc = document.createElementNS(SVGNS, 'g');
  gc.setAttribute('id', 'flat-countries');
  for (const f of WORLD_GEOJSON.features) {
    const geom = f.geometry;
    if (!geom) continue;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    let d = '';
    for (const poly of polys) d += ringToPath(poly);
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', 'country');
    p.dataset.id = f.id;
    p.dataset.name = f.properties && f.properties.name ? f.properties.name : f.id;
    p.addEventListener('mousemove', (e) => showTip(e, `<div class="tt-title">${flag(f.id)} ${escapeHtml(p.dataset.name)}</div><div class="tt-meta">Click to load national news</div>`));
    p.addEventListener('mouseleave', hideTip);
    p.addEventListener('click', () => handleCountryClick(f.id));
    gc.appendChild(p);
    state.countryPaths.set(f.id, p);
  }
  svg.appendChild(gc);

  // country name labels
  const gl = document.createElementNS(SVGNS, 'g');
  gl.setAttribute('id', 'labels'); gl.setAttribute('class', 'map-labels');
  state.labelEls = [];
  for (const f of WORLD_GEOJSON.features) {
    if (!LABEL_SET.has(f.id)) continue;
    const c = featureCentroid(f);
    if (!c) continue;
    const [x, y] = project(c[0], c[1]);
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', y.toFixed(1));
    t.setAttribute('class', 'clabel'); t.setAttribute('font-size', 9);
    t.textContent = ((f.properties && f.properties.name) || f.id).toUpperCase();
    gl.appendChild(t);
    state.labelEls.push({ t, base: 9, bx: x, by: y, lon: c[0], lat: c[1] });
  }
  buildGlobe();          // globe layers sit under labels + markers
  svg.appendChild(gl);

  // storm tracks / cones layer (below hazard markers)
  const gst = document.createElementNS(SVGNS, 'g');
  gst.setAttribute('id', 'storms');
  svg.appendChild(gst);

  // active-fire pixels sit below the hazard markers
  const gf = document.createElementNS(SVGNS, 'g');
  gf.setAttribute('id', 'fires');
  svg.appendChild(gf);

  // marker layer sits on top
  const gm = document.createElementNS(SVGNS, 'g');
  gm.setAttribute('id', 'markers');
  svg.appendChild(gm);

  $('#stat-countries').textContent = WORLD_GEOJSON.features.length;
  setupMapInteraction();
}

function showTip(e, html) {
  const r = stage.getBoundingClientRect();
  tipIsCoordsOnly = false;
  tooltip.innerHTML = html + pointerReadout(e);
  tooltip.classList.add('show');
  let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
  if (x + tooltip.offsetWidth > r.width) x = e.clientX - r.left - tooltip.offsetWidth - 12;
  if (y + tooltip.offsetHeight > r.height) y = e.clientY - r.top - tooltip.offsetHeight - 12;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}
const hideTip = () => { tooltip.classList.remove('show'); tipIsCoordsOnly = false; };

// Every map tooltip ends with where the pointer is; over open ocean it's the whole tooltip.
let tipIsCoordsOnly = false;
function pointerLonLat(e) {
  if (state.globe.on) {
    const r = stage.getBoundingClientRect();
    return unprojectGlobe(e.clientX - r.left, e.clientY - r.top);
  }
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return null;
  return { lon: p.x / W * 360 - 180, lat: 90 - p.y / H * 180 };
}
function pointerReadout(e) {
  const q = pointerLonLat(e);
  if (!q) return '';
  // More decimals as you zoom: 0.1° is about 11 km, which is useless at street level.
  const digits = !state.globe.on ? 1 : globeTileZoom >= 12 ? 4 : globeTileZoom >= 8 ? 3 : globeTileZoom >= 5 ? 2 : 1;
  const coords = Math.abs(q.lat).toFixed(digits) + '°' + (q.lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(q.lon).toFixed(digits) + '°' + (q.lon >= 0 ? 'E' : 'W');
  const sst = ensoValueAt(q.lon, q.lat);
  return '<div class="tt-coords">' + (sst ? '<strong>' + sst + '</strong> vs usual · ' : '') + coords + '</div>';
}
function ensoValueAt(lon, lat) {
  if (!ensoOn || !ensoTex || (state.globe.on && globeTileZoom >= TILE_FLAT_Z)) return null;
  const x = Math.min(ensoTex.w - 1, Math.floor((lon + 180) / 360 * ensoTex.w));
  const y = Math.min(ensoTex.h - 1, Math.floor((90 - lat) / 180 * ensoTex.h));
  const i = (y * ensoTex.w + x) * 4, d = ensoTex.data;
  return window.SST ? window.SST.label(d[i], d[i + 1], d[i + 2], d[i + 3]) : null;
}

/* ---- shared event presentation (tooltip + in-app detail card) ---------- */
function eventSource(h) {
  return h.layer === 'quakes' ? 'USGS' : h.layer === 'events' ? 'NASA EONET'
    : h.layer === 'alerts' ? 'GDACS' : h.layer === 'fires' ? 'NASA FIRMS' : 'Live feed';
}
// A real place/country, never the category echoed back (EONET has no place name).
function hazardPlace(h) {
  const p = (h.place && h.place !== h.kind) ? h.place : '';
  const c = (h.country && h.country !== h.kind) ? h.country : '';
  return p || c || '';
}
// EONET storm events carry no intensity, but GDACS tracks the same cyclones with
// a real category + wind speed. Match them (by name, else by proximity) so a
// hurricane's card shows "CAT 2 · 157 km/h" instead of a bare status.
function matchStorm(h) {
  if (!storms || !storms.length || h.layer !== 'events') return null;
  const title = (h.title || '').toUpperCase();
  let m = storms.find((s) => s.name && s.name.length >= 3 && title.includes(s.name.toUpperCase()));
  if (m) return m;
  const isStorm = /storm|cyclon|hurricane|typhoon/i.test((h.kind || '') + ' ' + (h.title || ''));
  if (isStorm && isFinite(h.lat) && isFinite(h.lon)) {
    m = storms.find((s) => s.center && Math.abs(s.center[1] - h.lat) < 3 && Math.abs(s.center[0] - h.lon) < 3);
    if (m) return m;
  }
  return null;
}
// Cyclone category → our severity-badge colour band.
function catBadge(c) { return (c === '5' || c === '4') ? 'extreme' : (c === '3' || c === '2') ? 'high' : c === '1' ? 'moderate' : 'low'; }

// EONET (natural events) reports no severity. Show a matched cyclone's real
// category, else a recency-graded status — "ACTIVE" only when NASA observed it
// recently, otherwise "ONGOING" (still open, but not lately updated). Never a
// fabricated "moderate". Quakes/alerts keep their real severity.
function eventAgeDays(h) {
  const t = h.time instanceof Date ? h.time : new Date(h.time);
  return isNaN(t) ? 0 : (Date.now() - t.getTime()) / 86400000;
}
function severityLabel(h) {
  if (h.layer === 'fires') return { key: 'Fire power', badge: h.sev, text: (h.frp || 0) + ' MW' };
  if (h.layer === 'events') {
    const s = matchStorm(h);
    if (s) return { key: 'Category', badge: catBadge(s.cat.c), text: s.cat.label + (s.wind ? ' · ' + Math.round(s.wind) + ' km/h' : '') };
    return eventAgeDays(h) <= 3
      ? { key: 'Status', badge: 'active', text: 'ACTIVE' }
      : { key: 'Status', badge: 'stale', text: 'ONGOING' };
  }
  return { key: 'Severity', badge: h.sev, text: (h.sev || '').toUpperCase() };
}
// EONET's timestamp is the latest observation; FIRMS's is the detection time.
function whenLabel(h) { return h.layer === 'events' ? 'Last update' : h.layer === 'fires' ? 'Detected' : 'When'; }
function fmtWhen(t) {
  const d = t instanceof Date ? t : new Date(t);
  if (isNaN(d)) return '—';
  return relTime(d) + ' ago · ' + d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}
// Rich hover tooltip — shows every field we have for the marker.
function hazardTipHTML(h) {
  const row = (k, v) => (v || v === 0) ? `<div class="tt-r"><span>${k}</span><b>${v}</b></div>` : '';
  const typeVal = escapeHtml(h.kind || '—') + (h.mag ? ' · M' + h.mag : '') + (h.cat ? ' · Cat ' + h.cat : '');
  return `<div class="tt-title">${svgIcon(h.icon)} ${escapeHtml(h.title || '')}</div>`
    + `<div class="tt-rows">`
    + row('Type', typeVal)
    + row('Where', escapeHtml(hazardPlace(h)))
    + (isFinite(h.lat) && isFinite(h.lon) ? row('Coords', h.lat.toFixed(2) + '°, ' + h.lon.toFixed(2) + '°') : '')
    + row(whenLabel(h), relTime(h.time) + ' ago')
    + row('Source', eventSource(h))
    + `</div>`
    + `<span class="tt-sev sev-${severityLabel(h).badge}">${severityLabel(h).text}</span>`
    + `<div class="tt-hint">Click for full details</div>`;
}
// In-app detail card content (its own container — no external redirect).
function eventDetailHTML(h) {
  const rows = [];
  const push = (k, v) => { if (v || v === 0) rows.push(`<div class="ed-row"><span class="ed-k">${k}</span><span class="ed-v">${v}</span></div>`); };
  push('Type', escapeHtml(h.kind || '—'));
  if (h.mag) push('Magnitude', 'M' + h.mag);
  if (h.cat) push('Category', 'Cat ' + h.cat + (h.wind ? ' · ' + h.wind + ' km/h' : ''));
  const sl = severityLabel(h);
  push(sl.key, `<span class="tt-sev sev-${sl.badge}">${sl.text}</span>`);
  if (h.layer === 'fires') {
    if (h.conf) push('Confidence', escapeHtml(h.conf));
    if (h.sat) push('Satellite', escapeHtml(h.sat) + (h.dn ? ' · ' + h.dn : ''));
  }
  const loc = hazardPlace(h);
  if (loc) push('Location', escapeHtml(loc));
  const storm = matchStorm(h);   // EONET storm → GDACS cyclone (countries in its path)
  if (storm && storm.affected && storm.affected.length) push('Affected', escapeHtml(storm.affected.slice(0, 4).join(', ')));
  if (isFinite(h.lat) && isFinite(h.lon)) push('Coordinates', h.lat.toFixed(3) + '°, ' + h.lon.toFixed(3) + '°');
  push(whenLabel(h), escapeHtml(fmtWhen(h.time)));
  push('Source', storm ? 'NASA EONET · GDACS' : eventSource(h));
  return `<button class="ed-close" title="Close" aria-label="Close">✕</button>`
    + `<div class="ed-head"><span class="ed-ic d-icon-${h.sev}">${svgIcon(h.icon)}</span><span class="ed-kind">${escapeHtml(h.kind || 'Event')}</span></div>`
    + `<div class="ed-title">${escapeHtml(h.title || '')}</div>`
    + `<div class="ed-rows">${rows.join('')}</div>`
    + (h.url ? `<a class="ed-link" href="${escapeHtml(h.url)}" target="_blank" rel="noopener">View source report ↗</a>` : '');
}
function openEventDetail(h, e) {
  hideTip();
  const box = $('#event-detail');
  box.innerHTML = eventDetailHTML(h);
  box.hidden = false;
  const r = stage.getBoundingClientRect();
  box.style.left = '0px'; box.style.top = '0px';               // reset so we can measure
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const px = e ? e.clientX - r.left : r.width / 2;
  const py = e ? e.clientY - r.top : r.height / 2;
  let x = px + 16, y = py + 16;
  if (x + bw > r.width - 10) x = px - bw - 16;                 // flip if it would overflow
  x = Math.max(10, Math.min(x, r.width - bw - 10));
  y = Math.max(10, Math.min(y, r.height - bh - 10));
  box.style.left = x + 'px'; box.style.top = y + 'px';
  box.onclick = (ev) => ev.stopPropagation();                 // don't let card clicks reach the map
  box.querySelector('.ed-close').onclick = (ev) => { ev.stopPropagation(); closeEventDetail(); };
}
function closeEventDetail() { const b = $('#event-detail'); if (b) { b.hidden = true; b.innerHTML = ''; } }
// A non-modal popover, so it isn't a focus layer — but it must yield Escape to
// any dialog stacked above it rather than closing alongside one.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !layerStack.length) closeEventDetail();
});
stage.addEventListener('click', closeEventDetail);             // clicking empty map dismisses the card

/* ==========================================================================
   GLOBE — Google-Earth-style orthographic view.
   Vector layers (countries, graticule, markers, labels) re-project each
   frame; the Blue Marble texture is inverse-mapped onto the sphere on a
   canvas that sits behind the SVG. No libraries.
   ========================================================================== */
const GX = 500, GY = 250, RAD = Math.PI / 180;
const gEls = {};
let ensoCanvas = null, ensoOn = false, ensoTex = null, ensoLoading = false, ensoInfo = null;
let gCanvas = null, baseCanvas = null, gFeatures = [], gDirty = true, mapDragging = false, settleT = 0;
let texData = null, texW = 0, texH = 0, texLoading = false;
let satCanvas = null, satData = [], orbitsOn = false, orbitsLoading = false, satLastProp = 0;
let stormsOn = true, stormsLoading = false, storms = [], stormsLoaded = false, stormsSig = null;
let firesOn = false, firesLoading = false, firesLoaded = false, firesConfigured = true;
let suppressClick = false;   // true right after a drag, so it isn't read as a click
function handleCountryClick(id) {
  if (suppressClick) { suppressClick = false; return; }
  selectCountry(id, null, { rotate: true });   // map click: open drawer + spin globe to it
}

const globeR = () => 228 * state.globe.scale;
const markGlobeDirty = () => { gDirty = true; };

function globeProject(lon, lat) {
  const g = state.globe;
  const cosp0 = Math.cos(g.lat * RAD), sinp0 = Math.sin(g.lat * RAD);
  const lam = (lon - g.lon) * RAD, phi = lat * RAD;
  const cosp = Math.cos(phi), sinp = Math.sin(phi), cosl = Math.cos(lam);
  const x3 = cosp * Math.sin(lam);
  const y3 = cosp0 * sinp - sinp0 * cosp * cosl;
  const z3 = sinp0 * sinp + cosp0 * cosp * cosl;
  const R = globeR();
  return { x: GX + R * x3, y: GY - R * y3, vis: z3 >= 0, z: z3 };
}
function activeProject(lon, lat) {
  if (state.globe.on) return globeProject(lon, lat);
  const [x, y] = project(lon, lat);
  return { x, y, vis: true };
}
const markerScaleFactor = () => (state.globe.on ? 1 : state.view.w / W);

function buildGlobe() {
  const defs = document.createElementNS(SVGNS, 'defs');
  defs.innerHTML =
    '<radialGradient id="gOcean" cx="42%" cy="38%" r="68%">'
    + '<stop offset="0%" stop-color="#1d3a66"/><stop offset="55%" stop-color="#11213f"/><stop offset="100%" stop-color="#060d1c"/></radialGradient>'
    + '<radialGradient id="gHalo"><stop offset="76%" stop-color="rgba(90,170,255,0)"/>'
    + '<stop offset="88%" stop-color="rgba(90,170,255,0.30)"/><stop offset="100%" stop-color="rgba(90,170,255,0)"/></radialGradient>'
    + '<radialGradient id="gShade" cx="38%" cy="32%" r="78%">'
    + '<stop offset="0%" stop-color="rgba(255,255,255,0.05)"/><stop offset="60%" stop-color="rgba(0,0,0,0)"/>'
    + '<stop offset="100%" stop-color="rgba(2,6,18,0.55)"/></radialGradient>';
  svg.appendChild(defs);

  const root = document.createElementNS(SVGNS, 'g');
  root.setAttribute('id', 'globe-root');
  const mk = (tag, attrs) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    root.appendChild(n);
    return n;
  };
  gEls.halo = mk('circle', { class: 'g-halo', cx: GX, cy: GY, fill: 'url(#gHalo)', 'pointer-events': 'none' });
  gEls.ocean = mk('circle', { class: 'g-ocean', cx: GX, cy: GY, fill: 'url(#gOcean)' });
  gEls.grat = mk('path', { class: 'graticule' });
  const gcountries = mk('g', {});
  for (const f of WORLD_GEOJSON.features) {
    const geom = f.geometry;
    if (!geom) continue;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('class', 'country');
    p.dataset.id = f.id;
    p.dataset.name = (f.properties && f.properties.name) || f.id;
    p.addEventListener('mousemove', (e) => showTip(e, `<div class="tt-title">${flag(f.id)} ${escapeHtml(p.dataset.name)}</div><div class="tt-meta">Click to load national news</div>`));
    p.addEventListener('mouseleave', hideTip);
    p.addEventListener('click', () => handleCountryClick(f.id));
    gcountries.appendChild(p);
    state.globePaths.set(f.id, p);
    const bb = [180, 90, -180, -90];        // lon/lat bounds, for off-screen culling
    for (const poly of polys) for (const ring of poly) for (const pt of ring) {
      if (pt[0] < bb[0]) bb[0] = pt[0];
      if (pt[1] < bb[1]) bb[1] = pt[1];
      if (pt[0] > bb[2]) bb[2] = pt[0];
      if (pt[1] > bb[3]) bb[3] = pt[1];
    }
    gFeatures.push({ polys, el: p, bbox: bb, hidden: false });
  }
  gEls.shade = mk('circle', { class: 'g-shade', cx: GX, cy: GY, fill: 'url(#gShade)', 'pointer-events': 'none' });
  gEls.limb = mk('circle', { class: 'g-limb', cx: GX, cy: GY, fill: 'none', stroke: 'rgba(140,190,255,0.35)', 'stroke-width': 1.2, 'pointer-events': 'none' });
  svg.appendChild(root);

  gCanvas = document.createElement('canvas');
  gCanvas.className = 'globe-canvas';
  stage.insertBefore(gCanvas, svg);

  ensoCanvas = document.createElement('canvas');
  ensoCanvas.className = 'globe-canvas enso-canvas';
  stage.insertBefore(ensoCanvas, svg);   // over the imagery, under outlines and markers

  satCanvas = document.createElement('canvas');
  satCanvas.className = 'sat-canvas';
  stage.appendChild(satCanvas);   // above the svg (z-index:2) — orbits over the surface

  camCanvas = document.createElement('canvas');
  camCanvas.className = 'cam-canvas';
  stage.appendChild(camCanvas);      // fixed ground installations, under the aircraft

  flightCanvas = document.createElement('canvas');
  flightCanvas.className = 'flight-canvas';
  stage.appendChild(flightCanvas);   // above the orbits — aircraft fly over everything

}

function updateGlobeCircles() {
  const R = globeR();
  gEls.halo.setAttribute('r', R * 1.08);
  gEls.ocean.setAttribute('r', R);
  gEls.shade.setAttribute('r', R);
  gEls.limb.setAttribute('r', R + 0.4);
}

function updateGlobePaths(met) {
  const g = state.globe, R = globeR();
  const cosp0 = Math.cos(g.lat * RAD), sinp0 = Math.sin(g.lat * RAD), lon0 = g.lon;
  // Past VECTOR_MAX_Z the 110m outlines are off by kilometres and the projected
  // coordinates run to millions of units — park them instead.
  if (globeDeep) {
    for (const gf of gFeatures) if (!gf.hidden) { gf.el.setAttribute('d', 'M-9 -9'); gf.hidden = true; }
    if (gratShown) { gEls.grat.setAttribute('d', 'M-9 -9'); gratShown = false; }
    return;
  }
  gratShown = true;
  const win = visibleWindow(met || stageMetrics());
  for (const gf of gFeatures) {
    if (!inWindow(gf.bbox, win)) {
      if (!gf.hidden) { gf.el.setAttribute('d', 'M-9 -9'); gf.hidden = true; }
      continue;
    }
    let d = '';
    let anyVis = false;   // cull countries entirely on the far side of the sphere
    for (const poly of gf.polys) {
      for (const ring of poly) {
        let first = true;
        for (let k = 0; k < ring.length; k++) {
          const lam = (ring[k][0] - lon0) * RAD, phi = ring[k][1] * RAD;
          const cosp = Math.cos(phi), sinp = Math.sin(phi), cosl = Math.cos(lam);
          let x3 = cosp * Math.sin(lam);
          let y3 = cosp0 * sinp - sinp0 * cosp * cosl;
          const z3 = sinp0 * sinp + cosp0 * cosp * cosl;
          if (z3 >= 0) anyVis = true;
          else {                 // behind the sphere → clamp onto the limb
            const dd = Math.hypot(x3, y3) || 1e-9;
            x3 /= dd; y3 /= dd;
          }
          d += (first ? 'M' : 'L') + (GX + R * x3).toFixed(1) + ' ' + (GY - R * y3).toFixed(1);
          first = false;
        }
        d += 'Z';
      }
    }
    gf.el.setAttribute('d', anyVis ? d : 'M-9 -9');
    gf.hidden = !anyVis;
  }
  // graticule: front-facing segments only
  let gd = '';
  const addLine = (pts) => {
    let pen = false;
    for (const q of pts) {
      const p = globeProject(q[0], q[1]);
      if (p.vis) { gd += (pen ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); pen = true; }
      else pen = false;
    }
  };
  for (let lo = -180; lo < 180; lo += 30) { const pts = []; for (let la = -85; la <= 85; la += 5) pts.push([lo, la]); addLine(pts); }
  for (let la = -60; la <= 60; la += 30) { const pts = []; for (let lo = -180; lo <= 180; lo += 5) pts.push([lo, la]); addLine(pts); }
  gEls.grat.setAttribute('d', gd || 'M-9 -9');
}

function updateGlobeMarkers() {
  for (const m of state.markerEls) {
    const p = globeProject(m.lon, m.lat);
    if (!p.vis || p.x < -500 || p.x > 1500 || p.y < -500 || p.y > 1000) { m.grp.style.display = 'none'; continue; }
    m.grp.style.display = '';
    m.grp.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  }
}
function updateGlobeLabels() {
  for (const l of state.labelEls) {
    const p = globeProject(l.lon, l.lat);
    // hide labels near the limb — they bunch up unreadably at the edge
    if (!p.vis || p.z < 0.15 || globeDeep
      || p.x < -200 || p.x > 1200 || p.y < -200 || p.y > 700) { l.t.style.display = 'none'; continue; }
    l.t.style.display = '';
    l.t.setAttribute('x', p.x.toFixed(1));
    l.t.setAttribute('y', p.y.toFixed(1));
    l.t.setAttribute('font-size', 9);
  }
}

/* ---- satellite texture on the sphere --------------------------------- */
let texTries = 0;
function loadTexture() {
  if (texData || texLoading) return;
  texLoading = true;
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const cx2 = c.getContext('2d');
      cx2.drawImage(im, 0, 0);
      const id = cx2.getImageData(0, 0, c.width, c.height);
      texData = id.data; texW = c.width; texH = c.height;
      markGlobeDirty();
    } catch (err) { console.warn('globe texture unavailable:', err.message); }
    texLoading = false;
    syncSatCanvas();
  };
  im.onerror = () => {
    texLoading = false;
    if (++texTries < 3) setTimeout(loadTexture, 3000 * texTries);
    else console.warn('globe texture unavailable after ' + texTries + ' tries');
  };
  im.src = SAT_URL;
}
function syncSatCanvas() {
  if (gCanvas) gCanvas.style.display =
    (state.globe.on && state.satOn && (texData || globeTileZoom >= TILE_MIN_Z)) ? 'block' : 'none';
}

// Inverse orthographic per pixel: screen → sphere → lon/lat → texture.
// `tex` defaults to the Blue Marble; overlays pass their own and keep their alpha.
function paintSphere(canvas, quality, tex) {
  const td = tex ? tex.data : texData, tw = tex ? tex.w : texW, th = tex ? tex.h : texH;
  if (!td || !canvas) return false;
  const rect = stage.getBoundingClientRect();
  if (!rect.width) return false;
  const q = quality * Math.min(window.devicePixelRatio || 1, 1.5);
  const cw = Math.max(2, Math.round(rect.width * q));
  const ch = Math.max(2, Math.round(rect.height * q));
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  const ctx = canvas.getContext('2d');
  const s = Math.min(rect.width / W, rect.height / H);
  const R = globeR() * s * q, cxp = cw / 2, cyp = ch / 2;
  const g = state.globe;
  const cosp0 = Math.cos(g.lat * RAD), sinp0 = Math.sin(g.lat * RAD);
  const lonFrac = (g.lon + 180) / 360, INV2PI = 1 / (2 * Math.PI), INVPI = 1 / Math.PI;
  const img = ctx.createImageData(cw, ch);
  const d = img.data;
  const j0 = Math.max(0, Math.floor(cyp - R)), j1 = Math.min(ch - 1, Math.ceil(cyp + R));
  for (let j = j0; j <= j1; j++) {
    const b = (cyp - (j + 0.5)) / R, b2 = b * b;
    if (b2 > 1) continue;
    const rowHalf = Math.sqrt(1 - b2) * R;
    const i0 = Math.max(0, Math.floor(cxp - rowHalf)), i1 = Math.min(cw - 1, Math.ceil(cxp + rowHalf));
    for (let i = i0; i <= i1; i++) {
      const a = ((i + 0.5) - cxp) / R;
      const r2 = a * a + b2;
      if (r2 > 1) continue;
      const c = Math.sqrt(1 - r2);
      const lat = Math.asin(b * cosp0 + c * sinp0);
      const lam = Math.atan2(a, c * cosp0 - b * sinp0);
      let fx = lam * INV2PI + lonFrac;
      fx -= Math.floor(fx);
      const tx = (fx * tw) | 0;
      const ty = Math.min(th - 1, Math.max(0, ((0.5 - lat * INVPI) * th) | 0));
      const si = (ty * tw + tx) << 2, di = (j * cw + i) << 2;
      const sh = 0.6 + 0.4 * c;                    // limb darkening
      d[di] = td[si] * sh; d[di + 1] = td[si + 1] * sh; d[di + 2] = td[si + 2] * sh; d[di + 3] = tex ? td[si + 3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return true;
}
function drawTexture(quality) { return paintSphere(gCanvas, quality); }
function scheduleSettle() {
  clearTimeout(settleT);
  settleT = setTimeout(() => {
    if (state.globe.on && state.satOn) drawGlobeImagery(false);
    drawEnso(false);
  }, 240);
}

/* ==========================================================================
   DEEP ZOOM — streaming Web-Mercator tiles, Google-Maps style.
   The Blue Marble texture runs out of detail around zoom 3, so past that the
   sphere is painted from a tile pyramid instead (down to z19 — individual
   houses, cars and street names). Tiles are drawn as small warped quads
   through the SAME orthographic projection the markers use, so imagery and
   hazards stay locked together, and the sphere just flattens into a street
   map as you fall towards the ground. No libraries, no API keys.
   ========================================================================== */
const TILE_PX = 256;
const TILE_MIN_Z = 5;        // below this Blue Marble is still the nicer picture
const TILE_FLAT_Z = 8;       // past this the visible cap is small enough to skip the base layer
const VECTOR_MAX_Z = 10;     // 110m country outlines are wrong by kilometres past this
const TILE_MAX_PARALLEL = 8;
const TILE_CACHE_MAX = 900;
const MERC_MAX_LAT = 85.0511;
const EARTH_R_M = 6371008.8;

const TILE_SOURCES = {
  satellite: {
    id: 'satellite', max: 19,
    credit: 'Imagery © Esri · Maxar · Earthstar Geographics',
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
  },
  streets: {
    id: 'streets', max: 19,
    credit: '© OpenStreetMap contributors · © CARTO',
    url: (z, x, y) => `https://${'abc'[(x + y) % 3]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`
  }
};
const activeTileSource = () => TILE_SOURCES[state.mapStyle] || TILE_SOURCES.satellite;

let globeTileZoom = 0, globeDeep = false, gratShown = true, lastScaleTxt = '';

/* Web Mercator in 0..1 world units, y measured down from the north edge. */
const lat2merc = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + clamp(lat, -MERC_MAX_LAT, MERC_MAX_LAT) * RAD / 2)) / (2 * Math.PI);
const merc2lat = (m) => (2 * Math.atan(Math.exp((0.5 - m) * 2 * Math.PI)) - Math.PI / 2) / RAD;

const dprCap = () => Math.min(window.devicePixelRatio || 1, 2);

// One getBoundingClientRect per frame, shared by everything that needs it.
// R is the sphere radius in CSS pixels — the number every zoom decision hangs off.
function stageMetrics() {
  const r = stage.getBoundingClientRect();
  const s = Math.min(r.width / W, r.height / H) || 1;
  return { w: r.width, h: r.height, s, R: globeR() * s };
}
// The tile zoom whose pixels land ~1:1 on screen at the view centre. cos(lat)
// is the Mercator correction — a tile covers less ground the further poleward
// it sits — and dpr keeps tiles sharp on retina displays.
function tileZoomFor(met) {
  const cosLat = Math.max(Math.cos(state.globe.lat * RAD), 0.05);
  const z = Math.log2(2 * Math.PI * met.R * dprCap() * cosLat / TILE_PX);
  return clamp(Math.round(z), 0, activeTileSource().max);
}
// Inverse of the above: the globe scale that lands on a given tile zoom.
function scaleForTileZoom(z) {
  const met = stageMetrics();
  const cosLat = Math.max(Math.cos(state.globe.lat * RAD), 0.05);
  return Math.pow(2, z) * TILE_PX / (2 * Math.PI * 228 * met.s * dprCap() * cosLat);
}
// One notch past the deepest published tiles, so the last level can still be framed.
const globeMaxScale = () => scaleForTileZoom(activeTileSource().max + 0.6);

// Screen pixel -> lon/lat, or null when the pointer is off the sphere.
function unprojectGlobe(px, py, met) {
  const m = met || stageMetrics();
  if (!m.R) return null;
  const a = (px - m.w / 2) / m.R, b = (m.h / 2 - py) / m.R;
  const r2 = a * a + b * b;
  if (r2 > 1) return null;
  const c = Math.sqrt(1 - r2), g = state.globe;
  const cosp0 = Math.cos(g.lat * RAD), sinp0 = Math.sin(g.lat * RAD);
  const lat = Math.asin(clamp(b * cosp0 + c * sinp0, -1, 1)) / RAD;
  const lon = g.lon + Math.atan2(a, c * cosp0 - b * sinp0) / RAD;
  return { lon: ((lon + 540) % 360) - 180, lat };
}

/* ---- tile cache ------------------------------------------------------- */
const tileCache = new Map();          // key -> { state, img }; iteration order doubles as LRU
let tileQueue = [], tileActive = 0;
const tileKey = (src, z, x, y) => src + '/' + z + '/' + x + '/' + y;

function requestTile(src, z, x, y) {
  const key = tileKey(src, z, x, y);
  const hit = tileCache.get(key);
  if (hit) { tileCache.delete(key); tileCache.set(key, hit); return hit; }   // touch = most recent
  const rec = { state: 'queued', img: null };
  tileCache.set(key, rec);
  tileQueue.push({ key, src, z, x, y, rec });
  // Anything still queued from an older view is no longer worth fetching.
  if (tileQueue.length > 160) {
    for (const d of tileQueue.splice(0, tileQueue.length - 160)) {
      if (d.rec.state === 'queued') tileCache.delete(d.key);
    }
  }
  if (tileCache.size > TILE_CACHE_MAX) {
    for (const [k, v] of tileCache) {
      if (tileCache.size <= TILE_CACHE_MAX) break;
      if (v.state === 'ok' || v.state === 'err') tileCache.delete(k);
    }
  }
  pumpTiles();
  return rec;
}
function pumpTiles() {
  while (tileActive < TILE_MAX_PARALLEL && tileQueue.length) {
    const job = tileQueue.pop();              // newest first: whatever is on screen right now
    if (job.rec.state !== 'queued') continue;
    job.rec.state = 'loading';
    tileActive++;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.decoding = 'async';
    const done = (ok) => {
      tileActive--;
      job.rec.state = ok ? 'ok' : 'err';
      if (ok) job.rec.img = im;
      markGlobeDirty();
      pumpTiles();
    };
    im.onload = () => done(true);
    im.onerror = () => done(false);
    im.src = TILE_SOURCES[job.src].url(job.z, job.x, job.y);
  }
}
// The tile itself, or the best already-cached coarser tile standing in for it.
// That stand-in is what makes zooming read as blurry-then-sharp instead of blank.
function tileOrAncestor(src, z, x, y) {
  const rec = requestTile(src, z, x, y);
  if (rec.state === 'ok') return { img: rec.img, sx: 0, sy: 0, sw: TILE_PX, sh: TILE_PX };
  let px = x, py = y, f = 1;
  for (let k = 1; k <= 6 && z - k >= 0; k++) {
    px = Math.floor(px / 2); py = Math.floor(py / 2); f *= 2;
    const up = tileCache.get(tileKey(src, z - k, px, py));
    if (up && up.state === 'ok') {
      const sub = TILE_PX / f;
      return { img: up.img, sx: (x % f) * sub, sy: (y % f) * sub, sw: sub, sh: sub };
    }
  }
  return null;
}

/* ---- which tiles the sphere is currently showing ---------------------- */
// Sampling a grid of screen points and inverse-projecting is the robust way to
// get this on a sphere: the visible patch is a curved cap, not a rectangle.
function visibleTiles(z, met) {
  const n = Math.pow(2, z), g = state.globe;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, hit = false;
  const N = 12;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const q = unprojectGlobe((i / N) * met.w, (j / N) * met.h, met);
      if (!q) continue;
      hit = true;
      const dl = ((q.lon - g.lon + 540) % 360) - 180;      // unwrapped around the centre
      const fx = (g.lon + dl + 180) / 360 * n;             // may sit outside [0,n): wrapped when drawn
      const fy = lat2merc(q.lat) * n;
      if (fx < minX) minX = fx;
      if (fx > maxX) maxX = fx;
      if (fy < minY) minY = fy;
      if (fy > maxY) maxY = fy;
    }
  }
  if (!hit) return null;
  return {
    n,
    x0: Math.floor(minX) - 1, x1: Math.floor(maxX) + 1,
    y0: Math.max(0, Math.floor(minY) - 1), y1: Math.min(n - 1, Math.floor(maxY) + 1)
  };
}

/* ---- paint the tiles onto the sphere ---------------------------------- */
function drawTiles(z, ctx, cw, ch, met) {
  const range = visibleTiles(z, met);
  if (!range) return;
  const src = activeTileSource().id, n = range.n, g = state.globe;
  const scale = met.s * (cw / met.w);            // CSS units -> canvas pixels
  const R = globeR() * scale, cx = cw / 2, cy = ch / 2;
  const cosp0 = Math.cos(g.lat * RAD), sinp0 = Math.sin(g.lat * RAD);
  // Split each tile until an affine warp of the sphere stays under a pixel.
  const sub = clamp(Math.ceil((360 / n) / 2.5), 1, 4);
  const latMemo = new Map();
  const latAt = (v) => {
    let L = latMemo.get(v);
    if (L === undefined) { L = merc2lat(v / n); latMemo.set(v, L); }
    return L;
  };
  const proj = (lon, lat) => {
    const lam = (lon - g.lon) * RAD, phi = lat * RAD;
    const cosp = Math.cos(phi), sinp = Math.sin(phi), cosl = Math.cos(lam);
    return {
      x: cx + R * (cosp * Math.sin(lam)),
      y: cy - R * (cosp0 * sinp - sinp0 * cosp * cosl),
      vis: sinp0 * sinp + cosp0 * cosp * cosl >= 0
    };
  };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      const got = tileOrAncestor(src, z, ((tx % n) + n) % n, ty);
      if (!got) continue;
      const sw = got.sw / sub, sh = got.sh / sub;
      for (let j = 0; j < sub; j++) {
        const v0 = latAt(ty + j / sub), v1 = latAt(ty + (j + 1) / sub);
        for (let i = 0; i < sub; i++) {
          const u0 = (tx + i / sub) / n * 360 - 180, u1 = (tx + (i + 1) / sub) / n * 360 - 180;
          const P00 = proj(u0, v0), P10 = proj(u1, v0), P01 = proj(u0, v1);
          if (!P00.vis || !P10.vis || !P01.vis) continue;     // straddles the limb: base layer covers it
          if (Math.min(P00.x, P10.x, P01.x) > cw + 8 || Math.max(P00.x, P10.x, P01.x) < -8
            || Math.min(P00.y, P10.y, P01.y) > ch + 8 || Math.max(P00.y, P10.y, P01.y) < -8) continue;
          const a = (P10.x - P00.x) / sw, b = (P10.y - P00.y) / sw;
          const c = (P01.x - P00.x) / sh, d = (P01.y - P00.y) / sh;
          // Stretch the destination a hair so neighbouring quads leave no seam.
          const ov = 0.7 / Math.max(Math.hypot(a, b), 1e-6);
          ctx.setTransform(a, b, c, d, P00.x, P00.y);
          ctx.drawImage(got.img, got.sx + i * sw, got.sy + j * sh, sw, sh, 0, 0, sw + ov, sh + ov);
        }
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Blue Marble below TILE_MIN_Z, tiles above it, and for the middle stretch both:
// the blurry planet fills the limb, the poles (which Mercator has no tiles for)
// and any tile still in flight.
function drawGlobeImagery(moving, met, z) {
  const m = met || stageMetrics();
  if (!m.w || !gCanvas) return;
  const zoom = z === undefined ? tileZoomFor(m) : z;
  const want = state.globe.on && state.satOn && (texData || zoom >= TILE_MIN_Z);
  const disp = want ? 'block' : 'none';
  if (gCanvas.style.display !== disp) gCanvas.style.display = disp;
  if (!want) return;
  if (zoom < TILE_MIN_Z) { paintSphere(gCanvas, moving ? 0.45 : 1); return; }

  const dpr = dprCap();
  const cw = Math.max(2, Math.round(m.w * dpr)), ch = Math.max(2, Math.round(m.h * dpr));
  if (gCanvas.width !== cw || gCanvas.height !== ch) { gCanvas.width = cw; gCanvas.height = ch; }
  const ctx = gCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (zoom < TILE_FLAT_Z && texData) {
    if (!baseCanvas) baseCanvas = document.createElement('canvas');
    if (paintSphere(baseCanvas, 0.3)) ctx.drawImage(baseCanvas, 0, 0, cw, ch);
  }
  drawTiles(zoom, ctx, cw, ch, m);
}

/* ==========================================================================
   EL NINO LAYER — NASA's daily sea temperature anomaly as one whole-world
   equirectangular image: painted onto the sphere on the globe, and laid straight
   into the SVG on the flat map. Full tracker at /el-nino.
   ========================================================================== */
const ENSO_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap'
  + '&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:4326&STYLES=&WIDTH=2048&HEIGHT=1024&BBOX=-180,-90,180,90'
  + '&LAYERS=GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies&TIME=';
// NASA answers 200 with a blank image of about 8 KB for days not yet published.
const ENSO_MIN_BYTES = 50000;
const ENSO_LOOKBACK_DAYS = 7;

async function fetchEnsoImage() {
  for (let back = 1; back <= ENSO_LOOKBACK_DAYS; back++) {
    const date = new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
    try {
      const r = await fetch(ENSO_WMS + date);
      if (!r.ok) continue;
      const blob = await r.blob();
      if (blob.size >= ENSO_MIN_BYTES) return { blob, date };
    } catch (e) { /* try the day before */ }
  }
  return null;
}

async function loadEnsoLayer() {
  if (ensoTex || ensoLoading) return;
  ensoLoading = true;
  syncEnso();
  // The readings are extras: the layer still works if this one fails.
  fetch('/api/enso').then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j) return;
    ensoInfo = j;
    syncEnso(); buildEnsoFlatBoxes(); markGlobeDirty(); scheduleSettle();
  }).catch(() => {});
  const got = await fetchEnsoImage();
  try {
    if (!got) throw new Error('no imagery');
    const url = URL.createObjectURL(got.blob);
    const im = new Image();
    im.src = url;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const cx2 = c.getContext('2d');
    cx2.drawImage(im, 0, 0);
    ensoTex = { data: cx2.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, date: got.date };
    $('#enso-layer').setAttribute('href', url);
  } catch (e) {
    console.warn('El Niño layer unavailable:', e.message);
    toast('Sea temperature imagery is unavailable right now', true);
    ensoOn = false;
    $('#toggle-enso').classList.add('off');
  }
  ensoLoading = false;
  syncEnso(); markGlobeDirty(); scheduleSettle();
}

function syncEnso() {
  const ready = ensoOn && !!ensoTex;
  svg.classList.toggle('enso', ready);
  if (ensoCanvas) ensoCanvas.style.display = ready && state.globe.on ? 'block' : 'none';
  const chip = $('#enso-chip');
  chip.hidden = !ensoOn;
  if (!ensoOn) return;
  const main = ensoInfo && ensoInfo.regions.find((r) => r.id === 'nino34');
  $('#enso-chip-state').textContent = ensoLoading ? 'Loading NASA imagery…'
    : [ensoInfo && ensoInfo.status, main && main.anom != null ? 'Niño 3.4 ' + (main.anom < 0 ? '−' : '+') + Math.abs(main.anom).toFixed(1) + '°C' : ''].filter(Boolean).join(' · ');
  $('#enso-chip-date').textContent = ensoTex ? 'NASA MUR · ' + new Date(ensoTex.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
}

function drawEnso(moving) {
  if (!ensoOn || !ensoTex || !ensoCanvas || !state.globe.on) return;
  // Past this zoom the image's ~20 km pixels would only smother the street imagery.
  const hide = globeTileZoom >= TILE_FLAT_Z;
  const disp = hide ? 'none' : 'block';
  if (ensoCanvas.style.display !== disp) ensoCanvas.style.display = disp;
  if (hide) return;
  if (paintSphere(ensoCanvas, moving ? 0.45 : 1, ensoTex)) drawEnsoGlobeBoxes();
}

const ensoLabel = (r) => r.name + (r.anom == null ? '' : ' ' + (r.anom < 0 ? '−' : '+') + Math.abs(r.anom).toFixed(1) + '°C');

function drawEnsoGlobeBoxes() {
  if (!ensoInfo) return;
  const met = stageMetrics();
  const k = ensoCanvas.width / met.w;
  const X = (p) => ensoCanvas.width / 2 + (p.x - GX) * met.s * k;
  const Y = (p) => ensoCanvas.height / 2 + (p.y - GY) * met.s * k;
  const ctx = ensoCanvas.getContext('2d');
  for (const r of ensoInfo.regions) {
    const main = r.id === 'nino34';
    const corners = [[r.w, r.n], [r.e, r.n], [r.e, r.s], [r.w, r.s], [r.w, r.n]];
    ctx.beginPath();
    let pen = false;
    for (let c = 0; c < 4; c++) {
      const steps = Math.max(1, Math.round(Math.abs(corners[c + 1][0] - corners[c][0]) / 3));
      for (let i = 0; i <= steps; i++) {
        const p = globeProject(corners[c][0] + (corners[c + 1][0] - corners[c][0]) * i / steps, corners[c][1] + (corners[c + 1][1] - corners[c][1]) * i / steps);
        if (!p.vis) { pen = false; continue; }
        if (pen) ctx.lineTo(X(p), Y(p)); else ctx.moveTo(X(p), Y(p));
        pen = true;
      }
    }
    ctx.setLineDash(main ? [] : [5 * k, 4 * k]);
    ctx.lineWidth = (main ? 2 : 1) * k;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.setLineDash([]);
    const at = globeProject(r.w, r.id === 'nino12' ? r.s : r.n);
    if (!at.vis) continue;
    const text = ensoLabel(r);
    ctx.font = (main ? '600 ' : '') + (11 * k) + 'px system-ui, sans-serif';
    // Niño 3 and 4 share a top edge: on a small globe their labels would overlap, so they drop out.
    if (r.id === 'nino3' || r.id === 'nino4') {
      const east = globeProject(r.e, r.n);
      if (!east.vis || X(east) - X(at) < ctx.measureText(text).width) continue;
    }

    // Niño 3.4 sits inside Niño 3 and Niño 4 along the same top edge: lift its label clear.
    const ly = Y(at) + (r.id === 'nino12' ? 14 : r.id === 'nino34' ? -18 : -4) * k;
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, X(at) + 2 * k, ly);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, X(at) + 2 * k, ly);
  }
}

// Flat map: plain SVG rectangles, split where a box crosses the date line.
function buildEnsoFlatBoxes() {
  const g = $('#enso-boxes');
  if (!g || !ensoInfo) return;
  const NS = 'http://www.w3.org/2000/svg';
  g.textContent = '';
  const rect = (w, e, r) => {
    const [x0, y0] = project(w, r.n), [x1, y1] = project(e, r.s);
    const el = document.createElementNS(NS, 'rect');
    el.setAttribute('x', x0); el.setAttribute('y', y0);
    el.setAttribute('width', x1 - x0); el.setAttribute('height', y1 - y0);
    if (r.id === 'nino34') el.setAttribute('class', 'main');
    g.appendChild(el);
  };
  for (const r of ensoInfo.regions) {
    if (r.w < 180 && r.e > 180) { rect(r.w, 180, r); rect(-180, r.e - 360, r); }
    else if (r.w >= 180) rect(r.w - 360, r.e - 360, r);
    else rect(r.w, r.e, r);
    const lon = r.w >= 180 ? r.w - 360 : r.w;
    const [x, y] = project(lon, r.id === 'nino12' ? r.s : r.n);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x + 1);
    t.setAttribute('y', y + (r.id === 'nino12' ? 9 : r.id === 'nino34' ? -9 : -2));
    t.textContent = ensoLabel(r);
    g.appendChild(t);
  }
}

/* ---- the patch of world currently on screen (used to cull vectors) ----- */
function visibleWindow(met) {
  const g = state.globe;
  const half = Math.hypot(met.w, met.h) / 2;
  const th = (half >= met.R ? 90 : Math.asin(clamp(half / met.R, 0, 1)) / RAD) * 1.25 + 2;
  const away = clamp(Math.abs(g.lat) - th, 0, 89);            // closest approach to the equator
  const lonHalf = th >= 89 ? 180 : Math.min(180, th / Math.max(Math.cos(away * RAD), 0.08));
  return { latMin: g.lat - th, latMax: g.lat + th, lon: g.lon, lonHalf };
}
function inWindow(bb, win) {                                  // bb = [lonMin, latMin, lonMax, latMax]
  if (bb[3] < win.latMin || bb[1] > win.latMax) return false;
  if (win.lonHalf >= 180) return true;
  const mid = (bb[0] + bb[2]) / 2;
  const d = Math.abs(((mid - win.lon + 540) % 360) - 180);
  return d - (bb[2] - bb[0]) / 2 <= win.lonHalf;
}

/* ---- scale bar + imagery credit --------------------------------------- */
const SCALE_STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000,
  25000, 50000, 100000, 250000, 500000, 1000000, 2000000, 5000000];
function updateMapChrome(met, z) {
  const credit = $('#map-credit'), bar = $('#map-scale');
  if (!credit || !bar) return;
  const tiles = state.globe.on && state.satOn && z >= TILE_MIN_Z;
  const txt = tiles ? activeTileSource().credit : '';
  if (credit.textContent !== txt) credit.textContent = txt;
  credit.classList.toggle('show', tiles);

  const mPerPx = EARTH_R_M / Math.max(met.R, 1);
  let pick = SCALE_STEPS[SCALE_STEPS.length - 1];
  for (const v of SCALE_STEPS) { if (v >= mPerPx * 110) { pick = v; break; } }
  const label = pick >= 1000 ? (pick / 1000) + ' km' : pick + ' m';
  if (label !== lastScaleTxt) {
    lastScaleTxt = label;
    bar.querySelector('.ms-txt').textContent = label;
    bar.querySelector('.ms-bar').style.width = Math.round(pick / mPerPx) + 'px';
  }
  bar.classList.toggle('show', state.globe.on);
}

// Deep zoom has nothing to show but imagery, so turn it on rather than
// dropping the user onto a blank sphere.
function ensureImagery() {
  if (state.satOn) return;
  state.satOn = true;
  svg.classList.add('sat');
  $('#toggle-sat').classList.remove('off');
  loadTexture();
  syncSatCanvas();
}

// Zoom about a screen point, Google-Maps style: whatever sits under the pointer
// stays under the pointer. Solved by iterating the residual, which converges in
// two or three passes and stays stable at every zoom level.
function zoomGlobeAt(factor, px, py) {
  const g = state.globe;
  const met = stageMetrics();
  const anchor = unprojectGlobe(px, py, met);
  g.scale = clamp(g.scale * factor, 1, globeMaxScale());
  g.auto = false;
  if (anchor) {
    for (let i = 0; i < 4; i++) {
      const R = globeR() * met.s;
      const p = globeProject(anchor.lon, anchor.lat);
      const dx = px - (met.w / 2 + (p.x - GX) * met.s);
      const dy = py - (met.h / 2 + (p.y - GY) * met.s);
      if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08) break;
      const degPerPx = 1 / (R * RAD);
      g.lon = ((g.lon - dx * degPerPx / Math.max(Math.cos(g.lat * RAD), 0.05) + 540) % 360) - 180;
      g.lat = clamp(g.lat + dy * degPerPx, -85, 85);
    }
  }
  if (tileZoomFor(stageMetrics()) >= TILE_MIN_Z) ensureImagery();
  markGlobeDirty();
  scheduleSettle();
}

/* ==========================================================================
   LIVE SATELLITES — real TLE orbital elements from CelesTrak, propagated with
   SGP4 (satellite.js) and drawn as dots orbiting the sphere at true altitude.
   ========================================================================== */
const SAT_GROUPS = [
  { group: 'starlink', color: '#7fe3ff', r: 0.9, cap: 700 },
  { group: 'stations', color: '#ffd54a', r: 1.9, cap: 30 },
  { group: 'oneweb',   color: '#9a7bff', r: 0.9, cap: 200 },
  { group: 'gps-ops',  color: '#5ce08c', r: 1.4, cap: 35 },
];
function parseTLE(text, meta) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const sats = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    if (lines[i + 1][0] !== '1' || lines[i + 2][0] !== '2') continue;
    sats.push({ name: lines[i].trim(), l1: lines[i + 1], l2: lines[i + 2] });
  }
  // spread-sample down to the cap so global coverage is preserved
  let picked = sats;
  if (sats.length > meta.cap) { const step = sats.length / meta.cap; picked = []; for (let k = 0; k < meta.cap; k++) picked.push(sats[Math.floor(k * step)]); }
  const recs = [];
  for (const s of picked) {
    try { const rec = satellite.twoline2satrec(s.l1, s.l2); if (rec && !rec.error) recs.push({ satrec: rec, name: s.name, color: meta.color, r: meta.r, pos: null }); } catch (e) {}
  }
  return recs;
}
async function loadSatellites() {
  if (satData.length || orbitsLoading || typeof satellite === 'undefined') return;
  orbitsLoading = true;
  $('#orbit-count').textContent = ' ·…';
  try {
    const results = await Promise.all(SAT_GROUPS.map(async (meta) => {
      try { return parseTLE(await fetchText(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${meta.group}&FORMAT=tle`), meta); }
      catch (e) { return []; }
    }));
    satData = results.flat();
    propagateSats();
    $('#orbit-count').textContent = satData.length ? ' · ' + satData.length : '';
    syncSatOrbits();
  } catch (e) { console.warn('satellites unavailable:', e.message); $('#orbit-count').textContent = ''; }
  orbitsLoading = false;
}
function propagateSats() {
  if (!satData.length || typeof satellite === 'undefined') return;
  const now = new Date();
  const gmst = satellite.gstime(now);
  for (const s of satData) {
    try {
      const pv = satellite.propagate(s.satrec, now);
      if (!pv || !pv.position) { s.pos = null; continue; }
      const geo = satellite.eciToGeodetic(pv.position, gmst);
      s.pos = { lat: satellite.degreesLat(geo.latitude), lon: satellite.degreesLong(geo.longitude), alt: geo.height };
    } catch (e) { s.pos = null; }
  }
  satLastProp = performance.now();
}
function drawSats() {
  if (!satCanvas) return;
  const rect = stage.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.round(rect.width * dpr), ch = Math.round(rect.height * dpr);
  if (satCanvas.width !== cw || satCanvas.height !== ch) { satCanvas.width = cw; satCanvas.height = ch; }
  const ctx = satCanvas.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);
  const s = Math.min(rect.width / W, rect.height / H) * dpr;
  const offX = (cw - W * s) / 2, offY = (ch - H * s) / 2;
  for (const sat of satData) {
    if (!sat.pos) continue;
    const p = globeProject(sat.pos.lon, sat.pos.lat);
    if (p.z < -0.06) continue;                                   // behind the sphere
    const altF = 1 + Math.min(sat.pos.alt, 3000) / 6371;
    const px = offX + (GX + (p.x - GX) * altF) * s;
    const py = offY + (GY + (p.y - GY) * altF) * s;
    const rad = sat.r * dpr;
    if (sat.r >= 1.4) { ctx.beginPath(); ctx.arc(px, py, rad + 1.6 * dpr, 0, 6.283); ctx.fillStyle = sat.color + '30'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(px, py, rad, 0, 6.283); ctx.fillStyle = sat.color; ctx.fill();
  }
}
function syncSatOrbits() {
  const show = orbitsOn && state.globe.on && satData.length > 0;
  if (satCanvas) satCanvas.style.display = show ? 'block' : 'none';
  const lg = $('#sat-legend'); if (lg) lg.classList.toggle('show', show);
  if (!show && satCanvas) { const c = satCanvas.getContext('2d'); if (c) c.clearRect(0, 0, satCanvas.width, satCanvas.height); }
}

/* ==========================================================================
   LIVE FLIGHTS — real ADS-B aircraft on the globe.
   Positions arrive every few seconds at best, so each aircraft is dead-reckoned
   along a great circle from its own fix time on every frame: planes drift
   continuously instead of teleporting, and a stale snapshot still looks live.
   Zoomed out they are altitude-coloured dots; zoom in and they become real
   silhouettes turned to their track, growing to true size against the ground.
   ========================================================================== */
const FLIGHT_LOCAL_MS = 9000;      // regional refresh
const FLIGHT_GLOBAL_MS = 120000;   // global refresh (the endpoint caches 4 min)
const FLIGHT_MIN_MS = 4000;        // floor between requests, however much the view moves
const FLIGHT_STALE_S = 900;        // stop dead-reckoning a fix this old; it is fiction by now
const FLIGHT_MIN_NM = 90;          // always fetch at least this wide, however close in you are
const FLIGHT_MAX_NM = 250;         // community ADS-B feeds cap their radius here
const FLIGHT_ICON_Z = 8;           // tile zoom where dots turn into aircraft
const FLIGHT_LABEL_Z = 11;         // ...and where callsign labels appear
const FLIGHT_SPAN_M = 45;          // nominal wingspan, for drawing at true scale
let flightCanvas = null, flights = [], flightHits = [], flightHitN = 0;
let flightsOn = false, flightsLoading = false, flightKey = '', flightAt = 0;
let flightMode = '', flightNote = '', flightHover = null, flightFollow = null, flightFollowMiss = 0;
let flightDistNm = 0, flightNoteShown = null;
let flightSel = null, flightRouteShown = null;

// Altitude ramp: warm down on the deck, cool up in the flight levels.
const FLIGHT_BANDS = [
  [0, 255, 138, 61], [1500, 255, 200, 74], [4500, 92, 224, 140],
  [8000, 56, 225, 255], [11000, 154, 123, 255], [14000, 236, 241, 255],
];
function flightRampColor(alt) {
  const a = Math.max(0, alt || 0);
  let i = 0;
  while (i < FLIGHT_BANDS.length - 1 && a > FLIGHT_BANDS[i + 1][0]) i++;
  const lo = FLIGHT_BANDS[i], hi = FLIGHT_BANDS[Math.min(i + 1, FLIGHT_BANDS.length - 1)];
  const t = hi[0] === lo[0] ? 0 : clamp((a - lo[0]) / (hi[0] - lo[0]), 0, 1);
  return 'rgb(' + Math.round(lo[1] + (hi[1] - lo[1]) * t) + ','
    + Math.round(lo[2] + (hi[2] - lo[2]) * t) + ','
    + Math.round(lo[3] + (hi[3] - lo[3]) * t) + ')';
}
// Quantised into a fixed palette: assigning ctx.fillStyle costs a CSS colour
// parse, so thousands of unique strings per frame is the difference between
// a smooth globe and a stuttering one. 24 steps reads as a continuous ramp.
const FLIGHT_RAMP_N = 24, FLIGHT_RAMP_TOP = 15000;
const flightRamp = [];
for (let i = 0; i < FLIGHT_RAMP_N; i++) flightRamp.push(flightRampColor((i / (FLIGHT_RAMP_N - 1)) * FLIGHT_RAMP_TOP));
const flightBucket = (alt) => clamp(Math.round((Math.max(0, alt || 0) / FLIGHT_RAMP_TOP) * (FLIGHT_RAMP_N - 1)), 0, FLIGHT_RAMP_N - 1);
const flightColor = (alt) => flightRamp[flightBucket(alt)];
const flightDots = [];             // per-bucket [x,y,…], reused every frame

// Top-down airliner, nose at -y, spanning 22 units. Built once.
let planePath = null;
const planeGlyph = () => (planePath || (planePath = new Path2D(
  'M0 -11 L1.8 -6.5 L1.8 -1.5 L11 3.6 L11 5.8 L1.8 3.9 L1.8 8.2 L4.6 10.4 L4.6 11.8 '
  + 'L0 10.6 L-4.6 11.8 L-4.6 10.4 L-1.8 8.2 L-1.8 3.9 L-11 5.8 L-11 3.6 L-1.8 -1.5 L-1.8 -6.5 Z')));

// Parked or taxiing: the feed reports these as "ground", which lands here as
// zero altitude, and nothing on a stand exceeds a slow taxi.
const onGround = (f) => f.alt < 30 && f.spd < 13;
const ftOf = (m) => Math.round((m || 0) / 0.3048);
const ktOf = (ms) => Math.round((ms || 0) / 0.514444);
// Airlines quote a flight level above the transition altitude, feet below it.
const altLabel = (m) => (m >= 5500 ? 'FL' + String(Math.round(ftOf(m) / 100)).padStart(3, '0') : ftOf(m).toLocaleString() + ' ft');

/* ---- fetching --------------------------------------------------------- */
// Angular radius of what the sphere is currently showing, in nautical miles.
function flightViewNm(met) {
  const half = Math.hypot(met.w, met.h) / 2;
  const th = met.R > 0 ? Math.asin(clamp(half / met.R, 0, 1)) : Math.PI / 2;
  return th * 6371 / 1.852;
}
async function refreshFlights(force) {
  if (!flightsOn || !state.globe.on || flightsLoading) return;
  const g = state.globe, met = stageMetrics();
  const nm = flightViewNm(met);
  const local = nm <= FLIGHT_MAX_NM;
  // Always pull a wide ring, not just what is on screen: zoomed right in, the
  // view can be a few miles across while the nearest traffic is 60+ nm out. The
  // surplus is culled when drawn, but it means aircraft fly *into* view instead
  // of popping into existence, and thin regions still show something.
  const dist = clamp(Math.ceil(nm * 1.3), FLIGHT_MIN_NM, FLIGHT_MAX_NM);
  flightDistNm = dist;
  // Rounded centre, so small pans reuse the same request instead of re-fetching.
  const key = local ? 'l' + Math.round(g.lat * 2) / 2 + ',' + Math.round(g.lon * 2) / 2 + ',' + dist : 'g';
  const since = performance.now() - flightAt;
  const due = since > (local ? FLIGHT_LOCAL_MS : FLIGHT_GLOBAL_MS);
  if (!force && key === flightKey && !due) return;
  // A changed region normally refetches at once, but never faster than this —
  // panning and follow-mode both move the centre continuously. Crossing between
  // global and regional coverage is a real mode change, so it skips the floor.
  const swap = (local && flightKey === 'g') || (!local && flightKey.charAt(0) === 'l');
  if (!force && since < FLIGHT_MIN_MS && !swap) return;
  flightsLoading = true;
  flightKey = key;
  flightAt = performance.now();
  try {
    const data = await jget(local
      ? '/api/flights?lat=' + g.lat.toFixed(3) + '&lon=' + g.lon.toFixed(3) + '&dist=' + dist
      : '/api/flights?global=1');
    if (!flightsOn) return;
    flightMode = data.mode || (local ? 'local' : 'global');
    flightNote = data.error || '';
    const ts = data.ts || Date.now();
    const seen = new Map(flights.map((f) => [f.id, f]));
    flights = (data.flights || []).map((a) => {
      const prev = seen.get(a[0]);
      return {
        id: a[0], cs: a[1] || (prev && prev.cs) || '',
        lat0: a[2], lon0: a[3], lat: a[2], lon: a[3],
        alt0: a[4] || 0, alt: a[4] || 0,
        spd: a[5] || 0, trk: a[6] || 0, vr: a[7] || 0,
        type: a[8] || '', reg: a[9] || '', desc: a[10] || '', cty: a[12] || '',
        t0: ts - (a[11] || 0) * 1000,
      };
    });
    // Re-bind the followed aircraft to its refreshed record; release it once it
    // has genuinely dropped out of coverage rather than chasing a ghost.
    if (flightFollow) {
      const still = flights.find((f) => f.id === flightFollow.id);
      if (still) { flightFollow = still; flightFollowMiss = 0; }
      else if (++flightFollowMiss >= 2) { flightFollow = null; toast('Lost contact with aircraft'); }
    }
    const c = $('#flight-count');
    if (c) c.textContent = flights.length ? ' · ' + flights.length : '';
    syncFlights();
  } catch (e) {
    flightNote = 'Flight feed unavailable';
  } finally {
    flightsLoading = false;
  }
}

/* ---- motion ----------------------------------------------------------- */
// Great-circle dead reckoning from each aircraft's own fix time.
function advanceFlights() {
  const now = Date.now();
  for (const f of flights) {
    const dt = (now - f.t0) / 1000;
    // A feed outage must not let aircraft fly off on their own indefinitely.
    f.stale = dt > FLIGHT_STALE_S;
    if (f.stale || !(dt > 0) || !f.spd) { f.lat = f.lat0; f.lon = f.lon0; f.alt = f.alt0; continue; }
    const dr = (f.spd * dt) / 6371000;
    const br = f.trk * RAD, la = f.lat0 * RAD, lo = f.lon0 * RAD;
    const sinLa = Math.sin(la), cosLa = Math.cos(la);
    const sinDr = Math.sin(dr), cosDr = Math.cos(dr);
    const s2 = clamp(sinLa * cosDr + cosLa * sinDr * Math.cos(br), -1, 1);
    f.lat = Math.asin(s2) / RAD;
    f.lon = ((lo + Math.atan2(Math.sin(br) * sinDr * cosLa, cosDr - sinLa * s2)) / RAD + 540) % 360 - 180;
    f.alt = Math.max(0, f.alt0 + f.vr * dt);
  }
}

/* ---- drawing ---------------------------------------------------------- */
function drawFlights(met) {
  if (!flightCanvas) return;
  const m = met || stageMetrics();
  if (!m.w) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.round(m.w * dpr), ch = Math.round(m.h * dpr);
  if (flightCanvas.width !== cw || flightCanvas.height !== ch) { flightCanvas.width = cw; flightCanvas.height = ch; }
  const ctx = flightCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  flightHitN = 0;
  if (!flightsOn || !flights.length) return;

  const s = m.s * dpr, offX = (cw - W * s) / 2, offY = (ch - H * s) / 2;
  const icons = globeTileZoom >= FLIGHT_ICON_Z;
  const labels = globeTileZoom >= FLIGHT_LABEL_Z;
  // Once the aircraft is genuinely bigger than the minimum glyph, let it grow
  // to true size against the ground — the Google-Earth trick that sells scale.
  const mPerPx = EARTH_R_M / Math.max(m.R, 1);
  const iconPx = clamp(FLIGHT_SPAN_M / mPerPx, 15, 130) * dpr;
  const gs = iconPx / 22;
  const glyph = icons ? planeGlyph() : null;
  let labelled = 0, hotX = -1, hotY = -1;
  if (!icons) for (let i = 0; i < FLIGHT_RAMP_N; i++) { (flightDots[i] || (flightDots[i] = [])).length = 0; }

  // globeProject inlined: at world view this runs thousands of times a frame and
  // the returned object alone would dominate the cost.
  const gl = state.globe, R = globeR();
  const cosp0 = Math.cos(gl.lat * RAD), sinp0 = Math.sin(gl.lat * RAD), lon0 = gl.lon;
  const toScreen = (lon, lat) => {
    const lam = (lon - lon0) * RAD, phi = lat * RAD;
    const cosp = Math.cos(phi), sinp = Math.sin(phi), cosl = Math.cos(lam);
    return {
      x: offX + (GX + R * cosp * Math.sin(lam)) * s,
      y: offY + (GY - R * (cosp0 * sinp - sinp0 * cosp * cosl)) * s,
      vis: sinp0 * sinp + cosp0 * cosp * cosl >= 0,
    };
  };
  if (flightRouteShown && flightSel) drawFlightLeg(ctx, dpr, toScreen);
  for (const f of flights) {
    if (f.stale) continue;
    const lam = (f.lon - lon0) * RAD, phi = f.lat * RAD;
    const cosp = Math.cos(phi), sinp = Math.sin(phi), cosl = Math.cos(lam);
    if (sinp0 * sinp + cosp0 * cosp * cosl < 0) continue;              // far side of the globe
    const x = offX + (GX + R * cosp * Math.sin(lam)) * s;
    const y = offY + (GY - R * (cosp0 * sinp - sinp0 * cosp * cosl)) * s;
    if (x < -60 || y < -60 || x > cw + 60 || y > ch + 60) continue;
    const sel = flightFollow && flightFollow.id === f.id;
    const hot = sel || (flightHover && flightHover.id === f.id);

    if (!icons) {
      if (hot) { hotX = x; hotY = y; }             // painted after the batches
      else flightDots[flightBucket(f.alt)].push(x, y);
    } else {
      const col = flightColor(f.alt);
      const parked = onGround(f);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(x, y);
      ctx.rotate(f.trk * RAD);
      ctx.scale(gs, gs);
      // Parked and taxiing aircraft are dimmed and cast no shadow — otherwise an
      // airliner sitting on a stand looks exactly like one in the cruise.
      ctx.globalAlpha = parked ? 0.45 : 1;
      if (!parked) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';         // depth cue: reads as "above the ground"
        ctx.translate(0, 2.4);
        ctx.fill(glyph);
        ctx.translate(0, -2.4);
      }
      ctx.fillStyle = col;
      ctx.fill(glyph);
      if (hot) {
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = sel ? '#ffffff' : 'rgba(255,255,255,0.8)';
        ctx.stroke(glyph);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (labels && (labelled < 45 || hot) && (f.cs || f.reg)) {
        labelled++;
        const tag = (f.cs || f.reg).trim();
        const sub = parked ? 'on the ground' : altLabel(f.alt) + ' · ' + ktOf(f.spd) + ' kt';
        const px = x + iconPx * 0.62, py = y - iconPx * 0.1;
        ctx.font = (11 * dpr) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
        const wTag = ctx.measureText(tag).width;
        ctx.font = (9.5 * dpr) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
        const wSub = ctx.measureText(sub).width;
        const bw = Math.max(wTag, wSub) + 10 * dpr, bh = 26 * dpr;
        ctx.fillStyle = 'rgba(8,10,16,0.78)';
        ctx.fillRect(px, py - 2 * dpr, bw, bh);
        ctx.fillStyle = col;
        ctx.font = (11 * dpr) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(tag, px + 5 * dpr, py + 10 * dpr);
        ctx.fillStyle = 'rgba(223,234,255,0.72)';
        ctx.font = (9.5 * dpr) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(sub, px + 5 * dpr, py + 21 * dpr);
      }
    }
    // Hit targets in CSS pixels, for hover and click-to-follow. Pooled: at world
    // view this runs a few thousand times a frame and would otherwise churn the GC.
    const h = flightHits[flightHitN] || (flightHits[flightHitN] = { f: null, x: 0, y: 0, r: 0 });
    h.f = f; h.x = x / dpr; h.y = y / dpr; h.r = icons ? Math.max(7, iconPx / dpr * 0.5) : 4;
    flightHitN++;
  }

  // One fill per altitude band instead of one per aircraft.
  if (!icons) {
    const r = 1.5 * dpr, d = r * 2;
    for (let i = 0; i < FLIGHT_RAMP_N; i++) {
      const b = flightDots[i];
      if (!b || !b.length) continue;
      ctx.fillStyle = flightRamp[i];
      ctx.beginPath();
      for (let k = 0; k < b.length; k += 2) ctx.rect(b[k] - r, b[k + 1] - r, d, d);
      ctx.fill();
    }
    if (hotX >= 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hotX - 2.6 * dpr, hotY - 2.6 * dpr, 5.2 * dpr, 5.2 * dpr);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  setFlightNote();
}


/* ==========================================================================
   FLIGHT ROUTES — which airports an aircraft is flying between.
   ADS-B carries no route information at all: a transponder broadcasts position
   and callsign, not a flight plan. The callsign is the key, and adsbdb resolves
   it to the operating airline and both airports (with coordinates, so the leg
   can be drawn). It sends CORS headers, so the browser asks it directly.
   ========================================================================== */
const routeCache = new Map();          // callsign -> route | null (null = looked up, nothing known)
let routePending = new Set();

async function flightRoute(cs) {
  const key = (cs || '').trim().toUpperCase();
  if (!key || key.length < 3) return null;
  if (routeCache.has(key)) return routeCache.get(key);
  if (routePending.has(key)) return null;
  routePending.add(key);
  try {
    const r = await fetch('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(key), { cache: 'no-store' });
    let out = null;
    if (r.ok) {
      const j = await r.json();
      const fr = j && j.response && j.response.flightroute;
      if (fr && fr.origin && fr.destination) {
        out = {
          iata: fr.callsign_iata || '',
          airline: (fr.airline && fr.airline.name) || '',
          from: airportOf(fr.origin),
          to: airportOf(fr.destination),
        };
      }
    }
    routeCache.set(key, out);
    return out;
  } catch (e) {
    routeCache.set(key, null);
    return null;
  } finally {
    routePending.delete(key);
  }
}
const airportOf = (a) => ({
  iata: a.iata_code || '', icao: a.icao_code || '',
  name: a.name || '', city: a.municipality || '', country: a.country_name || '',
  lat: +a.latitude, lon: +a.longitude,
});

/* ---- the selected aircraft's card ------------------------------------- */
function flightCardHtml(f, route) {
  const name = (f.cs || f.reg || f.id).trim();
  const kind = f.desc || f.type || (f.cty ? 'Registered ' + f.cty : '');
  const leg = route
    ? '<div class="fc-route">'
      + airportBlock(route.from, 'from')
      + '<span class="fc-arrow">' + (onGround(f) ? '·' : '✈') + '</span>'
      + airportBlock(route.to, 'to')
      + '</div>'
      + (route.airline ? '<div class="fc-airline">' + escapeHtml(route.airline)
        + (route.iata ? ' · ' + escapeHtml(route.iata) : '') + '</div>' : '')
    : '<div class="fc-noroute">Route not published for this callsign</div>';
  return '<div class="fc-head"><span class="fc-name">✈ ' + escapeHtml(name) + '</span>'
    + '<button class="fc-close" type="button" aria-label="Close">✕</button></div>'
    + leg
    + '<div class="fc-stats">'
    + statChip(onGround(f) ? 'On ground' : altLabel(f.alt), 'altitude')
    + statChip(ktOf(f.spd) + ' kt', 'ground speed')
    + statChip(Math.round(f.trk) + '°', 'track')
    + '</div>'
    + (kind ? '<div class="fc-type">' + escapeHtml(kind) + (f.reg && f.cs ? ' · ' + escapeHtml(f.reg) : '') + '</div>' : '')
    + '<div class="fc-foot"><span class="fc-follow"></span></div>';
}
const statChip = (v, lbl) => '<span class="fc-stat"><b>' + escapeHtml(String(v)) + '</b><i>' + lbl + '</i></span>';
function airportBlock(a, cls) {
  if (!a || !a.iata) return '<span class="fc-ap ' + cls + '"><b>—</b></span>';
  return '<span class="fc-ap ' + cls + '" title="' + escapeHtml(a.name) + '">'
    + '<b>' + escapeHtml(a.iata) + '</b>'
    + '<i>' + escapeHtml(a.city || a.country || '') + '</i></span>';
}

function openFlightCard(f) {
  flightSel = f;
  const card = $('#flight-card');
  if (!card) return;
  card.hidden = false;
  const paint = (route) => {
    if (!flightSel || flightSel.id !== f.id) return;
    flightRouteShown = route || null;
    card.innerHTML = flightCardHtml(f, route);
    card.querySelector('.fc-close').onclick = closeFlightCard;
    const fol = card.querySelector('.fc-follow');
    const sync = () => {
      const on = flightFollow && flightFollow.id === f.id;
      fol.textContent = on ? '◉ Following — click to release' : '○ Click to follow';
      fol.classList.toggle('on', !!on);
    };
    fol.onclick = () => { followFlight(f); sync(); };
    sync();
    markGlobeDirty();
  };
  paint(routeCache.get((f.cs || '').trim().toUpperCase()));
  flightRoute(f.cs).then(paint);
}
function closeFlightCard() {
  flightSel = null;
  flightRouteShown = null;
  const card = $('#flight-card');
  if (card) { card.hidden = true; card.innerHTML = ''; }
  markGlobeDirty();
}

/* ---- the leg drawn on the globe --------------------------------------- */
// Great-circle interpolation, so a route bends the way it really flies rather
// than cutting a straight line across the projection.
function greatCircle(a, b, n) {
  const r = Math.PI / 180;
  const la1 = a.lat * r, lo1 = a.lon * r, la2 = b.lat * r, lo2 = b.lon * r;
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
  const pts = [];
  if (!isFinite(d) || d < 1e-9) return [[a.lon, a.lat]];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    pts.push([Math.atan2(y, x) / r, Math.atan2(z, Math.hypot(x, y)) / r]);
  }
  return pts;
}

// The selected aircraft's leg: origin → destination as a great circle, with
// both airports marked. Drawn beneath the traffic so planes stay readable.
function drawFlightLeg(ctx, dpr, toScreen) {
  const r = flightRouteShown;
  if (!r || !r.from || !r.to || !isFinite(r.from.lat) || !isFinite(r.to.lat)) return;
  const pts = greatCircle(r.from, r.to, 96);
  ctx.save();
  ctx.lineWidth = 1.6 * dpr;
  ctx.strokeStyle = 'rgba(56,225,255,0.75)';
  ctx.setLineDash([6 * dpr, 5 * dpr]);
  ctx.beginPath();
  let pen = false;
  for (const [lon, lat] of pts) {
    const p = toScreen(lon, lat);
    if (!p.vis) { pen = false; continue; }          // behind the globe
    if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    pen = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [ap, fill] of [[r.from, '#5ce08c'], [r.to, '#ff5a6e']]) {
    const p = toScreen(ap.lon, ap.lat);
    if (!p.vis) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5 * dpr, 0, 6.283);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.4 * dpr;
    ctx.strokeStyle = 'rgba(8,10,16,0.9)';
    ctx.stroke();
    if (ap.iata) {
      ctx.font = (10.5 * dpr) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
      const w = ctx.measureText(ap.iata).width + 8 * dpr;
      ctx.fillStyle = 'rgba(8,10,16,0.82)';
      ctx.fillRect(p.x + 7 * dpr, p.y - 8 * dpr, w, 15 * dpr);
      ctx.fillStyle = fill;
      ctx.fillText(ap.iata, p.x + 11 * dpr, p.y + 3 * dpr);
    }
  }
  ctx.restore();
}

/* ---- interaction ------------------------------------------------------ */
function flightUnder(cx, cy) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < flightHitN; i++) {
    const h = flightHits[i];
    const d = Math.hypot(h.x - cx, h.y - cy);
    if (d < h.r && d < bestD) { bestD = d; best = h.f; }
  }
  return best;
}
function flightTip(f) {
  const name = (f.cs || f.reg || f.id).trim();
  // Aircraft type only ever comes from the ADS-B feeds; the global feed knows
  // only the operator's country, which must not be dressed up as a type.
  const kind = f.desc || f.type || '';
  const sub = kind
    ? escapeHtml(kind) + (f.reg && f.cs ? ' · ' + escapeHtml(f.reg) : '')
    : (f.cty ? 'Registered ' + escapeHtml(f.cty) : '');
  const parked = onGround(f);
  const climb = f.vr > 1.5 ? '↑ climbing' : f.vr < -1.5 ? '↓ descending' : '→ level';
  return '<div class="tt-title">✈ ' + escapeHtml(name) + '</div>'
    + (sub ? '<div class="tt-meta">' + sub + '</div>' : '')
    + '<div class="tt-meta">' + (parked
      ? 'On the ground' + (f.spd > 1 ? ' · taxiing ' + ktOf(f.spd) + ' kt' : ' · stationary')
      : altLabel(f.alt) + ' · ' + ktOf(f.spd) + ' kt · ' + Math.round(f.trk) + '°') + '</div>'
    + (parked ? '' : '<div class="tt-meta">' + climb + (Math.abs(f.vr) > 1.5 ? ' ' + Math.abs(Math.round(f.vr * 196.85)) + ' ft/min' : '') + '</div>')
    + '<span class="tt-sev" style="background:rgba(56,225,255,0.13);color:var(--cyan);border:1px solid rgba(56,225,255,0.4)">'
    + (flightFollow && flightFollow.id === f.id ? 'Following — click to release' : 'Click to follow') + '</span>';
}
function followFlight(f) {
  if (flightFollow && f && flightFollow.id === f.id) {
    flightFollow = null;
    toast('Released');
    return;
  }
  flightFollow = f;
  flightFollowMiss = 0;
  state.globe.auto = false;
  toast('Following ' + (f.cs || f.reg || f.id).trim());
  markGlobeDirty();
}
// An empty sky is usually real — ADS-B receiver cover is thin outside Europe and
// North America — so say which it is rather than leaving a blank layer that
// looks broken. Cheap enough to call every frame; only touches the DOM on change.
function setFlightNote() {
  const el = $('#flight-note');
  if (!el) return;
  let msg = flightNote;
  if (!msg) {
    if (flightMode === 'global') msg = 'Whole planet · zoom in for detail';
    else if (!flights.length) msg = 'No aircraft within ' + flightDistNm + ' nm — ADS-B cover is thin here';
    else if (!flightHitN) msg = flights.length + ' within ' + flightDistNm + ' nm · none in view yet';
    else msg = '';
  }
  if (msg === flightNoteShown) return;
  flightNoteShown = msg;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}

/* ==========================================================================
   TRAFFIC CAMERAS — public road-authority CCTV, plotted where it actually is.
   Camera positions are static, so they are fetched per viewport and only
   re-fetched when you leave the box that was loaded. The pictures themselves
   are live: clicking one opens the authority's own image and re-pulls it on a
   timer, cache-busted, for as long as the card is open.
   ========================================================================== */
const CAM_ICON_Z = 7;              // tile zoom where dots become camera glyphs
const CAM_REFRESH_MS = 5000;       // how often an open camera image re-pulls
const CAM_COLOR = '#ff7ac6';        // still-image cameras
const CAM_LIVE_COLOR = '#ff3b52';   // cameras that carry real video
let camCanvas = null, cams = [], camHits = [], camHitN = 0;
let camsOn = false, camsLoading = false, camBox = null, camNote = '', camNoteShown = null;
let camSources = [], camTotal = 0, camOpen = null, camTimer = 0, camHls = null, hlsPending = null;

// The HLS player is 290KB, the layer is off by default and most cameras are
// stills — so it is only fetched the first time a video camera is opened.
function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsPending) return hlsPending;
  hlsPending = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'hls.light.min.js';
    s.onload = () => res(window.Hls);
    s.onerror = () => { hlsPending = null; rej(new Error('player unavailable')); };
    document.head.appendChild(s);
  });
  return hlsPending;
}
function stopStream() {
  if (camHls) { try { camHls.destroy(); } catch (e) { /* already gone */ } camHls = null; }
}
// hls.js where MSE exists (it transmuxes the MPEG-TS segments browsers can't
// feed to MSE directly); native HLS only where there is no MSE, i.e. iOS.
async function startStream(video, url, onFail) {
  try {
    const Hls = await loadHls();
    if (Hls && Hls.isSupported()) {
      stopStream();
      const h = new Hls({ liveDurationInfinity: true, maxBufferLength: 12, manifestLoadingTimeOut: 12000 });
      camHls = h;
      h.on(Hls.Events.ERROR, (_, d) => { if (d && d.fatal) { stopStream(); onFail(); } });
      h.loadSource(url);
      h.attachMedia(video);
      video.play().catch(() => { /* autoplay policy; the poster still shows */ });
      return;
    }
  } catch (e) { /* fall through to native */ }
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.play().catch(() => {});
    return;
  }
  onFail();
}

// Lon/lat box the sphere is currently showing. Sampling a grid and inverse-
// projecting is the only robust way to do this on a globe — the visible patch
// is a curved cap, not a rectangle.
function viewBBox(met) {
  const g = state.globe;
  let minLat = 90, maxLat = -90, minD = 180, maxD = -180, hit = false, edge = false;
  const N = 10;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const q = unprojectGlobe((i / N) * met.w, (j / N) * met.h, met);
      if (!q) { edge = true; continue; }         // sample fell off the sphere
      hit = true;
      const d = ((q.lon - g.lon + 540) % 360) - 180;
      if (q.lat < minLat) minLat = q.lat;
      if (q.lat > maxLat) maxLat = q.lat;
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
    }
  }
  if (!hit) return null;
  if (edge || maxD - minD > 170) return { w: -180, s: -90, e: 180, n: 90, whole: true };
  const pad = Math.max(0.35, (maxD - minD) * 0.25);
  const wrap = (v) => ((v + 540) % 360) - 180;
  return {
    w: wrap(g.lon + minD - pad), e: wrap(g.lon + maxD + pad),
    s: Math.max(-90, minLat - pad), n: Math.min(90, maxLat + pad),
    whole: false,
  };
}
// Has the view left the box we loaded for?
function camBoxStale(b) {
  if (!camBox) return true;
  if (camBox.whole !== b.whole) return true;
  if (b.whole) return false;
  const inside = (v, lo, hi) => (lo <= hi ? v >= lo && v <= hi : v >= lo || v <= hi);
  return !(inside(b.w, camBox.w, camBox.e) && inside(b.e, camBox.w, camBox.e)
    && b.s >= camBox.s && b.n <= camBox.n);
}

async function refreshCams(force) {
  if (!camsOn || !state.globe.on || camsLoading) return;
  const box = viewBBox(stageMetrics());
  if (!box) return;
  if (!force && !camBoxStale(box)) return;
  camsLoading = true;
  try {
    const q = box.whole ? '?limit=1500'
      : '?limit=1500&bbox=' + [box.w, box.s, box.e, box.n].map((v) => v.toFixed(3)).join(',');
    const data = await jget('/api/webcams' + q);
    if (!camsOn) return;
    camSources = data.sources || camSources;
    camTotal = data.total || camTotal;
    camNote = data.error || '';
    cams = (data.cams || []).map((c) => ({ id: c[0], lat: c[1], lon: c[2], name: c[3], img: c[4], src: c[5], stream: c[6] || '' }));
    camBox = box;
    const n = $('#cam-count');
    if (n) n.textContent = cams.length ? ' · ' + cams.length : '';
    syncCams();
    markGlobeDirty();          // cameras only paint on a globe redraw, so ask for one
  } catch (e) {
    camNote = 'Camera index unavailable';
  } finally {
    camsLoading = false;
  }
}

/* ---- drawing ---------------------------------------------------------- */
function drawCams(met) {
  if (!camCanvas) return;
  const m = met || stageMetrics();
  if (!m.w) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.round(m.w * dpr), ch = Math.round(m.h * dpr);
  if (camCanvas.width !== cw || camCanvas.height !== ch) { camCanvas.width = cw; camCanvas.height = ch; }
  const ctx = camCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  camHitN = 0;
  if (!camsOn || !cams.length) return;

  const s = m.s * dpr, offX = (cw - W * s) / 2, offY = (ch - H * s) / 2;
  const icons = globeTileZoom >= CAM_ICON_Z;
  const r = (icons ? 4.2 : 2.6) * dpr;
  const gl = state.globe, R = globeR();
  const cosp0 = Math.cos(gl.lat * RAD), sinp0 = Math.sin(gl.lat * RAD), lon0 = gl.lon;

  // Two batches: cameras that stream video, and cameras that are only stills.
  // Telling them apart before you click is the whole point — most authorities
  // publish stills, and a still will never move however long you watch it.
  const live = [], still = [], marks = [];
  for (const c of cams) {
    const lam = (c.lon - lon0) * RAD, phi = c.lat * RAD;
    const cosp = Math.cos(phi), sinp = Math.sin(phi), cosl = Math.cos(lam);
    if (sinp0 * sinp + cosp0 * cosp * cosl < 0) continue;
    const x = offX + (GX + R * cosp * Math.sin(lam)) * s;
    const y = offY + (GY - R * (cosp0 * sinp - sinp0 * cosp * cosl)) * s;
    if (x < -30 || y < -30 || x > cw + 30 || y > ch + 30) continue;
    const open = camOpen && camOpen.id === c.id;
    if (open) marks.push(x, y, c.stream ? 1 : 0);
    else (c.stream ? live : still).push(x, y);
    const h = camHits[camHitN] || (camHits[camHitN] = { c: null, x: 0, y: 0, r: 0 });
    h.c = c; h.x = x / dpr; h.y = y / dpr; h.r = Math.max(6, r / dpr + 3);
    camHitN++;
  }
  const blob = (pts, rad) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) { ctx.moveTo(pts[i] + rad, pts[i + 1]); ctx.arc(pts[i], pts[i + 1], rad, 0, 6.283); }
  };
  // Video and stills are told apart by colour and size — NOT by fading stills
  // out. Dimming them to a third of an alpha made a 2px dot over dark ocean
  // effectively invisible, which is why sparse regions looked empty.
  const ring = () => {
    ctx.strokeStyle = 'rgba(8,10,16,0.9)';   // dark outline, so dots read over bright imagery too
    ctx.lineWidth = (icons ? 1.2 : 0.9) * dpr;
    ctx.stroke();
  };
  blob(still, r);
  ctx.fillStyle = CAM_COLOR;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  ring();
  blob(live, r * 1.3);
  ctx.fillStyle = CAM_LIVE_COLOR;
  ctx.fill();
  ring();
  for (let i = 0; i < marks.length; i += 3) {     // the open one, highlighted
    ctx.beginPath();
    ctx.arc(marks[i], marks[i + 1], r + 3 * dpr, 0, 6.283);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(marks[i], marks[i + 1], r, 0, 6.283);
    ctx.fillStyle = marks[i + 2] ? CAM_LIVE_COLOR : CAM_COLOR;
    ctx.fill();
  }
  setCamNote();
}

/* ---- interaction ------------------------------------------------------ */
function camUnder(cx, cy) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < camHitN; i++) {
    const h = camHits[i];
    const d = Math.hypot(h.x - cx, h.y - cy);
    if (d < h.r && d < bestD) { bestD = d; best = h.c; }
  }
  return best;
}
const camSource = (c) => camSources[c.src] || {};
// Some feeds already carry a query string, so pick the right separator.
const camImgUrl = (c) => c.img + (c.img.indexOf('?') < 0 ? '?' : '&') + '_t=' + Date.now();

function openCam(c) {
  camOpen = c;
  stopStream();
  clearInterval(camTimer);
  camTimer = 0;
  const card = $('#cam-card');
  if (!card) return;
  const src = camSource(c);
  card.hidden = false;
  card.className = 'cam-card';
  card.innerHTML =
    '<div class="cc-head"><span class="cc-name"></span><span class="cc-badge"></span>'
    + '<button class="cc-close" type="button" aria-label="Close">✕</button></div>'
    + '<div class="cc-shot">'
    + '<video class="cc-vid" muted autoplay playsinline></video>'
    + '<img alt="" referrerpolicy="no-referrer">'
    + '<div class="cc-fail">Camera unavailable</div></div>'
    + '<div class="cc-foot"><span class="cc-src"></span><span class="cc-age"></span></div>';
  card.querySelector('.cc-name').textContent = c.name;
  card.querySelector('.cc-src').textContent = (src.name || '') + (src.region ? ' · ' + src.region : '');
  card.querySelector('.cc-close').onclick = closeCam;
  const badge = card.querySelector('.cc-badge');
  const age = card.querySelector('.cc-age');
  const img = card.querySelector('img');
  const vid = card.querySelector('video');

  // Stills: the authority refreshes these every 1–15 min, so re-pull on a timer
  // and say plainly that it is a snapshot rather than pretending it is video.
  const stills = () => {
    card.classList.remove('streaming');
    // Some feeds publish a stream and no still at all; don't request an empty URL.
    if (!c.img) {
      card.classList.add('failed');
      badge.textContent = 'OFFLINE';
      badge.className = 'cc-badge snap';
      if (age) age.textContent = '';
      return;
    }
    badge.textContent = 'SNAPSHOT';
    badge.className = 'cc-badge snap';
    const pull = () => {
      if (!camOpen) return;
      img.src = camImgUrl(camOpen);
      if (age) age.textContent = 'pulled ' + new Date().toLocaleTimeString();
    };
    img.onerror = () => card.classList.add('failed');
    img.onload = () => card.classList.remove('failed');
    pull();
    clearInterval(camTimer);
    camTimer = setInterval(pull, CAM_REFRESH_MS);
  };

  if (c.stream) {
    card.classList.add('streaming');
    badge.textContent = 'CONNECTING';
    badge.className = 'cc-badge wait';
    if (age) age.textContent = '';
    // Frames arriving is the real signal, not playback starting: browsers block
    // autoplay in background tabs and under some settings, and a stream sitting
    // there decoded should not read as "connecting" forever.
    const ready = () => {
      if (!camOpen || camOpen.id !== c.id || !vid.videoWidth) return;
      badge.textContent = 'LIVE';
      badge.className = 'cc-badge live';
      if (age) age.textContent = vid.paused ? 'paused — click to play' : 'streaming';
    };
    vid.onloadeddata = ready;
    vid.onplaying = ready;
    vid.onpause = ready;
    vid.onclick = () => { vid.paused ? vid.play().catch(() => {}) : vid.pause(); };
    const giveUp = () => {
      c.stream = '';                       // demote it; the marker turns pink
      for (const o of cams) if (o.id === c.id) o.stream = '';
      markGlobeDirty();
      if (camOpen && camOpen.id === c.id) stills();
    };
    startStream(vid, c.stream, giveUp);
    // No frames within 12s (the player itself has to download on first use) —
    // treat it as unavailable rather than sitting on a blank panel.
    setTimeout(() => {
      if (camOpen && camOpen.id === c.id && card.classList.contains('streaming') && !vid.videoWidth) giveUp();
    }, 12000);
  } else {
    stills();
  }
  markGlobeDirty();
}
function closeCam() {
  camOpen = null;
  clearInterval(camTimer);
  camTimer = 0;
  stopStream();
  const card = $('#cam-card');
  if (card) { card.hidden = true; card.innerHTML = ''; card.className = 'cam-card'; }
  markGlobeDirty();
}
function camTip(c) {
  const src = camSource(c);
  return '<div class="tt-title">📷 ' + escapeHtml(c.name) + '</div>'
    + '<div class="tt-meta">' + escapeHtml((src.name || '') + (src.region ? ' · ' + src.region : '')) + '</div>'
    + '<span class="tt-sev" style="background:rgba(255,122,198,0.14);color:' + CAM_COLOR
    + ';border:1px solid rgba(255,122,198,0.45)">'
    + (c.stream ? 'Click for live video' : 'Click for the latest still') + '</span>';
}
function setCamNote() {
  const el = $('#cam-note');
  if (!el) return;
  let msg = camNote;
  if (!msg && camsOn) {
    if (!cams.length) msg = 'No published cameras here';
    else if (camHitN) msg = '';
    // At world view the loaded set is a global sample, so calling it "nearby"
    // was plainly wrong — those cameras are all over the planet, not near you.
    else if (camBox && camBox.whole) msg = 'None on this face of the globe — spin or zoom in';
    else msg = cams.length + ' within view range · none on screen';
  }
  if (msg === camNoteShown) return;
  camNoteShown = msg;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}
function syncCams() {
  const show = camsOn && state.globe.on;
  if (camCanvas) camCanvas.style.display = show ? 'block' : 'none';
  const lg = $('#cam-legend');
  if (lg) lg.classList.toggle('show', show);
  if (!show) {
    closeCam();
    camHitN = 0;
    if (camCanvas) {
      const c = camCanvas.getContext('2d');
      if (c) c.clearRect(0, 0, camCanvas.width, camCanvas.height);
    }
  }
  setCamNote();
}

function syncFlights() {
  const show = flightsOn && state.globe.on;
  if (!show) closeFlightCard();
  if (flightCanvas) flightCanvas.style.display = show ? 'block' : 'none';
  const lg = $('#flight-legend');
  if (lg) lg.classList.toggle('show', show);
  setFlightNote();
  if (!show && flightCanvas) {
    const c = flightCanvas.getContext('2d');
    if (c) c.clearRect(0, 0, flightCanvas.width, flightCanvas.height);
    flightHitN = 0;
  }
}


/* ==========================================================================
   STORM TRACKING — live tropical cyclones from GDACS: current position, past
   track, forecast track, forecast cone (impact area) and affected countries.
   ========================================================================== */
const ICON_CYCLONE_PATHS = '<circle cx="12" cy="12" r="1.4"/><path d="M12 8a4 4 0 0 1 4 4M12 16a4 4 0 0 1-4-4"/><path d="M12 4a8 8 0 0 1 8 8M12 20a8 8 0 0 1-8-8"/>';
function stormCat(kmh) {
  if (kmh >= 252) return { c: '5', label: 'CAT 5', color: '#ff2d78' };
  if (kmh >= 209) return { c: '4', label: 'CAT 4', color: '#ff3b52' };
  if (kmh >= 178) return { c: '3', label: 'CAT 3', color: '#ff6b2d' };
  if (kmh >= 154) return { c: '2', label: 'CAT 2', color: '#ff8a3d' };
  if (kmh >= 119) return { c: '1', label: 'CAT 1', color: '#ffcc45' };
  if (kmh >= 63)  return { c: 'ts', label: 'TROPICAL STORM', color: '#48d29a' };
  return { c: 'td', label: 'TROPICAL DEPRESSION', color: '#7fb0ff' };
}
function parseStorm(g) {
  let center = null; const cones = [], segs = [], fpoints = [];
  for (const f of (g.features || [])) {
    const cls = (f.properties && f.properties.Class) || '', co = f.geometry && f.geometry.coordinates;
    if (!co) continue;
    if (cls === 'Point_Centroid') center = co;
    else if (cls === 'Poly_Cones') cones.push(co[0]);
    else if (cls.indexOf('Line_Line') === 0) segs.push({ coords: co, forecast: !!f.properties.forecast, idx: +cls.split('_').pop() });
    else if (cls.indexOf('Point_Polygon_Point') === 0) {
      // wind-radius polygon centred on a forecast position → use its centre
      const ring = f.geometry.type === 'Polygon' ? co[0] : co;
      if (Array.isArray(ring) && Array.isArray(ring[0])) {
        let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
        for (const p of ring) { if (p[0] < mnx) mnx = p[0]; if (p[0] > mxx) mxx = p[0]; if (p[1] < mny) mny = p[1]; if (p[1] > mxy) mxy = p[1]; }
        fpoints.push({ lon: (mnx + mxx) / 2, lat: (mny + mxy) / 2, label: f.properties.polygonlabel, idx: +cls.split('_').pop() });
      }
    }
  }
  segs.sort((a, b) => a.idx - b.idx); fpoints.sort((a, b) => a.idx - b.idx);
  return { center, cones, past: segs.filter((s) => !s.forecast).map((s) => s.coords), fore: segs.filter((s) => s.forecast).map((s) => s.coords), fpoints };
}
// GDACS's getgeometry endpoint crashes intermittently (HTTP 500). Fetch it in
// "soft" mode (so the 500 never hits the console) and retry a few times — the
// same request usually succeeds on a later attempt.
async function fetchStormGeom(eventid, episodeid) {
  const url = `https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${eventid}&episodeid=${episodeid}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(proxy(url) + '&soft=1', { cache: 'no-store' });
      const txt = await r.text();
      if (txt && txt.charCodeAt(0) === 123) {          // starts with '{'
        const j = JSON.parse(txt);
        if (j && j.features) return j;
      }
    } catch (e) { /* retry */ }
    if (attempt < 2) await new Promise((res) => setTimeout(res, 500 + attempt * 500));
  }
  return null;
}
/* ---- multi-source cyclone loading --------------------------------------
   No single feed is trusted on its own (GDACS already broke once when it
   started requiring an `eventtype` parameter, which silently emptied the
   whole layer). Three independent sources are fetched in parallel and merged
   by storm name:
     GDACS   position, wind, affected countries, forecast track + cone
     NHC     official NOAA position/intensity (Atlantic + E/C Pacific)
     EONET   NASA position/intensity + observed past track (worldwide)
   Any one of them is enough to put a storm on the map; more sources add
   detail and a cross-check. */
const KT_TO_KMH = 1.852;
const stormKey = (n) => String(n || '').toLowerCase()
  .replace(/\b(super|severe|major|post[- ]tropical|tropical|hurricane|typhoon|cyclone|storm|depression)\b/g, ' ')
  .replace(/-\d{2}\b/, ' ').replace(/[^a-z]/g, '');
const stormName = (n) => String(n || 'Storm')
  .replace(/^(super |severe |major |post[- ]tropical )?(tropical )?(hurricane|typhoon|cyclone|storm|depression)\s+/i, '')
  .replace(/[-\s]*\d{2}$/, '').trim().toUpperCase() || 'STORM';

async function gdacsStormList() {
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  const now = Date.now();
  // SEARCH is ~100x lighter than MAP; MAP (with its now-mandatory eventtype) is the fallback.
  const urls = [
    'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&fromdate=' + day(now - 14 * 864e5) + '&todate=' + day(now + 864e5) + '&alertlevel=green;orange;red',
    'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=TC',
  ];
  let list = null;
  for (const u of urls) {
    try { const j = await fetchJson(u); if (j && Array.isArray(j.features)) { list = j; break; } } catch (e) { /* try next */ }
  }
  if (!list) throw new Error('GDACS unavailable');
  const seen = new Map();
  for (const f of list.features) {
    const p = f.properties || {};
    if (p.eventtype !== 'TC' || String(p.iscurrent) !== 'true') continue;
    const geo = f.geometry;
    const pt = geo && geo.type === 'Point' && Array.isArray(geo.coordinates) && typeof geo.coordinates[0] === 'number' ? geo.coordinates : null;
    if (!seen.has(p.eventid)) seen.set(p.eventid, { p, pt });
    else if (pt && !seen.get(p.eventid).pt) seen.get(p.eventid).pt = pt;
  }
  return [...seen.values()];
}
// GDACS also publishes an RSS feed that is served separately from its JSON API, so it
// keeps working when the API breaks. Position + wind only (no cone/track).
async function gdacsRssStormList() {
  const xml = await fetchText('https://www.gdacs.org/xml/rss_tc_7d.xml');
  const out = [];
  for (const it of xml.split(/<item>/i).slice(1)) {
    if (!/<gdacs:iscurrent>\s*true\s*<\/gdacs:iscurrent>/i.test(it)) continue;
    const nm = /tropical cyclone\s+([A-Za-z0-9-]+?)(?:-\d{2})?[\s.,]/i.exec(it);
    const lat = parseFloat((/<geo:lat>([^<]+)<\/geo:lat>/i.exec(it) || [])[1]);
    const lon = parseFloat((/<geo:long>([^<]+)<\/geo:long>/i.exec(it) || [])[1]);
    if (!nm || !isFinite(lat) || !isFinite(lon)) continue;
    const w = /maximum wind speed of ([\d.]+) km\/h/i.exec(it);
    const link = /<link>([^<]+)<\/link>/i.exec(it);
    const mod = /<gdacs:datemodified>([^<]+)</i.exec(it);
    out.push({ name: nm[1], wind: w ? parseFloat(w[1]) : 0, center: [lon, lat],
      report: link ? link[1].replace(/&amp;/g, '&') : '', stamp: mod ? mod[1] : '' });
  }
  return out;
}
async function nhcStormList() {
  const j = await fetchJson('https://www.nhc.noaa.gov/CurrentStorms.json');
  return (j.activeStorms || []).filter((s) => isFinite(s.latitudeNumeric) && isFinite(s.longitudeNumeric)).map((s) => ({
    name: s.name, wind: (parseFloat(s.intensity) || 0) * KT_TO_KMH,
    center: [s.longitudeNumeric, s.latitudeNumeric], report: s.publicAdvisory && s.publicAdvisory.url, stamp: s.lastUpdate,
  }));
}
async function eonetStormList() {
  const j = await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=severeStorms');
  const out = [];
  for (const ev of (j.events || [])) {
    if (!/typhoon|hurricane|tropical|cyclone/i.test(ev.title || '')) continue;
    const pts = (ev.geometry || []).filter((g) => g.type === 'Point' && Array.isArray(g.coordinates));
    if (!pts.length) continue;
    const last = pts[pts.length - 1];
    if (Date.now() - Date.parse(last.date) > 36 * 3600e3) continue;   // open in EONET but no longer updating → dissipated
    const past = [];
    for (let i = 1; i < pts.length; i++) past.push([pts[i - 1].coordinates, pts[i].coordinates]);
    out.push({ name: ev.title, wind: (last.magnitudeValue || 0) * (last.magnitudeUnit === 'kts' ? KT_TO_KMH : 1),
      center: last.coordinates, past, report: ev.link, stamp: last.date });
  }
  return out;
}

async function loadStorms(force) {
  if (stormsLoading || (stormsLoaded && !force)) return;
  stormsLoading = true;
  if (!stormsLoaded) $('#storm-count').textContent = ' ·…';
  try {
    const [rg, rn, re, rr] = await Promise.allSettled([gdacsStormList(), nhcStormList(), eonetStormList(), gdacsRssStormList()]);
    const ok = [rg, rn, re, rr].filter((r) => r.status === 'fulfilled').length;
    if (!ok) throw new Error('all storm sources failed');
    const gr = rr.status === 'fulfilled' ? rr.value : [];
    const gd = rg.status === 'fulfilled' ? rg.value.sort((a, b) => (b.p.severitydata?.severity || 0) - (a.p.severitydata?.severity || 0)).slice(0, 12) : [];
    const nh = rn.status === 'fulfilled' ? rn.value : [];
    const eo = re.status === 'fulfilled' ? re.value : [];

    // Skip the heavy geometry fetch + redraw when none of the sources has an update.
    const sig = [gd.map((r) => r.p.eventid + ':' + r.p.episodeid).join(','), nh.map((s) => s.name + s.stamp).join(','), eo.map((s) => s.name + s.stamp).join(','), gr.map((s) => s.name + s.stamp).join(',')].join('|');
    if (stormsLoaded && sig === stormsSig) { stormsLoading = false; return; }
    stormsSig = sig;

    const geoms = await Promise.all(gd.map((rec) => fetchStormGeom(rec.p.eventid, rec.p.episodeid)));
    const merged = new Map();
    const slot = (name) => {
      const k = stormKey(name);
      if (!merged.has(k)) merged.set(k, { name: stormName(name), srcs: [], wind: 0, windFrom: 9, affected: [], center: null, cones: [], past: [], fore: [], fpoints: [], report: '' });
      return merged.get(k);
    };
    // wind precedence: NHC (official) > GDACS > EONET — lower rank wins
    const setWind = (s, w, rank) => { if (w > 0 && rank < s.windFrom) { s.wind = w; s.windFrom = rank; } };
    gd.forEach((rec, i) => {
      const p = rec.p, s = slot(p.eventname || p.name);
      const parsed = geoms[i] ? parseStorm(geoms[i]) : null;
      s.srcs.push('GDACS');
      setWind(s, p.severitydata?.severity || 0, 2);
      s.affected = (p.affectedcountries || []).map((c) => c.countryname).filter(Boolean);
      s.report = (p.url && p.url.report) || s.report;
      s.gcenter = (parsed && parsed.center) || rec.pt || null;
      if (parsed) { s.cones = parsed.cones; s.past = parsed.past; s.fore = parsed.fore; s.fpoints = parsed.fpoints; }
    });
    gr.forEach((g) => {
      const s = slot(g.name);
      if (!s.srcs.includes('GDACS')) s.srcs.push('GDACS');
      setWind(s, g.wind, 2);
      if (!s.gcenter) s.gcenter = g.center;
      s.report = s.report || g.report;
    });
    nh.forEach((n) => {
      const s = slot(n.name);
      s.srcs.push('NHC'); setWind(s, n.wind, 1);
      s.ncenter = n.center; s.report = n.report || s.report;
    });
    eo.forEach((e) => {
      const s = slot(e.name);
      s.srcs.push('EONET'); setWind(s, e.wind, 3);
      s.ecenter = e.center;
      if (!s.past.length) s.past = e.past;
      s.report = s.report || e.report;
    });
    const next = [];
    for (const s of merged.values()) {
      const center = s.ncenter || s.gcenter || s.ecenter;      // NHC is freshest, then GDACS, then EONET
      if (!center) continue;
      next.push({ id: s.name, name: s.name, wind: s.wind, cat: stormCat(s.wind), report: s.report, affected: s.affected,
        center, cones: s.cones, past: s.past, fore: s.fore, fpoints: s.fpoints, srcs: s.srcs });
    }
    next.sort((a, b) => b.wind - a.wind);
    storms = next.slice(0, 14);
    buildStormEls();
    buildStormList();
    stormsLoaded = true;
    $('#storm-count').textContent = storms.length ? ' · ' + storms.length : '';
  } catch (e) {
    console.warn('storms unavailable:', e.message);
    if (!stormsLoaded) $('#storm-count').textContent = '';
    stormsSig = null;      // retry next poll rather than treating this as "no change"
  }
  stormsLoading = false;
  syncStorms();
}
// globe projection with far-side points clamped to the limb
function gp2(lon, lat) {
  const p = globeProject(lon, lat);
  if (p.z >= -0.02) return { x: p.x, y: p.y, z: p.z };
  const dx = p.x - GX, dy = p.y - GY, d = Math.hypot(dx, dy) || 1e-9, R = globeR();
  return { x: GX + dx / d * R, y: GY + dy / d * R, z: p.z };
}
function stormSegs(segArr) {
  let d = '';
  for (const seg of segArr) {
    if (state.globe.on) {
      const a = gp2(seg[0][0], seg[0][1]), b = gp2(seg[1][0], seg[1][1]);
      if (a.z < -0.02 && b.z < -0.02) continue;
      d += 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'L' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    } else {
      const a = project(seg[0][0], seg[0][1]), b = project(seg[1][0], seg[1][1]);
      d += 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    }
  }
  return d || 'M-9 -9';
}
function stormRing(coords) {
  let d = '', anyVis = false;
  for (let i = 0; i < coords.length; i++) {
    let x, y;
    if (state.globe.on) { const p = gp2(coords[i][0], coords[i][1]); if (p.z >= -0.02) anyVis = true; x = p.x; y = p.y; }
    else { const q = project(coords[i][0], coords[i][1]); x = q[0]; y = q[1]; anyVis = true; }
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return anyVis ? d + 'Z' : 'M-9 -9';
}
function buildStormEls() {
  const g = $('#storms');
  g.innerHTML = '';
  for (const st of storms) {
    const grp = document.createElementNS(SVGNS, 'g');
    grp.setAttribute('class', 'storm-grp');
    const cone = document.createElementNS(SVGNS, 'path'); cone.setAttribute('class', 'storm-cone'); cone.style.fill = st.cat.color;
    const past = document.createElementNS(SVGNS, 'path'); past.setAttribute('class', 'storm-track-past');
    const fore = document.createElementNS(SVGNS, 'path'); fore.setAttribute('class', 'storm-track-fore'); fore.style.stroke = st.cat.color;
    grp.appendChild(cone); grp.appendChild(past); grp.appendChild(fore);
    const dots = [];
    for (const fp of st.fpoints) {
      const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('class', 'storm-fp'); c.setAttribute('r', '2');
      grp.appendChild(c); dots.push({ el: c, lon: fp.lon, lat: fp.lat });
    }
    const cen = document.createElementNS(SVGNS, 'g'); cen.setAttribute('class', 'storm-center'); cen.style.color = st.cat.color;
    cen.innerHTML = '<circle class="storm-pulse" r="13"></circle>'
      + '<g class="storm-eye" transform="translate(-7 -7) scale(0.58)" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + ICON_CYCLONE_PATHS + '</g>'
      + `<text class="storm-lbl" x="15" y="4">${escapeHtml(st.name)} · ${st.cat.label}</text>`;
    cen.addEventListener('mousemove', (e) => { e.stopPropagation(); showTip(e, stormTip(st)); });
    cen.addEventListener('mouseleave', hideTip);
    cen.addEventListener('click', (e) => { e.stopPropagation(); focusStorm(st); });
    grp.appendChild(cen);
    g.appendChild(grp);
    st.el = { cone, past, fore, dots, cen };
  }
}
function renderStorms() {
  for (const st of storms) {
    if (!st.el) continue;
    st.el.cone.setAttribute('d', st.cones.map(stormRing).join(' ') || 'M-9 -9');
    st.el.past.setAttribute('d', stormSegs(st.past));
    st.el.fore.setAttribute('d', stormSegs(st.fore));
    for (const d of st.el.dots) {
      const p = activeProject(d.lon, d.lat);
      if (p.vis) { d.el.style.display = ''; d.el.setAttribute('cx', p.x.toFixed(1)); d.el.setAttribute('cy', p.y.toFixed(1)); }
      else d.el.style.display = 'none';
    }
    const c = activeProject(st.center[0], st.center[1]);
    if (c.vis) { st.el.cen.style.display = ''; st.el.cen.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`); }
    else st.el.cen.style.display = 'none';
  }
}
function stormTip(st) {
  return `<div class="tt-title">${svgIcon('cyclone')} ${escapeHtml(st.name)} · ${st.cat.label}</div>`
    + `<div class="tt-meta">Max wind ${Math.round(st.wind)} km/h · ${escapeHtml((st.srcs || []).join(" + "))}</div>`
    + (st.affected.length ? `<div class="tt-meta">Impact: ${escapeHtml(st.affected.slice(0, 4).join(', '))}</div>` : '')
    + `<span class="tt-sev" style="background:${st.cat.color}22;color:${st.cat.color};border:1px solid ${st.cat.color}66">Forecast track & cone shown</span>`;
}
function focusStorm(st) {
  if (!st || !st.center) return;
  if (state.globe.on) rotateTo(st.center[0], st.center[1], 2.4, 5);
  else {
    const [x, y] = project(st.center[0], st.center[1]); const w = W / 4, h = w * H / W;
    state.view = { x: clamp(x - w / 2, 0, W - w), y: clamp(y - h / 2, 0, H - h), w, h }; clampView(); updateView(); renderStorms();
  }
  toast('Tracking ' + st.name + ' · ' + st.cat.label);
}
function buildStormList() {
  const body = $('#storm-list-body');
  if (!body) return;
  if (!storms.length) { body.innerHTML = '<div class="cd-empty">No active tropical cyclones right now.</div>'; return; }
  body.innerHTML = storms.map((st, i) =>
    `<div class="sl-item" data-i="${i}"><span class="sl-dot" style="background:${st.cat.color};box-shadow:0 0 6px ${st.cat.color}"></span>`
    + `<span class="sl-text"><span class="sl-name">${escapeHtml(st.name)}</span>`
    + `<span class="sl-meta">${st.cat.label} · ${Math.round(st.wind)} km/h${st.affected.length ? ' · ' + escapeHtml(st.affected.slice(0, 2).join(', ')) : ''}</span></span></div>`).join('');
  body.querySelectorAll('.sl-item').forEach((row) => { row.onclick = () => focusStorm(storms[+row.dataset.i]); });
}
function syncStorms() {
  const show = stormsOn && storms.length > 0;
  const g = $('#storms'); if (g) g.style.display = show ? '' : 'none';
  const lst = $('#storm-list'); if (lst) lst.classList.toggle('show', stormsOn && stormsLoaded);
  if (show) renderStorms();
}

/* ---- frame loop ------------------------------------------------------- */
let lastInput = 0, lastFrameTs = 0;
function globeFrame() {
  lastFrameTs = performance.now();
  if (!state.globe.on) return;
  const g = state.globe;
  // Gated here rather than at the two `auto: true` assignments so that both the
  // initial view and "Reset" stay still when motion is not wanted.
  if (g.auto && !mapDragging && !reduceMotion.matches) { g.lon = ((g.lon - 0.045 + 540) % 360) - 180; gDirty = true; }
  const gDrew = gDirty;
  if (gDirty) {
    gDirty = false;
    const met = stageMetrics();
    globeTileZoom = tileZoomFor(met);
    globeDeep = globeTileZoom > VECTOR_MAX_Z;
    svg.classList.toggle('deep', globeDeep);
    if (!globeDeep) updateGlobeCircles();
    updateGlobePaths(met);
    updateGlobeMarkers();
    if (firesOn && state.fireEls.length) updateGlobeFires();
    updateGlobeLabels();
    if (stormsOn && storms.length && !globeDeep) renderStorms();
    const moving = g.auto || mapDragging || performance.now() - lastInput < 200;
    if (state.satOn) drawGlobeImagery(moving, met, globeTileZoom);
    drawEnso(moving);
    updateMapChrome(met, globeTileZoom);
  }
  // satellites keep orbiting even when the globe is still
  if (orbitsOn && satData.length) {
    if (performance.now() - satLastProp > 1000) propagateSats();
    drawSats();
  }
  // Cameras don't move, so they only redraw when the globe does.
  if (camsOn) {
    if (gDrew) drawCams();
    if (!mapDragging && !camsLoading) refreshCams(false);
  }
  // ...and so do the aircraft: dead reckoning runs off the clock, not the feed
  if (flightsOn) {
    advanceFlights();
    if (flightFollow) {
      state.globe.lon = flightFollow.lon;
      state.globe.lat = clamp(flightFollow.lat, -85, 85);
      gDirty = true;
    }
    drawFlights();
    if (!mapDragging && !flightsLoading) refreshFlights(false);
  }
}
function globeLoop() {
  requestAnimationFrame(globeLoop);
  globeFrame();
}
// Safety net for setups where rAF is throttled but the globe is still on screen
// (some kiosk / wall-display configurations), so it never shows a frozen sphere.
// Deliberately skipped while the tab is hidden: rAF is suspended there by design
// and nobody is watching, so ticking on would just burn battery.
function startGlobeLoop() {
  requestAnimationFrame(globeLoop);
  setInterval(() => {
    if (!document.hidden && performance.now() - lastFrameTs > 400) globeFrame();
  }, 300);
}

function rotateTo(lon, lat, minScale, maxTileZoom) {
  const g = state.globe;
  g.lon = lon; g.lat = clamp(lat, -75, 75); g.auto = false;
  if (minScale) g.scale = Math.max(g.scale, minScale);
  // Arriving from street level, pull back far enough to actually frame the target.
  if (maxTileZoom) g.scale = Math.min(g.scale, scaleForTileZoom(maxTileZoom));
  markGlobeDirty(); scheduleSettle();
}
function rotateToCountryById(id) {
  if (!state.globe.on || !id) return;
  const f = WORLD_GEOJSON.features.find((ft) => ft.id === id);
  const c = f && featureCentroid(f);
  if (c) rotateTo(c[0], c[1], 1.6, 5);
}

function setMapMode(mode) {
  state.globe.on = mode === 'globe';
  svg.classList.toggle('globe', state.globe.on);
  $('#mode-globe').classList.toggle('active', state.globe.on);
  $('#mode-flat').classList.toggle('active', !state.globe.on);
  $('#map-hint').textContent = state.globe.on
    ? 'Drag to spin · Ctrl+scroll to zoom in to street level'
    : 'Ctrl + scroll to zoom · drag to pan · click a country';
  syncSatCanvas();
  syncEnso();
  syncSatOrbits();
  syncFlights();
  syncCams();
  if (stormsOn && storms.length) renderStorms();
  if (state.globe.on) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);   // globe uses a fixed viewBox
    markGlobeDirty();
  } else {
    for (const l of state.labelEls) {
      l.t.style.display = '';
      l.t.setAttribute('x', l.bx); l.t.setAttribute('y', l.by);
    }
    updateView();
  }
  renderMarkers();
}

/* ---- zoom / pan ------------------------------------------------------ */
function clampView() {
  const v = state.view;
  v.w = clamp(v.w, W / 9, W);
  v.h = v.w * H / W;
  v.x = clamp(v.x, 0, W - v.w);
  v.y = clamp(v.y, 0, H - v.h);
}
function updateView() {
  const v = state.view;
  svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  const f = v.w / W;
  for (const m of state.markerEls) {
    m.solid.setAttribute('r', (m.r * f).toFixed(2));
    if (m.ping) m.ping.setAttribute('r', (m.r * f).toFixed(2));
  }
  for (const m of state.fireEls) m.el.setAttribute('r', (m.r * f).toFixed(2));
  for (const l of state.labelEls) l.t.setAttribute('font-size', (l.base * f).toFixed(2));
}
function zoomAt(factor, cx, cy) {
  const r = stage.getBoundingClientRect();
  const v = state.view;
  const scale = Math.min(r.width / v.w, r.height / v.h);
  const offX = (r.width - v.w * scale) / 2, offY = (r.height - v.h * scale) / 2;
  const ux = v.x + (cx - offX) / scale, uy = v.y + (cy - offY) / scale;
  let nw = clamp(v.w * factor, W / 9, W), nh = nw * H / W;
  const ns = Math.min(r.width / nw, r.height / nh);
  const noffX = (r.width - nw * ns) / 2, noffY = (r.height - nh * ns) / 2;
  v.w = nw; v.h = nh;
  v.x = ux - (cx - noffX) / ns;
  v.y = uy - (cy - noffY) / ns;
  clampView(); updateView();
}
function setupMapInteraction() {
  // Zoom only when Ctrl/⌘ is held, so a plain wheel still scrolls the page.
  stage.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    lastInput = performance.now();
    if (state.globe.on) {
      const r = stage.getBoundingClientRect();
      // Normalise mouse wheels, trackpads and Firefox's line deltas, then treat
      // ~120 units as one zoom level — the cadence Google Maps uses.
      const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1);
      const d = clamp(e.deltaY * unit, -400, 400);
      zoomGlobeAt(Math.pow(2, -d / 120), e.clientX - r.left, e.clientY - r.top);
      return;
    }
    const r = stage.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 0.82 : 1.22, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // Pointer tracking supports 1-finger drag (spin/pan) and 2-finger pinch-zoom.
  const pointers = new Map();
  let dragging = false, moved = false, lx = 0, ly = 0, sx0 = 0, sy0 = 0;
  let pinching = false, pinchStartDist = 0, pinchStartScale = 1, pinchStartViewW = W;
  const twoFingerDist = () => { const p = [...pointers.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };

  stage.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    mapDragging = true;
    if (state.globe.on) state.globe.auto = false;   // user takes control
    stage.classList.add('grabbing');
    if (pointers.size === 2) {
      pinching = true; dragging = false;
      pinchStartDist = twoFingerDist();
      pinchStartScale = state.globe.scale;
      pinchStartViewW = state.view.w;
    } else if (pointers.size === 1) {
      dragging = true; moved = false; lx = e.clientX; ly = e.clientY; sx0 = e.clientX; sy0 = e.clientY;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInput = performance.now();
    const r = stage.getBoundingClientRect();

    if (pinching && pointers.size >= 2) {              // pinch zoom (touch)
      const d = twoFingerDist();
      if (pinchStartDist > 0) {
        const ratio = d / pinchStartDist;
        if (state.globe.on) {
          const p = [...pointers.values()];
          const target = clamp(pinchStartScale * ratio, 1, globeMaxScale());
          zoomGlobeAt(target / state.globe.scale,
            (p[0].x + p[1].x) / 2 - r.left, (p[0].y + p[1].y) / 2 - r.top);
        } else {
          const p = [...pointers.values()];
          const cx = (p[0].x + p[1].x) / 2 - r.left, cy = (p[0].y + p[1].y) / 2 - r.top;
          const targetW = clamp(pinchStartViewW / ratio, W / 9, W);
          zoomAt(targetW / state.view.w, cx, cy);
        }
      }
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    // "moved" = left the tap zone (measured from press origin, forgiving for touch)
    if (Math.hypot(e.clientX - sx0, e.clientY - sy0) > 9) moved = true;
    lx = e.clientX; ly = e.clientY;
    if (state.globe.on) {
      const g = state.globe;
      const R = globeR() * Math.min(r.width / W, r.height / H);
      const kLat = 1 / (R * RAD);                     // exact, so the ground tracks the pointer 1:1
      const kLon = kLat / Math.max(Math.cos(g.lat * RAD), 0.05);
      g.lon = ((g.lon - dx * kLon + 540) % 360) - 180;
      g.lat = clamp(g.lat + dy * kLat, -85, 85);
      markGlobeDirty(); scheduleSettle();
      return;
    }
    const v = state.view;
    const scale = Math.min(r.width / v.w, r.height / v.h);
    v.x -= dx / scale; v.y -= dy / scale;
    clampView(); updateView();
  });
  const removePointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinching = false;
    if (pointers.size === 1) {                          // resume single-finger drag
      const p = [...pointers.values()][0];
      dragging = true; moved = false; lx = p.x; ly = p.y;
    } else if (pointers.size === 0) {
      suppressClick = moved; dragging = false; mapDragging = false; stage.classList.remove('grabbing');
    }
  };
  stage.addEventListener('pointerup', removePointer);
  stage.addEventListener('pointercancel', removePointer);
  stage.addEventListener('pointerleave', removePointer);

  const globeZoom = (f) => {
    lastInput = performance.now();
    zoomGlobeAt(f, stage.clientWidth / 2, stage.clientHeight / 2);
  };
  $('#zoom-in').onclick = () => state.globe.on ? globeZoom(2) : zoomAt(0.7, stage.clientWidth / 2, stage.clientHeight / 2);
  $('#zoom-out').onclick = () => state.globe.on ? globeZoom(0.5) : zoomAt(1.4, stage.clientWidth / 2, stage.clientHeight / 2);
  $('#reset-view').onclick = () => {
    if (state.globe.on) {
      Object.assign(state.globe, { lon: 121, lat: 13, scale: 1, auto: true });
      markGlobeDirty();
    } else {
      state.view = { x: 0, y: 0, w: W, h: H };
      updateView();
    }
  };

  // Full screen: the toolbar is MOVED (not cloned) into the side panel, so every
  // handler already bound to those elements keeps working untouched.
  const panel = $('#sec-map'), slot = $('#map-side-slot'), bar = $('#map-toolbar');
  const enterFs = () => {
    if (panel.classList.contains('fs')) return;
    panel.classList.add('fs');
    slot.appendChild(bar);
    if (panel.requestFullscreen) panel.requestFullscreen().catch(() => {});
    markGlobeDirty(); scheduleSettle();
  };
  const exitFs = () => {
    if (!panel.classList.contains('fs')) return;
    panel.classList.remove('fs');
    panel.insertBefore(bar, $('#map-side').nextSibling);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    markGlobeDirty(); scheduleSettle();
  };
  $('#toggle-fs').onclick = () => (panel.classList.contains('fs') ? exitFs() : enterFs());
  $('#map-exit-fs').onclick = exitFs;
  // Leaving fullscreen by Esc or the browser chrome must undo the layout too.
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) exitFs(); });
  // Nothing was listening for resize at all — the globe sizes itself from the
  // stage on each dirty frame, so a static globe kept a stale canvas until the
  // next interaction. Entering full screen is the biggest resize there is.
  window.addEventListener('resize', () => { markGlobeDirty(); scheduleSettle(); });

  $('#mode-globe').onclick = () => setMapMode('globe');
  $('#mode-flat').onclick = () => setMapMode('flat');

  document.querySelectorAll('.layer-toggle[data-layer]').forEach((t) => {
    t.onclick = () => {
      const k = t.dataset.layer;
      state.layers[k] = !state.layers[k];
      t.classList.toggle('off', !state.layers[k]);
      renderMarkers();
    };
  });

  $('#toggle-labels').onclick = () => {
    const g = $('#labels');
    const hide = !g.classList.contains('off');
    g.classList.toggle('off', hide);
    $('#toggle-labels').classList.toggle('off', hide);
  };

  $('#toggle-sat').onclick = () => {
    state.satOn = !state.satOn;
    svg.classList.toggle('sat', state.satOn);
    $('#toggle-sat').classList.toggle('off', !state.satOn);
    if (state.satOn) loadTexture();
    // Nothing but imagery exists past the vector range, so come back up with it.
    else state.globe.scale = Math.min(state.globe.scale, scaleForTileZoom(TILE_MIN_Z - 1));
    syncSatCanvas(); markGlobeDirty(); scheduleSettle();
  };

  $('#toggle-streets').onclick = () => {
    state.mapStyle = state.mapStyle === 'streets' ? 'satellite' : 'streets';
    $('#toggle-streets').classList.toggle('off', state.mapStyle !== 'streets');
    ensureImagery();
    markGlobeDirty(); scheduleSettle();
  };

  // Runs after the map's own handlers, so a country or marker tooltip takes priority.
  stage.addEventListener('mousemove', (e) => {
    if (tooltip.classList.contains('show') && !tipIsCoordsOnly) return;
    if (mapDragging || !pointerLonLat(e)) { if (tipIsCoordsOnly) hideTip(); return; }
    showTip(e, '');
    tipIsCoordsOnly = true;
  });
  stage.addEventListener('mouseleave', () => { if (tipIsCoordsOnly) hideTip(); });

  $('#toggle-enso').onclick = () => {
    ensoOn = !ensoOn;
    $('#toggle-enso').classList.toggle('off', !ensoOn);
    if (ensoOn) {
      loadEnsoLayer();
      if (state.globe.on) rotateTo(-150, 0);   // the story is in the Pacific
    }
    syncEnso(); markGlobeDirty(); scheduleSettle();
  };

  $('#toggle-cams').onclick = () => {
    camsOn = !camsOn;
    $('#toggle-cams').classList.toggle('off', !camsOn);
    if (camsOn) { camBox = null; refreshCams(true); }
    else { cams = []; camHitN = 0; camBox = null; $('#cam-count').textContent = ''; }
    syncCams();
    markGlobeDirty();
  };

  // A hidden tab defers autoplay, so an open stream comes back paused. Re-arm it
  // when the page is visible again rather than leaving a frozen frame on screen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !camOpen || !camOpen.stream) return;
    const v = $('#cam-card .cc-vid');
    if (v && v.paused) v.play().catch(() => {});
  });

  stage.addEventListener('pointermove', (e) => {
    if (!camsOn || !camHitN) return;
    const r = stage.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (flightsOn && flightUnder(cx, cy)) return;      // aircraft are drawn on top
    const c = camUnder(cx, cy);
    if (c) showTip(e, camTip(c));
  });

  stage.addEventListener('click', (e) => {
    if (!camsOn || suppressClick || !camHitN) return;
    const r = stage.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (flightsOn && flightUnder(cx, cy)) return;
    const c = camUnder(cx, cy);
    if (!c) return;
    e.stopPropagation();
    openCam(c);
  }, { capture: true });

  $('#toggle-flights').onclick = () => {
    flightsOn = !flightsOn;
    $('#toggle-flights').classList.toggle('off', !flightsOn);
    if (flightsOn) {
      flightKey = '';
      refreshFlights(true);
    } else {
      flights = []; flightHitN = 0; flightFollow = null; flightHover = null;
      closeFlightCard();
      $('#flight-count').textContent = '';
    }
    syncFlights();
    markGlobeDirty();
  };

  // Hover for detail. Runs after the country paths' own handler, so an aircraft
  // under the pointer wins the tooltip; leaving one hands it back.
  stage.addEventListener('pointermove', (e) => {
    if (!flightsOn || !flightHitN) {
      if (flightHover) { flightHover = null; hideTip(); }
      return;
    }
    const r = stage.getBoundingClientRect();
    const f = flightUnder(e.clientX - r.left, e.clientY - r.top);
    if (f) { flightHover = f; showTip(e, flightTip(f)); }
    else if (flightHover) { flightHover = null; hideTip(); }
  });

  // Capture phase, so clicking an aircraft follows it instead of selecting the
  // country underneath. suppressClick is left for the country handler to consume.
  stage.addEventListener('click', (e) => {
    if (!flightsOn || suppressClick || !flightHitN) return;
    const r = stage.getBoundingClientRect();
    const f = flightUnder(e.clientX - r.left, e.clientY - r.top);
    if (!f) return;
    e.stopPropagation();
    openFlightCard(f);
  }, { capture: true });

  $('#toggle-orbits').onclick = () => {
    orbitsOn = !orbitsOn;
    $('#toggle-orbits').classList.toggle('off', !orbitsOn);
    if (orbitsOn) loadSatellites();
    syncSatOrbits(); markGlobeDirty();
  };

  // Active fires (NASA FIRMS) — opt-in; fetched on first enable.
  $('#toggle-fires').onclick = async () => {
    firesOn = !firesOn;
    const btn = $('#toggle-fires');
    btn.classList.toggle('off', !firesOn);
    if (firesOn) {
      btn.classList.add('busy');
      await ensureFires();
      btn.classList.remove('busy');
      if (!firesConfigured) {
        firesOn = false; btn.classList.add('off');
        toast('Active-fire layer needs a free NASA FIRMS key (see README)', true);
        return;
      }
      if (!state.fires.length) toast('No active-fire detections available right now');
    }
    renderFires();
  };

  // one delegated set of handlers for up to ~1200 fire dots
  const fireG = $('#fires');
  if (fireG) {
    fireG.addEventListener('mousemove', (e) => {
      const t = e.target.closest && e.target.closest('.fire-dot'); if (!t) return;
      e.stopPropagation(); showTip(e, hazardTipHTML(fireToHazard(state.fires[+t.dataset.i])));
    });
    fireG.addEventListener('mouseleave', hideTip);
    fireG.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('.fire-dot'); if (!t) return;
      e.stopPropagation(); hideTip(); openEventDetail(fireToHazard(state.fires[+t.dataset.i]), e);
    });
  }
}

/* ---- markers --------------------------------------------------------- */
function markerClass(h) {
  if (h.layer === 'quakes') return h.mag >= 5 ? 'mk-quake-big' : 'mk-quake';
  if (h.layer === 'events') return 'mk-event';
  return h.sev === 'extreme' ? 'mk-alert-red' : h.sev === 'high' ? 'mk-alert-orange' : 'mk-alert-green';
}
function markerRadius(h) {
  if (h.layer === 'quakes') return clamp(2 + (h.mag || 2) * 1.15, 2.5, 12);
  if (h.layer === 'alerts') return h.sev === 'extreme' ? 7 : h.sev === 'high' ? 5.5 : 4;
  return 4.5;
}
function renderMarkers() {
  const g = $('#markers');
  g.innerHTML = '';
  state.markerEls = [];
  const shown = state.hazards.filter((h) => state.layers[h.layer] && isFinite(h.lat) && isFinite(h.lon));
  // biggest drawn last (on top)
  shown.sort((a, b) => markerRadius(a) - markerRadius(b));
  const f = markerScaleFactor();
  for (const h of shown) {
    const pos = activeProject(h.lon, h.lat);
    const grp = document.createElementNS(SVGNS, 'g');
    grp.setAttribute('class', 'marker ' + markerClass(h));
    grp.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
    if (!pos.vis) grp.style.display = 'none';
    const r = markerRadius(h);
    // Only the significant events get the animated "ping" — keeps the
    // renderer light when hundreds of markers are on screen at once.
    const significant = h.sev === 'extreme' || h.sev === 'high' || (h.mag && h.mag >= 5);
    let ping = null;
    if (significant) {
      ping = document.createElementNS(SVGNS, 'circle');
      ping.setAttribute('class', 'ping'); ping.setAttribute('r', (r * f).toFixed(2));
      grp.appendChild(ping);
    }
    const solid = document.createElementNS(SVGNS, 'circle');
    solid.setAttribute('r', (r * f).toFixed(2)); solid.setAttribute('stroke-width', '1.4');
    solid.setAttribute('vector-effect', 'non-scaling-stroke');
    grp.appendChild(solid);
    grp.addEventListener('mousemove', (e) => { e.stopPropagation(); showTip(e, hazardTipHTML(h)); });
    grp.addEventListener('mouseleave', hideTip);
    grp.addEventListener('click', (e) => { e.stopPropagation(); hideTip(); openEventDetail(h, e); });
    g.appendChild(grp);
    state.markerEls.push({ grp, solid, ping, r, lon: h.lon, lat: h.lat });
  }
  $('#map-count').textContent = shown.length + ' events plotted';
  renderFires();   // keep the fire layer projected in sync with the markers
}

/* ---- FIRMS active-fire layer ----------------------------------------- */
const FIRE_LIMIT = 1500;   // keep the most-intense fires so the globe stays smooth
function fireSev(frp) { return frp >= 50 ? 'extreme' : frp >= 20 ? 'high' : frp >= 5 ? 'moderate' : 'low'; }
function fireColor(frp) { return frp >= 50 ? '#ff3b52' : frp >= 20 ? '#ff6b2d' : frp >= 5 ? '#ff8a3d' : '#ffcc45'; }
function fireToHazard(f) {
  return {
    layer: 'fires', kind: 'Active fire', icon: 'wildfire', title: 'VIIRS active-fire detection',
    sev: fireSev(f.frp), frp: f.frp, conf: f.conf, sat: f.sat, dn: f.dn,
    lat: f.lat, lon: f.lon, time: new Date(f.ts), place: '',
    url: 'https://firms.modaps.eosdis.nasa.gov/map/',
  };
}
async function ensureFires(force) {
  if (firesLoading || (firesLoaded && !force)) return;
  firesLoading = true;
  try {
    const data = await jget('/api/firms?limit=' + FIRE_LIMIT);
    firesConfigured = data.configured !== false;
    state.fires = firesConfigured ? (data.fires || []) : [];
    firesLoaded = true;
    const cnt = $('#fire-count');
    if (cnt) cnt.textContent = (firesConfigured && data.total) ? ' ' + (data.count < data.total ? data.count + '/' + data.total : data.total) : '';
  } catch { state.fires = []; }
  firesLoading = false;
}
function renderFires() {
  const g = $('#fires');
  if (!g) return;
  g.innerHTML = '';
  state.fireEls = [];
  if (!firesOn || !state.fires.length) return;
  const f = markerScaleFactor();
  for (let i = 0; i < state.fires.length; i++) {
    const fire = state.fires[i];
    const pos = activeProject(fire.lon, fire.lat);
    const r = clamp(1 + fire.frp / 45, 1, 3);
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('class', 'fire-dot');
    c.setAttribute('r', (r * f).toFixed(2));
    c.setAttribute('fill', fireColor(fire.frp));
    c.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
    c.dataset.i = i;
    if (!pos.vis) c.style.display = 'none';
    g.appendChild(c);
    state.fireEls.push({ el: c, lon: fire.lon, lat: fire.lat, r });
  }
}
function updateGlobeFires() {
  for (const m of state.fireEls) {
    const p = globeProject(m.lon, m.lat);
    if (!p.vis || p.x < -500 || p.x > 1500 || p.y < -500 || p.y > 1000) { m.el.style.display = 'none'; continue; }
    m.el.style.display = '';
    m.el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  }
}

function focusHazard(h) {
  if (!isFinite(h.lat) || !isFinite(h.lon)) return;
  if (state.globe.on) { rotateTo(h.lon, h.lat, 2.6, 7); return; }
  const [x, y] = project(h.lon, h.lat);
  const w = W / 5, h2 = w * H / W;
  state.view = { x: clamp(x - w / 2, 0, W - w), y: clamp(y - h2 / 2, 0, H - h2), w, h: h2 };
  clampView(); updateView();
}

/* ==========================================================================
   HAZARD FEEDS
   ========================================================================== */
function sevFromMag(m) { return m >= 6 ? 'extreme' : m >= 5 ? 'high' : m >= 4 ? 'moderate' : 'low'; }

async function loadUSGS() {
  const data = await fetchJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
  $('#s-quakes').textContent = data.metadata ? data.metadata.count : data.features.length;
  let maxMag = 0;
  const out = [];
  for (const f of data.features) {
    const p = f.properties, c = f.geometry && f.geometry.coordinates;
    if (!c) continue;
    const mag = Math.round((p.mag || 0) * 10) / 10;
    if (mag > maxMag) maxMag = mag;
    if (mag < 2.5) continue;                       // keep the map readable
    out.push({
      id: 'q' + p.code, layer: 'quakes', kind: 'Earthquake', icon: 'earthquake',
      title: p.place || ('M' + mag + ' earthquake'), place: p.place || '',
      mag, sev: p.alert ? (p.alert === 'red' ? 'extreme' : p.alert === 'orange' ? 'high' : p.alert === 'yellow' ? 'moderate' : 'low') : sevFromMag(mag),
      lat: c[1], lon: c[0], time: new Date(p.time), url: p.url, list: mag >= 4.3
    });
  }
  $('#s-maxmag').textContent = maxMag ? 'M' + maxMag.toFixed(1) : '—';
  return out;
}

async function loadEONET() {
  const data = await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=120');
  const evs = data.events || [];
  $('#s-events').textContent = evs.length;
  const out = [];
  for (const ev of evs) {
    const geoms = ev.geometry || [];
    if (!geoms.length) continue;
    const g = geoms[geoms.length - 1];
    let lon, lat;
    if (g.type === 'Point') { [lon, lat] = g.coordinates; }
    else if (Array.isArray(g.coordinates)) { const r = g.coordinates[0]; const pt = Array.isArray(r[0]) ? r[0] : r; [lon, lat] = pt; }
    const cat = (ev.categories && ev.categories[0]) || {};
    out.push({
      id: ev.id, layer: 'events', kind: cat.title || 'Event', icon: EONET_ICON[cat.id] || 'hazard',
      title: ev.title, place: '', sev: 'moderate',   // EONET has no place name — only coordinates
      lat, lon, time: new Date(g.date || Date.now()),
      url: (ev.sources && ev.sources[0] && ev.sources[0].url) || ev.link, list: true
    });
  }
  return out;
}

function tagText(parent, name) { const n = parent.getElementsByTagName(name)[0]; return n ? n.textContent.trim() : ''; }

async function loadGDACS() {
  const xml = await fetchText('https://www.gdacs.org/xml/rss.xml');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const items = [...doc.getElementsByTagName('item')];
  let alertCount = 0;
  const out = [];
  for (const it of items) {
    const level = tagText(it, 'gdacs:alertlevel') || 'Green';
    const et = tagText(it, 'gdacs:eventtype');
    const meta = GDACS_TYPE[et] || { label: et || 'Hazard', icon: 'hazard' };
    let lat = parseFloat(tagText(it, 'geo:lat')), lon = parseFloat(tagText(it, 'geo:long'));
    if (!isFinite(lat)) { const pt = tagText(it, 'georss:point').split(/\s+/); lat = parseFloat(pt[0]); lon = parseFloat(pt[1]); }
    const sev = level === 'Red' ? 'extreme' : level === 'Orange' ? 'high' : 'low';
    if (level === 'Red' || level === 'Orange') alertCount++;
    const country = tagText(it, 'gdacs:country');
    out.push({
      id: 'g' + tagText(it, 'guid') + Math.random().toString(36).slice(2, 6),
      layer: 'alerts', kind: meta.label, icon: meta.icon,
      title: tagText(it, 'title'), place: country, sev,
      lat, lon, time: new Date(tagText(it, 'pubDate') || Date.now()),
      url: tagText(it, 'link'), list: true
    });
  }
  $('#s-alerts').textContent = alertCount;
  return out;
}

async function loadHazards() {
  const results = await Promise.allSettled([loadUSGS(), loadEONET(), loadGDACS()]);
  let ok = 0;
  const merged = [];
  for (const r of results) {
    if (r.status === 'fulfilled') { ok++; merged.push(...r.value); }
    else console.warn('hazard feed failed', r.reason);
  }
  state.feedsOk = ok;
  $('#stat-feeds').textContent = (ok + (state.lastNews.length ? 1 : 0)) + '/' + state.feedsTotal;
  state.hazards = merged;
  renderMarkers();
  renderDisasterList();
  buildTicker();
  updateCountryActivity();
  if (ok === 0) toast('Hazard feeds unavailable — is the proxy running?', true);
}

const SEV_RANK = { extreme: 0, high: 1, moderate: 2, low: 3 };
function renderDisasterList() {
  const list = $('#disaster-list');
  const items = state.hazards
    .filter((h) => h.list)
    .sort((a, b) => (SEV_RANK[a.sev] - SEV_RANK[b.sev]) || (b.time - a.time))
    .slice(0, 120);
  $('#disaster-count').textContent = items.length + ' active';
  if (!items.length) { list.innerHTML = '<div class="empty">No active hazards reported.</div>'; return; }
  list.innerHTML = '';
  for (const h of items) {
    const row = el('div', 'd-item');
    row.innerHTML =
      `<div class="d-icon d-icon-${h.sev}">${svgIcon(h.icon)}</div>`
      + `<div class="d-body"><div class="d-title">${escapeHtml(h.title)}</div>`
      + `<div class="d-meta"><span>${escapeHtml(h.kind)}</span>`
      + `${h.place ? '<span>' + escapeHtml(h.place) + '</span>' : ''}`
      + `<span>${relTime(h.time)} ago</span></div></div>`
      + (h.mag
          ? `<div class="d-sev sev-${h.sev}">M${h.mag}</div>`
          : `<div class="d-sev sev-${severityLabel(h).badge}">${severityLabel(h).text.toLowerCase()}</div>`);
    row.addEventListener('click', () => {
      focusHazard(h);
      $('#search-input').value = '';
      state.search = h.place || h.kind;
      runNews({ searchOverride: (h.place || h.title) });
      toast('Focused: ' + h.title);
    });
    list.appendChild(row);
  }
}

/* ==========================================================================
   NEWS
   ========================================================================== */
/* ---- headline translation (Google translate endpoint, via proxy) ------ */
let translateOn = localStorage.getItem('ww-translate') === '1';
const trCache = new Map();   // original text -> English

// Needs translation? Non-ASCII text always does; ASCII text only when the
// current news edition isn't English (French/Filipino etc. are ASCII-heavy).
function needsTranslation(text) {
  if (!text) return false;
  if (/[^\x00-\x7F]/.test(text.replace(/[’‘“”–—…€£°]/g, ''))) return true;
  const ed = editionFor(state.country);
  return !ed.hl.startsWith('en');
}
async function translateBatch(texts) {
  const q = texts.join('\n');
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(q);
  const r = await fetch(proxy(url));
  if (!r.ok) throw new Error('translate ' + r.status);
  const data = await r.json();
  const joined = (data[0] || []).map((seg) => seg[0] || '').join('');
  const out = joined.split('\n');
  if (out.length !== texts.length) throw new Error('segment mismatch');
  return out.map((t) => t.trim());
}
async function translateTexts(texts) {
  const result = texts.slice();
  const todo = [];
  texts.forEach((t, i) => {
    if (trCache.has(t)) result[i] = trCache.get(t);
    else if (needsTranslation(t)) todo.push(i);
  });
  for (let c = 0; c < todo.length; c += 10) {          // chunks of 10 headlines
    const idx = todo.slice(c, c + 10);
    try {
      const tr = await translateBatch(idx.map((i) => texts[i]));
      idx.forEach((i, k) => { if (tr[k]) { trCache.set(texts[i], tr[k]); result[i] = tr[k]; } });
    } catch (e) { /* keep originals for this chunk */ }
  }
  return result;
}
// Translate the text of every element matching `selector`, in place.
// Originals are kept in data-orig so the toggle can restore them.
async function translateDom(selector) {
  if (!translateOn) return;
  const els = [...document.querySelectorAll(selector)];
  if (!els.length) return;
  const texts = els.map((e) => e.dataset.orig || e.textContent);
  const tr = await translateTexts(texts);
  if (!translateOn) return;   // user toggled off while the fetch was in flight
  els.forEach((e, i) => {
    if (!e.isConnected || !tr[i] || tr[i] === texts[i]) return;
    if (!e.dataset.orig) e.dataset.orig = texts[i];
    e.textContent = tr[i];
    e.title = e.dataset.orig;
    e.classList.add('tr-ed');
  });
}
const TRANSLATE_SELECTORS = '#news-grid .nc-title, #cd-body .cd-mini-t';
function applyTranslation() {
  if (translateOn) { translateDom(TRANSLATE_SELECTORS); return; }
  document.querySelectorAll('.tr-ed').forEach((e) => {
    if (e.dataset.orig) { e.textContent = e.dataset.orig; delete e.dataset.orig; }
    e.removeAttribute('title');
    e.classList.remove('tr-ed');
  });
}
// Keep every translate toggle (news wire + country drawer) reflecting the state.
function reflectTranslateButtons() {
  const nw = $('#toggle-translate'); if (nw) nw.classList.toggle('active', translateOn);
  const cd = $('#cd-translate');
  if (cd) { cd.classList.toggle('active', translateOn); cd.setAttribute('aria-pressed', translateOn ? 'true' : 'false'); }
}
function setTranslate(on) {
  translateOn = on;
  localStorage.setItem('ww-translate', on ? '1' : '0');
  reflectTranslateButtons();
  applyTranslation();
  toast(on ? 'Translating headlines to English' : 'Showing original headlines');
}

function editionFor(country) {
  if (!country) return { hl:'en-US', gl:'US', ceid:'US:en', curated:false };
  const e = NEWS_EDITIONS[country.id];
  if (e) return { ...e, curated:true };
  const cc = ISO3_TO_ISO2[country.id] || 'US';
  return { hl:'en-' + cc, gl:cc, ceid:cc + ':en', curated:false };
}

function newsUrl() {
  const c = state.country, cat = state.category;
  const ed = editionFor(c);
  const p = `hl=${ed.hl}&gl=${ed.gl}&ceid=${encodeURIComponent(ed.ceid)}`;

  if (state.search) {
    let q = state.search;
    if (c) q += ' ' + c.name;
    return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${p}`;
  }
  if (cat.type === 'search') {
    let q = cat.q;
    if (c) q += ' ' + c.name;
    return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${p}`;
  }
  // topic
  if (c && !ed.curated) {                          // no dedicated edition → search by name
    const q = c.name + (cat.topicWord ? ' ' + cat.topicWord : '');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${p}`;
  }
  const topic = cat.topic || (c ? null : cat.worldTopic);
  if (topic) return `https://news.google.com/rss/headlines/section/topic/${topic}?${p}`;
  return `https://news.google.com/rss?${p}`;
}

/* Google News packs the story's *coverage cluster* into <description> as an <ol>
   of the same event as reported by other outlets. It is the only substantive
   payload the feed carries — there is no article body, summary or image, and
   <link> is an opaque Google redirect rather than the publisher URL — so this is
   what the reader modal is built from. */
function parseRelated(descHtml) {
  if (!descHtml) return [];
  const d = new DOMParser().parseFromString(descHtml, 'text/html');
  return Array.from(d.querySelectorAll('li')).map((li) => {
    const a = li.querySelector('a');
    if (!a) return null;
    const f = li.querySelector('font');
    return { title: a.textContent.trim(), link: a.getAttribute('href') || '', source: f ? f.textContent.trim() : '' };
  }).filter((r) => r && r.title);
}

// Cards are injected as HTML in two places, so clicks are resolved through this
// registry by id. Keyed on link, so repeated refreshes reuse ids instead of
// growing the map by 48 entries every four minutes.
const newsReg = Object.create(null);
const newsIdByLink = new Map();
let newsSeq = 0;
function regNews(a) {
  let id = newsIdByLink.get(a.link);
  if (!id) { id = 'n' + (++newsSeq); newsIdByLink.set(a.link, id); }
  newsReg[id] = a; a.nid = id;
  return id;
}

function parseNews(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const seen = new Set();
  const out = [];
  for (const it of doc.getElementsByTagName('item')) {
    let title = tagText(it, 'title');
    if (!title) continue;
    const srcEl = it.getElementsByTagName('source')[0];
    let source = srcEl ? srcEl.textContent.trim() : '';
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    if (!source) { const m = title.match(/\s-\s([^-]{2,40})$/); if (m) { source = m[1].trim(); title = title.slice(0, m.index); } }
    const key = title.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    const a = {
      title, link: tagText(it, 'link'), source,
      time: new Date(tagText(it, 'pubDate')),
      related: parseRelated(tagText(it, 'description')),
    };
    regNews(a);
    out.push(a);
  }
  return out;
}

function newsCard(a, scopeBadge) {
  const c = el('a', 'news-card');
  // The href stays real so ctrl/cmd/middle-click still opens the publisher in a
  // tab; the delegated handler intercepts only a plain left-click.
  c.href = a.link; c.target = '_blank'; c.rel = 'noopener';
  c.dataset.nid = a.nid || regNews(a);
  const others = (a.related || []).filter((r) => r.link !== a.link).length;
  c.innerHTML =
    `<div class="nc-top"><span class="nc-src">${escapeHtml(a.source || 'Source')}</span>`
    + `<span class="nc-time">${relTime(a.time)}${relTime(a.time) === 'now' ? '' : ' ago'}</span></div>`
    + `<div class="nc-title">${escapeHtml(a.title)}</div>`
    + `<div class="nc-foot"><span class="nc-badge">${escapeHtml(scopeBadge)}</span>`
    + (others ? `<span class="nc-cov">+${others} outlet${others === 1 ? '' : 's'}</span>` : '')
    + `<span class="nc-read">Read ${svgIcon('external')}</span></div>`;
  return c;
}

/* ---- story reader modal ------------------------------------------------
   Shows what the feed genuinely provides: the headline, the outlet, when it
   ran, and — the useful part — the same story as told by every other outlet
   carrying it, where differing headlines and casualty figures are visible side
   by side. Article text is not reproduced; it stays with the publisher. */
function openNewsModal(a) {
  if (!a) return;
  const modal = $('#news-modal'), card = $('#nm-card');
  const others = (a.related || []).filter((r) => r.link && r.link !== a.link);
  const stamp = a.time && !isNaN(a.time) ? a.time.toUTCString().replace('GMT', 'UTC') : '';
  const rel = relTime(a.time);

  modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
  card.scrollTop = 0;
  card.innerHTML =
    '<button class="nm-close" id="nm-close" title="Close" aria-label="Close">✕</button>'
    + '<div class="nm-head">'
    +   `<span class="nm-src">${escapeHtml(a.source || 'Source')}</span>`
    +   (rel ? `<span class="nm-when" title="${escapeHtml(stamp)}">${escapeHtml(rel)}${rel === 'now' ? '' : ' ago'}</span>` : '')
    + '</div>'
    + `<h2 class="nm-title" id="nm-title">${escapeHtml(a.title)}</h2>`
    + `<a class="nm-open" href="${escapeHtml(a.link)}" target="_blank" rel="noopener">Read the full report at ${escapeHtml(a.source || 'the publisher')} ${svgIcon('external')}</a>`
    + (others.length
      ? `<div class="nm-sec-lbl">How other outlets are reporting it<span class="nm-n">${others.length + 1} sources</span></div>`
        + '<div class="nm-related">'
        + others.map((r) =>
            `<a class="nm-rel" href="${escapeHtml(r.link)}" target="_blank" rel="noopener">`
            + `<span class="nm-rel-src">${escapeHtml(r.source || 'Outlet')}</span>`
            + `<span class="nm-rel-t">${escapeHtml(r.title)}</span></a>`).join('')
        + '</div>'
      : '<div class="nm-solo">No other outlet in the current feed is carrying this story.</div>')
    + '<div class="nm-note">Headlines and outlet lists come from the Google News feed. Full articles remain with their publishers — every link above opens the original report.</div>';

  $('#nm-close').onclick = closeNewsModal;
  $('#nm-backdrop').onclick = closeNewsModal;
  pushLayer(modal, closeNewsModal);
  translateDom('#nm-card .nm-title, #nm-card .nm-rel-t');
}
function closeNewsModal() {
  const m = $('#news-modal');
  m.hidden = true; m.setAttribute('aria-hidden', 'true');
  $('#nm-card').innerHTML = '';
  popLayer(m);
}

// One delegated handler covers both render sites (the news grid and the country
// drawer's mini headlines), since both are injected as HTML.
document.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;  // let the browser open its tab
  const link = e.target.closest && e.target.closest('a[data-nid]');
  if (!link) return;
  const a = newsReg[link.dataset.nid];
  if (!a) return;                       // unknown id — fall through to the href
  e.preventDefault();
  openNewsModal(a);
});

let newsToken = 0;
async function runNews(opts = {}) {
  const grid = $('#news-grid');
  const token = ++newsToken;
  if (opts.searchOverride !== undefined) state.search = opts.searchOverride;

  // scope label
  const scopeName = state.country ? `${flag(state.country.id)} ${escapeHtml(state.country.name)}` : `${svgIcon('globe')} World`;
  const catLabel = state.search ? `“${state.search}”` : state.category.label;
  $('#news-scope').textContent = `${state.country ? state.country.name : 'World'} · ${state.search ? 'Search' : state.category.label}`;
  const badge = state.country ? (ISO3_TO_ISO2[state.country.id] || state.country.name) : 'WORLD';

  grid.innerHTML = Array.from({ length: 8 }, () => '<div class="skel skel-card"></div>').join('');

  try {
    const xml = await fetchText(newsUrl());
    if (token !== newsToken) return;
    const articles = parseNews(xml).slice(0, 48);
    state.lastNews = articles;
    grid.innerHTML = '';
    if (!articles.length) { grid.innerHTML = `<div class="empty">No headlines found for ${escapeHtml(catLabel)} in ${scopeName}.</div>`; return; }
    for (const a of articles) grid.appendChild(newsCard(a, badge));
    buildTrends(articles);
    translateDom('#news-grid .nc-title');
    $('#stat-feeds').textContent = (state.feedsOk + 1) + '/' + state.feedsTotal;
  } catch (err) {
    if (token !== newsToken) return;
    grid.innerHTML = `<div class="empty">Couldn’t load the news wire.<br>${escapeHtml(err.message)}<br><br>Make sure the app is served via <b>node server.js</b> (not opened as a file).</div>`;
    toast('News feed error', true);
  }
}

/* ---- trending topics (derived from current headlines) ---------------- */
function buildTrends(articles) {
  const counts = new Map(), display = new Map();
  const skip = new Set([...STOPWORDS]);
  if (state.country) state.country.name.toLowerCase().split(/\s+/).forEach((w) => skip.add(w));
  for (const a of articles) {
    const seen = new Set();
    const matches = a.title.match(/\b[A-Z][A-Za-z'’]{3,}\b/g) || [];
    for (const w of matches) {
      const k = w.toLowerCase();
      if (skip.has(k) || seen.has(k)) continue;
      seen.add(k);
      counts.set(k, (counts.get(k) || 0) + 1);
      if (!display.has(k)) display.set(k, w);
    }
  }
  const top = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const row = $('#trends-row'), chips = $('#trend-chips');
  if (top.length < 3) { row.hidden = true; return; }
  row.hidden = false;
  chips.innerHTML = '';
  top.forEach(([k], i) => {
    const chip = el('span', 'trend-chip', `<span class="rank">${i + 1}</span>${escapeHtml(display.get(k))}`);
    chip.onclick = () => { $('#search-input').value = display.get(k); state.search = display.get(k); setActiveCat(null); runNews(); };
    chips.appendChild(chip);
  });
}

/* ---- ticker ---------------------------------------------------------- */
function buildTicker() {
  const track = $('#ticker-track');
  const bits = [];
  state.hazards.filter((h) => h.sev === 'extreme' || h.sev === 'high' || (h.mag && h.mag >= 5))
    .sort((a, b) => b.time - a.time).slice(0, 8)
    .forEach((h) => bits.push(`<span class="item">${svgIcon(h.icon)} <b>${escapeHtml(h.kind)}</b> ${escapeHtml(h.title)}</span>`));
  state.lastNews.slice(0, 12).forEach((a) => bits.push(`<span class="item"><b>${escapeHtml(a.source || 'News')}</b> ${escapeHtml(a.title)}</span>`));
  if (!bits.length) { track.innerHTML = '<span class="item">Awaiting live feeds…</span>'; return; }
  // The duplicate exists only to make the marquee loop seamlessly. With motion
  // reduced the track is stopped and scrolled by hand, where a second copy would
  // just read as every headline repeating.
  track.innerHTML = reduceMotion.matches ? bits.join('') : bits.join('') + bits.join('');
}

/* ==========================================================================
   CONTROLS
   ========================================================================== */
function buildCountrySelect() {
  const sel = $('#country-select');
  const opts = ['<option value="">World — All Countries</option>'];
  const countries = WORLD_GEOJSON.features
    .map((f) => ({ id: f.id, name: (f.properties && f.properties.name) || f.id }))
    .filter((c) => c.name && c.name !== '-99')
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const c of countries) {
    const cc = ISO3_TO_ISO2[c.id];
    opts.push(`<option value="${c.id}" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}${cc ? '  (' + cc + ')' : ''}</option>`);
  }
  sel.innerHTML = opts.join('');
  sel.onchange = () => {
    const o = sel.selectedOptions[0];
    // From the news wire: just update headlines — no drawer, no page scroll, no globe spin.
    selectCountry(sel.value || null, o ? o.dataset.name : null, { syncSelect: false, drawer: false, scrollList: false });
  };
}

function buildCountryPanel() {
  const list = $('#country-list');
  const countries = WORLD_GEOJSON.features
    .map((f) => ({ id: f.id, name: (f.properties && f.properties.name) || f.id }))
    .filter((c) => c.name && c.name !== '-99')
    .sort((a, b) => a.name.localeCompare(b.name));
  $('#country-count').textContent = countries.length;

  const frag = document.createDocumentFragment();
  const worldRow = el('div', 'c-item active');
  worldRow.dataset.id = '';
  worldRow.innerHTML = `<span class="c-flag">${svgIcon('globe')}</span><span class="c-name">World — All Countries</span>`;
  worldRow.onclick = () => selectCountry(null);
  frag.appendChild(worldRow);

  for (const c of countries) {
    const cc = ISO3_TO_ISO2[c.id];
    const row = el('div', 'c-item');
    row.dataset.id = c.id;
    row.dataset.name = c.name;
    const flagHtml = cc && cc !== 'XK'
      ? `<img class="flag" loading="lazy" src="https://flagcdn.com/${cc.toLowerCase()}.svg" alt="" onerror="this.remove()">`
      : svgIcon('globe');
    row.innerHTML = `<span class="c-flag">${flagHtml}</span>`
      + `<span class="c-name">${escapeHtml(c.name)}</span><span class="c-code">${cc || ''}</span>`
      + '<span class="c-dot" title="Active severe alert / major quake"></span>';
    row.onclick = () => selectCountry(c.id, c.name, { rotate: true, scrollList: false });
    frag.appendChild(row);
  }
  list.appendChild(frag);
  updateCountryActivity();

  $('#country-filter').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    list.querySelectorAll('.c-item').forEach((r) => {
      const nm = (r.dataset.name || 'world all countries').toLowerCase();
      r.style.display = !q || nm.includes(q) ? '' : 'none';
    });
  });
}

// Flag countries with an active severe/high alert or a recent M5+ quake.
let _cbboxes = null;
function featureBBox(f) {
  const g = f.geometry; if (!g) return null;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const poly of polys) for (const ring of poly) for (const p of ring) {
    if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0];
    if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1];
  }
  return [minx, miny, maxx, maxy];
}
function countryForPoint(lon, lat) {
  if (!_cbboxes) _cbboxes = WORLD_GEOJSON.features.map((f) => ({ f, b: featureBBox(f) }));
  for (const { f, b } of _cbboxes) {
    if (!b || lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    if (pointInFeature(lon, lat, f)) return f.id;
  }
  return null;
}
function updateCountryActivity() {
  const active = new Set();
  for (const h of state.hazards) {
    if (!(h.sev === 'extreme' || h.sev === 'high' || (h.mag && h.mag >= 5))) continue;
    let id = isFinite(h.lat) && isFinite(h.lon) ? countryForPoint(h.lon, h.lat) : null;
    if (!id && h.place) {
      const nm = h.place.toLowerCase();
      const f = WORLD_GEOJSON.features.find((x) => { const n = (x.properties && x.properties.name || '').toLowerCase(); return n && nm.includes(n); });
      if (f) id = f.id;
    }
    if (id) active.add(id);
  }
  document.querySelectorAll('.c-item').forEach((r) => r.classList.toggle('c-alert', r.dataset.id && active.has(r.dataset.id)));
}

function buildCatTabs() {
  const wrap = $('#cat-tabs');
  wrap.innerHTML = '';
  for (const cat of CATEGORIES) {
    const t = el('button', 'cat-tab' + (cat.hot ? ' hot' : '') + (cat.id === state.category.id ? ' active' : ''), cat.label);
    t.dataset.id = cat.id;
    t.onclick = () => {
      state.category = cat; state.search = ''; $('#search-input').value = '';
      setActiveCat(cat.id); runNews();
    };
    wrap.appendChild(t);
  }
}
function setActiveCat(id) {
  document.querySelectorAll('.cat-tab').forEach((t) => t.classList.toggle('active', t.dataset.id === id));
}

/* ---- live TV wall ---------------------------------------------------- */
let tvToken = 0;
const tvInfo = {};   // handle -> { videoId, live }

function buildTV() {
  const grid = $('#tv-grid');
  grid.innerHTML = '';
  for (const ch of CHANNELS) {
    const b = el('button', 'tv-box');
    b.dataset.handle = ch.handle;
    b.title = ch.name;
    b.innerHTML =
      `<div class="tv-box-thumb"><div class="tv-box-ph"><span class="tv-box-flag-lg">${flagImg(ch.cc)}</span></div></div>`
      + `<div class="tv-box-label"><span class="tv-box-flag">${flagImg(ch.cc)}</span>`
      + `<span class="tv-box-name">${escapeHtml(ch.name)}</span>`
      + `<span class="tv-box-live">LIVE</span></div>`;
    b.onclick = () => loadChannel(ch);
    grid.appendChild(b);
  }
  loadChannel(CHANNELS[0]);   // first channel on the big screen
  populateThumbs();           // fill every small box with its live thumbnail
}

const boxFor = (handle) => document.querySelector('.tv-box[data-handle="' + handle + '"]');

// Paint a small box: live thumbnail + LIVE badge, or an offline placeholder.
function paintBox(ch, info) {
  const box = boxFor(ch.handle);
  if (!box) return;
  const badge = box.querySelector('.tv-box-live');
  if (info && info.videoId) {
    box.classList.remove('offline');
    const thumb = box.querySelector('.tv-box-thumb');
    let img = thumb.querySelector('.thumb-img');
    if (!img) { img = document.createElement('img'); img.className = 'thumb-img'; img.alt = ch.name; img.onerror = () => img.remove(); thumb.appendChild(img); }
    img.src = `https://i.ytimg.com/vi/${info.videoId}/mqdefault.jpg?r=${Date.now()}`;
    badge.classList.toggle('on', !!info.live);
  } else {
    box.classList.add('offline');
    badge.classList.remove('on');
  }
}

// Thumbnails use the cheap scrape (t=1) so they never consume Data-API quota.
async function resolveChannel(ch) {
  const r = await fetch('/api/live?h=' + encodeURIComponent(ch.handle) + '&t=1', { cache: 'no-store' });
  const j = await r.json();
  tvInfo[ch.handle] = j;
  return j;
}
function populateThumbs() {
  CHANNELS.forEach((ch) => resolveChannel(ch).then((j) => paintBox(ch, j)).catch(() => {}));
}
// refresh the still frames so the wall keeps feeling live
function refreshThumbs() {
  CHANNELS.forEach((ch) => { if (tvInfo[ch.handle]) paintBox(ch, tvInfo[ch.handle]); });
}

async function loadChannel(ch) {
  state.tv = ch;
  document.querySelectorAll('.tv-box').forEach((b) => b.classList.toggle('active', b.dataset.handle === ch.handle));
  $('#tv-open').href = 'https://www.youtube.com/' + ch.handle + '/live';
  const wrap = $('#tv-frame-wrap');
  $('#tv-status').textContent = 'connecting…';
  wrap.innerHTML = `<div class="tv-loading"><div class="spinner"></div>Tuning in to ${escapeHtml(ch.name)}…</div>`;
  const my = ++tvToken;
  try {
    // Watching: resolve fresh via the reliable path (Data API in prod) — not the
    // thumbnail's scrape cache, so the big screen gets the true live stream.
    const r = await fetch('/api/live?h=' + encodeURIComponent(ch.handle), { cache: 'no-store' });
    const info = await r.json();
    tvInfo[ch.handle] = info;
    if (my !== tvToken) return;
    if (!info.videoId) throw new Error('offline');
    wrap.innerHTML = `<iframe class="tv-frame" src="https://www.youtube-nocookie.com/embed/${info.videoId}`
      + `?autoplay=1&mute=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" `
      + `allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    $('#tv-status').innerHTML = `<span class="tvs${info.live ? ' on' : ''}">${svgIcon(info.live ? 'live' : 'tv')} ${info.live ? 'LIVE' : 'On now'} · ${escapeHtml(ch.name)}</span>`;
    paintBox(ch, info);
  } catch (err) {
    if (my !== tvToken) return;
    wrap.innerHTML = `<div class="tv-loading">${svgIcon('offline')} ${escapeHtml(ch.name)} isn’t streaming right now.`
      + `<a href="https://www.youtube.com/${ch.handle}/live" target="_blank" rel="noopener">Open on YouTube ${svgIcon('external')}</a></div>`;
    $('#tv-status').textContent = 'offline';
  }
}

// Scroll a row into view WITHIN the countries list only — never the whole page.
function scrollListItem(row) {
  const list = $('#country-list');
  if (!list || !row) return;
  const lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
  if (rr.top < lr.top) list.scrollTop -= (lr.top - rr.top) + 8;
  else if (rr.bottom > lr.bottom) list.scrollTop += (rr.bottom - lr.bottom) + 8;
}

function selectCountry(id, name, opts = {}) {
  const o = typeof opts === 'boolean' ? { syncSelect: opts } : opts;
  const { syncSelect = true, drawer = true, scrollList = true, rotate = false } = o;
  // highlight on both flat + globe maps
  state.countryPaths.forEach((p) => p.classList.remove('selected'));
  state.globePaths.forEach((p) => p.classList.remove('selected'));
  if (id) {
    const p = state.countryPaths.get(id);
    if (p) { p.classList.add('selected'); name = name || p.dataset.name; }
    const gp = state.globePaths.get(id);
    if (gp) gp.classList.add('selected');
    state.country = { id, name };
  } else {
    state.country = null;
  }
  // sync the countries side panel highlight (scroll only the list, not the page)
  document.querySelectorAll('.c-item').forEach((r) => r.classList.toggle('active', r.dataset.id === (id || '')));
  if (scrollList) scrollListItem(document.querySelector('.c-item.active'));
  if (syncSelect) $('#country-select').value = id || '';
  state.search = ''; $('#search-input').value = '';
  runNews();
  if (rotate && id) rotateToCountryById(id);
  if (drawer) {
    if (state.country) openCountryDrawer(state.country);
    else closeCountryDrawer();
  }
}

/* ==========================================================================
   COUNTRY INTELLIGENCE DRAWER
   Real data (in-country hazards + live headlines) plus indices *derived*
   from live news signals — clearly labelled as indicative, not official.
   ========================================================================== */
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pointInFeature(lon, lat, f) {
  const g = f && f.geometry;
  if (!g) return false;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    if (pointInRing(lon, lat, poly[0])) {
      let hole = false;
      for (let k = 1; k < poly.length; k++) if (pointInRing(lon, lat, poly[k])) { hole = true; break; }
      if (!hole) return true;
    }
  }
  return false;
}
function hazardsInCountry(id, name) {
  const f = WORLD_GEOJSON.features.find((x) => x.id === id);
  const nm = (name || '').toLowerCase();
  return state.hazards.filter((h) => {
    if (h.place && nm && h.place.toLowerCase().includes(nm)) return true;
    if (f && isFinite(h.lat) && isFinite(h.lon)) return pointInFeature(h.lon, h.lat, f);
    return false;
  }).sort((a, b) => (SEV_RANK[a.sev] - SEV_RANK[b.sev]) || (b.time - a.time));
}

function gnewsUrl(country, query) {
  const ed = editionFor(country);
  const p = `hl=${ed.hl}&gl=${ed.gl}&ceid=${encodeURIComponent(ed.ceid)}`;
  if (query) return `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' ' + country.name)}&${p}`;
  if (ed.curated) return `https://news.google.com/rss?${p}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(country.name)}&${p}`;
}
async function fetchHeadlines(url) {
  try { return parseNews(await fetchText(url)).slice(0, 25); } catch { return []; }
}
// recency-weighted volume of live coverage → 0-100 signal
function signalScore(articles) {
  const now = Date.now();
  let s = 0;
  for (const a of articles) {
    const ageH = a.time && !isNaN(a.time) ? (now - a.time.getTime()) / 3.6e6 : 96;
    s += ageH < 24 ? 5.5 : ageH < 72 ? 3.2 : ageH < 168 ? 1.6 : 0.6;
  }
  return Math.min(100, Math.round(s));
}
const sigColor = (s) => s >= 70 ? 'var(--sev-extreme)' : s >= 45 ? 'var(--sev-high)' : s >= 25 ? 'var(--sev-moderate)' : s >= 10 ? '#7fd8ff' : 'var(--sev-low)';
const sigLevel = (s) => s >= 70 ? 'Severe' : s >= 45 ? 'High' : s >= 25 ? 'Elevated' : s >= 10 ? 'Moderate' : 'Low';
const actLevel = (s) => s >= 55 ? 'High' : s >= 30 ? 'Active' : s >= 12 ? 'Moderate' : 'Quiet';
const resColor = (r) => r >= 70 ? 'var(--sev-low)' : r >= 50 ? 'var(--sev-moderate)' : r >= 30 ? 'var(--sev-high)' : 'var(--sev-extreme)';

function miniHeadlines(articles, n) {
  if (!articles.length) return '<div class="cd-empty">No recent reports.</div>';
  return articles.slice(0, n).map((a) => {
    const others = (a.related || []).filter((r) => r.link !== a.link).length;
    return `<a class="cd-mini" href="${escapeHtml(a.link)}" data-nid="${escapeHtml(a.nid || regNews(a))}" target="_blank" rel="noopener">`
      + `<span class="cd-mini-t">${escapeHtml(a.title)}</span>`
      + `<span class="cd-mini-m"><span class="src">${escapeHtml(a.source || 'News')}</span> · ${relTime(a.time)}${relTime(a.time) === 'now' ? '' : ' ago'}`
      + (others ? ` · <span class="cov">+${others}</span>` : '') + '</span></a>';
  }).join('');
}
function metricCard(name, big, pct, color, note, wide) {
  return `<div class="metric${wide ? ' wide' : ''}">`
    + `<div class="metric-head"><span class="metric-name">${name}</span><span class="metric-val" style="color:${color}">${big}</span></div>`
    + `<div class="gauge"><span style="width:${clamp(pct, 2, 100)}%;background:${color}"></span></div>`
    + (note ? `<div class="metric-note">${note}</div>` : '') + '</div>';
}

/* ---- maritime: real IMF PortWatch port activity (satellite AIS) ------- */
const PORTWATCH_URL = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Ports_Data/FeatureServer/0/query';
const fmtTons = (n) => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(Math.round(n)); };
async function portwatchWindow(iso3, fromISO, toISO) {
  const stats = JSON.stringify([
    { statisticType: 'sum', onStatisticField: 'portcalls_tanker', outStatisticFieldName: 'tcalls' },
    { statisticType: 'sum', onStatisticField: 'import', outStatisticFieldName: 'imp' },
    { statisticType: 'sum', onStatisticField: 'export', outStatisticFieldName: 'exp' },
  ]);
  const where = `ISO3='${iso3}' AND date >= DATE '${fromISO}' AND date < DATE '${toISO}'`;
  const url = PORTWATCH_URL + '?where=' + encodeURIComponent(where) + '&outStatistics=' + encodeURIComponent(stats)
    + '&groupByFieldsForStatistics=portname&orderByFields=' + encodeURIComponent('tcalls DESC') + '&resultRecordCount=10&f=json';
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();
  return (j.features || []).map((f) => f.attributes);
}
async function loadMaritime(iso3) {
  const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const [cur, prev] = await Promise.all([portwatchWindow(iso3, d(30), d(0)), portwatchWindow(iso3, d(60), d(30))]);
  const pm = {}; prev.forEach((a) => { pm[a.portname] = a.tcalls; });
  return cur.filter((a) => a.tcalls > 0).map((a) => {
    const p = pm[a.portname];
    const trend = (p && p > 0) ? ((a.tcalls - p) / p) * 100 : null;
    return { port: a.portname, calls: a.tcalls, imp: a.imp, exp: a.exp, trend };
  });
}
function maritimeTable(rows) {
  if (!rows || !rows.length) return '<div class="cd-empty">No PortWatch tanker activity for this country.</div>';
  const head = '<div class="mt-row mt-head"><span>Port</span><span>Tanker<br>calls 30d</span><span>Trend</span><span>Import</span><span>Export</span></div>';
  const body = rows.slice(0, 8).map((r) => {
    const tr = r.trend == null ? '<span class="mt-flat">—</span>'
      : r.trend >= 0 ? `<span class="mt-up">+${r.trend.toFixed(1)}%</span>` : `<span class="mt-down">${r.trend.toFixed(1)}%</span>`;
    return `<div class="mt-row"><span class="mt-port">${escapeHtml(r.port)}</span>`
      + `<span class="mt-n">${r.calls}</span><span class="mt-t">${tr}</span>`
      + `<span class="mt-n">${fmtTons(r.imp)}</span><span class="mt-n">${fmtTons(r.exp)}</span></div>`;
  }).join('');
  return `<div class="mt-table">${head}${body}</div><div class="mt-src">Source: IMF PortWatch · satellite AIS · trailing 30 days (tons)</div>`;
}

const cdSection = (icon, title, count, inner) =>
  `<div class="cd-section"><div class="cd-section-h">${svgIcon(icon)} ${title}`
  + (count !== '' && count != null ? ` <span class="n">${count}</span>` : '') + `</div>${inner}</div>`;

let drawerToken = 0;
async function openCountryDrawer(country) {
  const my = ++drawerToken;
  const drawer = $('#country-drawer');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  pushLayer(drawer, closeCountryDrawer);
  $('#cd-flag').innerHTML = flag(country.id);
  $('#cd-name').textContent = country.name;
  reflectTranslateButtons();

  const dis = hazardsInCountry(country.id, country.name);
  const alerts = dis.filter((h) => h.sev === 'extreme' || h.sev === 'high').length;

  $('#cd-body').innerHTML =
    '<div class="cd-metrics"><div class="skel cd-skel"></div><div class="skel cd-skel"></div></div>'
    + cdSection('hazard', 'Disasters &amp; Hazards', dis.length, `<div id="cd-haz-list">${drawerDisasters(dis)}</div>`)
    + cdSection('tv', 'Live Cameras', '', '<div id="cd-cams"><div class="skel cd-skel"></div></div>')
    + cdSection('target', 'Aircraft Overhead', '', '<div id="cd-flights"><div class="skel cd-skel"></div></div>')
    + '<div id="cd-energy"><div class="skel cd-skel"></div></div>'
    + cdSection('tsunami', 'Maritime Activity', '', '<div id="cd-maritime"><div class="skel cd-skel"></div></div>')
    + '<div id="cd-topnews"></div>'
    + cdSection('flag', 'Wanted — Public Notices', '', '<div id="cd-wanted"><div class="skel cd-skel"></div></div>')
    + cdSection('news', 'Missing Persons — Appeals', '', '<div id="cd-missing"><div class="skel cd-skel"></div></div>')
    + '<div class="cd-disclaim">Instability, resilience &amp; energy readings are indices <b>derived from live open-source news volume</b> — indicative signals, not official measurements. Maritime figures are real port activity from <b>IMF PortWatch</b>; disasters &amp; headlines are live from USGS · NASA · GDACS · Google News. Wanted notices are official INTERPOL/FBI appeals — presumption of innocence applies. Missing-person appeals are official INTERPOL Yellow Notices — if you have information, please contact the authorities.</div>';
  bindDrawerHazards();
  renderCountryWanted(country);    // official wanted notices linked to this country
  renderCountryMissing(country);   // official missing-person appeals linked to this country
  renderCountryCams(country, my);      // public cameras inside the country polygon
  renderCountryFlights(country, my);   // aircraft currently over it

  // maritime port table — real PortWatch data (loads independently)
  loadMaritime(country.id)
    .then((rows) => { if (my === drawerToken) $('#cd-maritime').innerHTML = maritimeTable(rows); })
    .catch(() => { if (my === drawerToken) $('#cd-maritime').innerHTML = '<div class="cd-empty">PortWatch data unavailable.</div>'; });

  const [top, conflict, energy] = await Promise.all([
    fetchHeadlines(gnewsUrl(country, '')),
    fetchHeadlines(gnewsUrl(country, 'war OR conflict OR unrest OR protest OR coup OR crisis OR clashes OR military OR sanctions OR violence')),
    fetchHeadlines(gnewsUrl(country, 'power outage OR blackout OR grid OR electricity OR "fuel shortage" OR pipeline OR "energy crisis" OR refinery')),
  ]);
  if (my !== drawerToken) return;

  const instability = Math.min(100, signalScore(conflict) + alerts * 6);
  const energyS = signalScore(energy);
  const resilience = clamp(Math.round(90 - instability * 0.55 - dis.length * 3 - energyS * 0.12), 6, 96);

  $('#cd-body').querySelector('.cd-metrics').outerHTML =
    '<div class="cd-metrics">'
    + metricCard('Instability Index', instability, instability, sigColor(instability), `${sigLevel(instability)} · from ${conflict.length} conflict/crisis reports`)
    + metricCard('Resilience Score', resilience, resilience, resColor(resilience), 'Estimated stability outlook')
    + '</div>';

  $('#cd-energy').innerHTML = cdSection('gear', `Energy Disruptions · <span style="color:${sigColor(energyS)}">${actLevel(energyS)}</span>`, energy.length, miniHeadlines(energy, 3));
  $('#cd-topnews').innerHTML = cdSection('news', 'Top News', top.length >= 25 ? '25+' : top.length, miniHeadlines(top, 6));
  translateDom('#cd-body .cd-mini-t');
}

/* ==========================================================================
   COUNTRY INTELLIGENCE — cameras and aircraft for the selected country.
   Both are fetched for the country's bounding box and then filtered against
   the actual polygon, so a box that overlaps a neighbour doesn't borrow its
   traffic. Every row is clickable: it turns the layer on, flies the globe to
   the subject and opens its card.
   ========================================================================== */
function countryBBox(f) {
  const g = f && f.geometry;
  if (!g) return null;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let w = 180, s = 90, e = -180, n = -90;
  for (const poly of polys) for (const ring of poly) for (const pt of ring) {
    if (pt[0] < w) w = pt[0];
    if (pt[0] > e) e = pt[0];
    if (pt[1] < s) s = pt[1];
    if (pt[1] > n) n = pt[1];
  }
  return e > w ? { w, s, e, n } : null;
}

/* ---- cameras ----------------------------------------------------------- */
async function renderCountryCams(country, token) {
  const el = $('#cd-cams');
  if (!el) return;
  const f = WORLD_GEOJSON.features.find((x) => x.id === country.id);
  const bb = f && countryBBox(f);
  if (!bb) { el.innerHTML = '<div class="cd-empty">No boundary data for this country.</div>'; return; }
  try {
    const data = await jget('/api/webcams?limit=600&bbox='
      + [bb.w, bb.s, bb.e, bb.n].map((v) => v.toFixed(3)).join(','));
    if (token !== drawerToken) return;
    const src = data.sources || [];
    const all = (data.cams || []).filter((c) => pointInFeature(c[2], c[1], f));
    cdCams = all;
    if (!all.length) {
      el.innerHTML = '<div class="cd-empty">No public camera publishes here. Coverage depends on the road authority — most of the world has none.</div>';
      return;
    }
    const live = all.filter((c) => c[6]).length;
    el.innerHTML = '<div class="cd-cams-sum">' + all.length + ' camera' + (all.length === 1 ? '' : 's')
      + (live ? ' · <b>' + live + ' live video</b>' : ' · stills only') + '</div>'
      + all.slice(0, 14).map((c, i) => {
        const s = src[c[5]] || {};
        return '<div class="cd-row cd-cam" data-i="' + i + '">'
          + '<span class="cd-dot" style="background:' + (c[6] ? CAM_LIVE_COLOR : CAM_COLOR) + '"></span>'
          + '<span class="cd-row-b"><span class="cd-row-t">' + escapeHtml(c[3]) + '</span>'
          + '<span class="cd-row-m">' + escapeHtml(s.name || '') + '</span></span>'
          + '<span class="cd-tag ' + (c[6] ? 'live' : '') + '">' + (c[6] ? 'LIVE' : 'STILL') + '</span></div>';
      }).join('')
      + (all.length > 14 ? '<div class="cd-more">+' + (all.length - 14) + ' more on the map</div>' : '');
    el.querySelectorAll('.cd-cam').forEach((row) => {
      row.onclick = () => {
        const c = cdCams[+row.dataset.i];
        if (c) focusCamera({ id: c[0], lat: c[1], lon: c[2], name: c[3], img: c[4], src: c[5], stream: c[6] || '' });
      };
    });
  } catch (e) {
    if (token === drawerToken) el.innerHTML = '<div class="cd-empty">Camera index unavailable.</div>';
  }
}
let cdCams = [], cdFlights = [];

// Turn the layer on, fly there, open the card — from anywhere in the UI.
function focusCamera(c) {
  if (!camsOn) { camsOn = true; $('#toggle-cams').classList.remove('off'); camBox = null; }
  if (!state.globe.on) setMapMode('globe');
  rotateTo(c.lon, c.lat, null, 12);
  cams = cams.some((x) => x.id === c.id) ? cams : cams.concat([c]);
  syncCams();
  refreshCams(true);
  openCam(c);
  closeCountryDrawer();
}

/* ---- aircraft ---------------------------------------------------------- */
async function renderCountryFlights(country, token) {
  const el = $('#cd-flights');
  if (!el) return;
  const f = WORLD_GEOJSON.features.find((x) => x.id === country.id);
  const c = f && featureCentroid(f);
  if (!c) { el.innerHTML = '<div class="cd-empty">No boundary data for this country.</div>'; return; }
  try {
    const data = await jget('/api/flights?lat=' + c[1].toFixed(3) + '&lon=' + c[0].toFixed(3) + '&dist=250');
    if (token !== drawerToken) return;
    const ts = data.ts || Date.now();
    const all = (data.flights || [])
      .filter((a) => pointInFeature(a[3], a[2], f))
      .map((a) => ({
        id: a[0], cs: (a[1] || '').trim(), lat0: a[2], lon0: a[3], lat: a[2], lon: a[3],
        alt0: a[4] || 0, alt: a[4] || 0, spd: a[5] || 0, trk: a[6] || 0, vr: a[7] || 0,
        type: a[8] || '', reg: a[9] || '', desc: a[10] || '', cty: a[12] || '',
        t0: ts - (a[11] || 0) * 1000,
      }))
      .sort((x, y) => y.alt - x.alt);
    cdFlights = all;
    if (!all.length) {
      el.innerHTML = '<div class="cd-empty">No aircraft being tracked over this country right now. ADS-B cover is thin outside Europe and North America.</div>';
      return;
    }
    const air = all.filter((a) => !onGround(a)).length;
    el.innerHTML = '<div class="cd-cams-sum">' + all.length + ' tracked · ' + air + ' airborne</div>'
      + all.slice(0, 14).map((a, i) =>
        '<div class="cd-row cd-flight" data-i="' + i + '">'
        + '<span class="cd-dot" style="background:' + flightColor(a.alt) + '"></span>'
        + '<span class="cd-row-b"><span class="cd-row-t">' + escapeHtml(a.cs || a.reg || a.id)
        + '<span class="cd-leg" data-cs="' + escapeHtml(a.cs) + '"></span></span>'
        + '<span class="cd-row-m">' + escapeHtml(a.desc || a.type || '')
        + (a.reg && a.cs ? ' · ' + escapeHtml(a.reg) : '') + '</span></span>'
        + '<span class="cd-tag">' + (onGround(a) ? 'GND' : altLabel(a.alt)) + '</span></div>').join('')
      + (all.length > 14 ? '<div class="cd-more">+' + (all.length - 14) + ' more on the map</div>' : '');
    el.querySelectorAll('.cd-flight').forEach((row) => {
      row.onclick = () => { const a = cdFlights[+row.dataset.i]; if (a) focusFlight(a); };
    });
    // Fill in origin → destination as the lookups come back, without blocking the list.
    el.querySelectorAll('.cd-leg').forEach(async (span) => {
      const r = await flightRoute(span.dataset.cs);
      if (token !== drawerToken || !r) return;
      span.textContent = '  ' + r.from.iata + ' → ' + r.to.iata;
    });
  } catch (e) {
    if (token === drawerToken) el.innerHTML = '<div class="cd-empty">Flight feed unavailable.</div>';
  }
}

function focusFlight(a) {
  if (!flightsOn) { flightsOn = true; $('#toggle-flights').classList.remove('off'); flightKey = ''; }
  if (!state.globe.on) setMapMode('globe');
  flights = flights.some((x) => x.id === a.id) ? flights : flights.concat([a]);
  rotateTo(a.lon, a.lat, null, 9);
  syncFlights();
  refreshFlights(true);
  openFlightCard(a);
  closeCountryDrawer();
}

function drawerDisasters(dis) {
  if (!dis.length) return '<div class="cd-empty">No active hazards detected in-country.</div>';
  return dis.slice(0, 8).map((h, i) =>
    `<div class="cd-haz" data-i="${i}">`
    + `<span class="cd-haz-ic" style="color:var(--sev-${h.sev})">${svgIcon(h.icon)}</span>`
    + `<span class="cd-haz-b"><span class="cd-haz-t">${escapeHtml(h.title)}</span>`
    + `<span class="cd-haz-m">${escapeHtml(h.kind)}${h.mag ? ' · M' + h.mag : ''} · ${relTime(h.time)} ago</span></span>`
    + `<span class="d-sev sev-${h.sev}">${h.mag ? 'M' + h.mag : h.sev}</span></div>`).join('');
}
function bindDrawerHazards() {
  const country = state.country;
  if (!country) return;
  const dis = hazardsInCountry(country.id, country.name);
  $('#cd-haz-list') && $('#cd-haz-list').querySelectorAll('.cd-haz').forEach((row) => {
    row.onclick = () => { const h = dis[+row.dataset.i]; if (h) focusHazard(h); };
  });
}
function closeCountryDrawer() {
  drawerToken++;
  const drawer = $('#country-drawer');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  popLayer(drawer);
}

/* ==========================================================================
   CLOCK + LIFECYCLE
   ========================================================================== */
function tickClock() {
  const d = new Date();
  $('#clock').textContent = d.toISOString().slice(11, 19);
}

async function refreshAll(manual) {
  const btn = $('#refresh-btn');
  btn.classList.add('loading');
  await Promise.allSettled([loadHazards(), runNews()]);
  btn.classList.remove('loading');
  if (manual) toast('Feeds refreshed');
}

function init() {
  buildMap();
  buildCountrySelect();
  buildCountryPanel();
  buildCatTabs();
  buildTV();

  // Google-Earth view by default: globe + satellite + slow auto-spin
  svg.classList.add('sat');
  $('#toggle-sat').classList.remove('off');
  setMapMode('globe');
  loadTexture();
  startGlobeLoop();
  if (new URLSearchParams(location.search).has('enso')) $('#toggle-enso').click();

  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.search = $('#search-input').value.trim();
    setActiveCat(null);
    runNews();
  });
  $('#refresh-btn').onclick = () => refreshAll(true);
  reflectTranslateButtons();
  $('#toggle-translate').onclick = () => setTranslate(!translateOn);
  $('#cd-translate').onclick = () => setTranslate(!translateOn);
  $('#cd-close').onclick = () => closeCountryDrawer();

  tickClock();
  poll(tickClock, 1000);

  loadHazards();
  runNews();
  loadStorms();                       // cyclone tracks on by default

  poll(loadHazards, 180000);          // hazards every 3 min
  poll(() => runNews(), 240000);      // news every 4 min
  poll(refreshThumbs, 60000);         // live thumbnails every 1 min
  poll(() => loadStorms(true), 900000); // cyclone tracks every 15 min (GDACS updates ~6-hourly)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* ==========================================================================
   MONITOR — event history ("what's new"), 24h pulse, and push alerts.
   Talks to the server-side ingestion backend (/api/events, /api/subscribe).
   Degrades silently when the backend isn't configured yet.
   ========================================================================== */
const MON = { pushEnabled: false, publicKey: '', subscribed: false, reg: null };
const LS = {
  rules: 'wm-rules', watch: 'wm-watchlist', lastSeen: 'wm-lastseen', subscribed: 'wm-subscribed',
};

function urlB64ToUint8(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const jget = (url) => fetch(url, { cache: 'no-store' }).then((r) => r.json());
const jsend = (url, method, body) =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

/* -------- rule state <-> UI --------------------------------------------- */
function defaultRules() {
  return {
    quake: { on: true, mag: 6 },
    alert: { on: true, sev: 'high', watchOnly: false },
    cyclone: { on: true, cat: 3 },
    event: { on: false },
  };
}
function loadRules() {
  try { return Object.assign(defaultRules(), JSON.parse(localStorage.getItem(LS.rules) || '{}')); }
  catch { return defaultRules(); }
}
function loadWatch() {
  try { return JSON.parse(localStorage.getItem(LS.watch) || '[]'); } catch { return []; }
}
let monWatch = [];

function writeRulesUI(r) {
  $('#r-quake').checked = r.quake.on;
  $('#r-quake-mag').value = String(r.quake.mag);
  $('#r-alert').checked = r.alert.on;
  $('#r-alert-sev').value = r.alert.sev;
  $('#r-alert-watch').checked = r.alert.watchOnly;
  $('#r-cyclone').checked = r.cyclone.on;
  $('#r-cyclone-cat').value = String(r.cyclone.cat);
  $('#r-event').checked = r.event.on;
}
function readRulesUI() {
  return {
    quake: { on: $('#r-quake').checked, mag: Number($('#r-quake-mag').value) },
    alert: { on: $('#r-alert').checked, sev: $('#r-alert-sev').value, watchOnly: $('#r-alert-watch').checked },
    cyclone: { on: $('#r-cyclone').checked, cat: Number($('#r-cyclone-cat').value) },
    event: { on: $('#r-event').checked },
  };
}
// UI state -> server rule list
function rulesPayload(r) {
  const out = [];
  if (r.quake.on) out.push({ type: 'quake', minMag: r.quake.mag });
  if (r.alert.on) out.push({ type: 'alert', minSev: r.alert.sev, countries: r.alert.watchOnly ? monWatch : [] });
  if (r.cyclone.on) out.push({ type: 'cyclone', minCat: r.cyclone.cat });
  if (r.event.on) out.push({ type: 'event' });
  return out;
}

let syncTimer;
function persistRules() {
  const r = readRulesUI();
  localStorage.setItem(LS.rules, JSON.stringify(r));
  localStorage.setItem(LS.watch, JSON.stringify(monWatch));
  updateArmedSummary(r);
  if (MON.subscribed) {                       // push new rules to the server (debounced)
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncSubscription, 500);
  }
}
function updateArmedSummary(r) {
  const n = rulesPayload(r).length;
  const armed = MON.subscribed && n > 0;
  $('#alerts-dot').hidden = !armed;
  const st = $('#drw-status');
  if (st) st.textContent = MON.subscribed ? (n + ' rule' + (n === 1 ? '' : 's') + ' armed') : '';
}

/* -------- watchlist chips ----------------------------------------------- */
function renderWatchChips() {
  const box = $('#drw-watch-chips');
  box.innerHTML = '';
  monWatch.forEach((name) => {
    const chip = el('span', 'watch-chip', escapeHtml(name) + ' <b>×</b>');
    chip.querySelector('b').onclick = () => { monWatch = monWatch.filter((x) => x !== name); renderWatchChips(); persistRules(); };
    box.appendChild(chip);
  });
}
let watchSelectFilled = false;
function fillWatchSelect() {
  if (watchSelectFilled) return;
  const src = $('#country-select');
  const dst = $('#drw-watch-select');
  if (!src || !dst || !src.options.length) return;
  const frag = ['<option value="">Add a country…</option>'];
  [...src.options].forEach((o) => { const nm = o.dataset && o.dataset.name; if (nm) frag.push(`<option value="${escapeHtml(nm)}">${escapeHtml(nm)}</option>`); });
  dst.innerHTML = frag.join('');
  watchSelectFilled = true;
}

/* -------- push enable / disable ----------------------------------------- */
function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
async function ensureReg() {
  if (MON.reg) return MON.reg;
  MON.reg = await navigator.serviceWorker.register('/sw.js');
  return MON.reg;
}
async function enablePush() {
  if (!pushSupported()) { toast('This browser can’t receive push notifications', true); return false; }
  if (!MON.pushEnabled) { showNote('The alerts backend isn’t configured on the server yet.'); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    if (perm === 'denied') showNote('Notifications are blocked for this site. Click the site/🔒 icon in the address bar → set Notifications to “Allow”, then toggle again.');
    toast('Notifications not allowed', true);
    return false;
  }
  hideNote();
  const reg = await ensureReg();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(MON.publicKey) });
  }
  const res = await jsend('/api/subscribe', 'POST', { subscription: sub.toJSON(), rules: rulesPayload(readRulesUI()) });
  if (!res || res.ok === false) { toast('Could not register with the server', true); return false; }
  MON.subscribed = true;
  localStorage.setItem(LS.subscribed, '1');
  return true;
}
async function disablePush() {
  try {
    const reg = await ensureReg();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await jsend('/api/subscribe', 'DELETE', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch { /* best-effort */ }
  MON.subscribed = false;
  localStorage.removeItem(LS.subscribed);
}
async function syncSubscription() {
  try {
    const reg = await ensureReg();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await jsend('/api/subscribe', 'POST', { subscription: sub.toJSON(), rules: rulesPayload(readRulesUI()) });
    const st = $('#drw-status'); if (st) { st.textContent = 'Rules updated'; setTimeout(() => updateArmedSummary(readRulesUI()), 1200); }
  } catch { /* ignore */ }
}
function reflectPushUI() {
  const on = MON.subscribed;
  const denied = window.Notification && Notification.permission === 'denied';
  $('#drw-toggle').setAttribute('aria-checked', on ? 'true' : 'false');
  $('#drw-toggle').classList.toggle('on', on);
  $('#drw-perm-state').textContent = !MON.pushEnabled ? 'Unavailable'
    : on ? 'On — armed' : (denied ? 'Blocked' : 'Off');
  // Test stays clickable so it can explain itself; it's just de-emphasised when off.
  $('#drw-test').classList.toggle('dim', !on);
  if (MON.pushEnabled && denied && !on) {
    showNote('Notifications are blocked for this site. Click the site/🔒 icon in the address bar → set Notifications to “Allow”, then toggle again.');
  } else if (MON.pushEnabled) {
    hideNote();
  }
  updateArmedSummary(readRulesUI());
}
function showNote(msg) { const n = $('#drw-note'); if (!n) return; n.textContent = msg; n.hidden = false; }
function hideNote() { const n = $('#drw-note'); if (n) n.hidden = true; }

/* -------- drawer open/close --------------------------------------------- */
let feedTimer = null;
function openAlerts() {
  fillWatchSelect(); reflectPushUI(); loadAlertFeed();
  unpoll(feedTimer);
  feedTimer = poll(loadAlertFeed, 60000);   // live-refresh the feed while open
  $('#alert-drawer').classList.add('open'); $('#alert-drawer').setAttribute('aria-hidden', 'false');
  pushLayer($('#alert-drawer'), closeAlerts);
}
function closeAlerts() {
  unpoll(feedTimer); feedTimer = null;
  $('#alert-drawer').classList.remove('open'); $('#alert-drawer').setAttribute('aria-hidden', 'true');
  popLayer($('#alert-drawer'));
}

/* -------- recent activity feed (inside the console) --------------------- */
// Client mirror of lib/rules.js matchEvent — for highlighting "would alert".
function monMatch(e, rules) {
  const rank = { extreme: 4, high: 3, moderate: 2, low: 1 };
  return rules.some((r) => {
    if (r.type === 'quake') return e.layer === 'quakes' && (e.mag || 0) >= r.minMag;
    if (r.type === 'cyclone') return e.eventtype === 'TC' && (e.cat || 0) >= r.minCat;
    if (r.type === 'event') return e.layer === 'events';
    if (r.type === 'alert') {
      const okSev = (rank[e.sev] || 0) >= (rank[r.minSev] || 0);
      const hay = ((e.country || '') + ' ' + (e.place || '') + ' ' + (e.title || '')).toLowerCase();
      const okC = !r.countries || !r.countries.length || r.countries.some((c) => c && hay.includes(String(c).toLowerCase()));
      return e.layer === 'alerts' && okSev && okC;
    }
    return false;
  });
}
let feedSeen = null;   // ids already shown this session → anything else is "NEW"
async function loadAlertFeed() {
  const box = $('#drw-feed'); if (!box) return;
  const data = await jget('/api/events?since=0&limit=80').catch(() => null);
  if (!data || data.configured === false) { box.innerHTML = '<div class="drw-feed-empty">Activity history isn’t available yet.</div>'; return; }
  const rules = rulesPayload(readRulesUI());
  const mineOnly = $('#drw-feed-mine') && $('#drw-feed-mine').checked;
  const all = data.events || [];
  const firstLoad = feedSeen === null;
  if (firstLoad) feedSeen = new Set();                       // baseline: don't flag the first batch
  const events = mineOnly ? all.filter((e) => monMatch(e, rules)) : all;
  const newCount = all.filter((e) => !firstLoad && !feedSeen.has(e.id)).length;
  if (!events.length) {
    box.innerHTML = '<div class="drw-feed-empty">' + (mineOnly ? 'No recent events match your rules.' : 'No recent activity.') + '</div>';
  } else {
    box.innerHTML = events.slice(0, 80).map((e) => {
      const hit = monMatch(e, rules);
      const isNew = !firstLoad && !feedSeen.has(e.id);
      return `<a class="drw-fi${hit ? ' hit' : ''}${isNew ? ' fresh' : ''}" href="${escapeHtml(e.url || '#')}" target="_blank" rel="noopener" title="${escapeHtml(e.title || '')}">
        <span class="wn-sev sev-${e.sev || 'low'}"></span>
        <span class="drw-fi-main">${isNew ? '<span class="drw-fi-new">NEW</span> ' : ''}<span class="drw-fi-kind">${escapeHtml(e.kind || '')}</span> ${escapeHtml(e.title || '')}</span>
        <span class="wn-ago">${relTime(new Date(e.time))}</span></a>`;
    }).join('');
  }
  all.forEach((e) => feedSeen.add(e.id));                    // mark all seen so a filter toggle doesn't re-flag
  // surface a fresh-count badge on the section label
  const badge = $('#drw-feed-badge');
  if (badge) { badge.textContent = newCount ? '+' + newCount + ' new' : ''; badge.hidden = !newCount; }
}

/* -------- "what's new since I last looked" ------------------------------ */
async function refreshWhatsNew() {
  const last = Number(localStorage.getItem(LS.lastSeen) || 0);
  if (!last) { localStorage.setItem(LS.lastSeen, String(Date.now())); return; } // first visit: nothing "new"
  const data = await jget('/api/events?since=' + last + '&limit=60').catch(() => null);
  if (!data || data.configured === false) return;
  const events = data.events || [];
  const banner = $('#whatsnew');
  if (!events.length) { banner.hidden = true; return; }
  banner.hidden = false;
  const sinceTxt = relTime(new Date(last));
  $('#wn-txt').innerHTML = '<b>' + events.length + '</b> new event' + (events.length === 1 ? '' : 's') + ' since you last looked' + (sinceTxt ? ' · ' + sinceTxt + ' ago' : '');
  const list = $('#wn-list');
  list.innerHTML = events.slice(0, 40).map((e) => {
    const cls = 'sev-' + (e.sev || 'low');
    return `<a class="wn-item" href="${escapeHtml(e.url || '#')}" target="_blank" rel="noopener">
      <span class="wn-sev ${cls}"></span>
      <span class="wn-kind">${escapeHtml(e.kind || '')}</span>
      <span class="wn-title">${escapeHtml(e.title || '')}</span>
      <span class="wn-ago">${relTime(new Date(e.time))}</span></a>`;
  }).join('');
}
function markSeen() {
  localStorage.setItem(LS.lastSeen, String(Date.now()));
  $('#whatsnew').hidden = true;
  $('#wn-list').hidden = true;
}

/* -------- 24h pulse (timeline + trends) --------------------------------- */
async function refreshPulse() {
  const data = await jget('/api/events?view=trends&hours=24').catch(() => null);
  if (!data || data.configured === false) return;
  $('#pulse').hidden = false;
  $('#pulse-total').textContent = data.total + ' in 24h';
  drawSpark(data.buckets || []);
  const legend = $('#pulse-legend');
  const chips = [];
  if (data.maxMag) chips.push(`<span class="pl-chip mag">max M${data.maxMag.toFixed(1)}</span>`);
  if (data.severe) chips.push(`<span class="pl-chip sev">${data.severe} severe</span>`);
  (data.topKinds || []).slice(0, 3).forEach((k) => chips.push(`<span class="pl-chip">${escapeHtml(k.name)} <b>${k.count}</b></span>`));
  legend.innerHTML = chips.join('') || '<span class="pl-chip">awaiting ingestion…</span>';
}
function drawSpark(buckets) {
  const svg = $('#pulse-spark');
  const n = buckets.length;
  if (!n) { svg.innerHTML = ''; return; }
  const W = 260, H = 46, pad = 3;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const X = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, n - 1);
  const Y = (v) => H - pad - (v / max) * (H - 2 * pad);
  let line = '', area = `M ${X(0)} ${H - pad}`;
  buckets.forEach((b, i) => { const x = X(i).toFixed(1), y = Y(b.count).toFixed(1); line += (i ? 'L' : 'M') + x + ' ' + y + ' '; area += ' L ' + x + ' ' + y; });
  area += ` L ${X(n - 1)} ${H - pad} Z`;
  const lx = X(n - 1).toFixed(1), ly = Y(buckets[n - 1].count).toFixed(1);
  svg.innerHTML = `<path class="spk-area" d="${area}"/><path class="spk-line" d="${line}"/><circle class="spk-dot" cx="${lx}" cy="${ly}" r="2.2"/>`;
}

/* -------- boot ---------------------------------------------------------- */
async function initMonitor() {
  // populate threshold selects
  const magSel = $('#r-quake-mag');
  for (let m = 4.5; m <= 7.5 + 1e-9; m += 0.5) magSel.appendChild(new Option('M' + m.toFixed(1), String(m)));
  const catSel = $('#r-cyclone-cat');
  for (let c = 1; c <= 5; c++) catSel.appendChild(new Option(String(c), String(c)));

  monWatch = loadWatch();
  writeRulesUI(loadRules());
  renderWatchChips();

  // wire controls
  $('#alerts-btn').onclick = openAlerts;
  $('#drw-close').onclick = closeAlerts;
  // Escape is handled by the layer stack, which closes only the topmost overlay.
  ['#r-quake', '#r-quake-mag', '#r-alert', '#r-alert-sev', '#r-alert-watch', '#r-cyclone', '#r-cyclone-cat', '#r-event']
    .forEach((sel) => { const n = $(sel); if (n) n.addEventListener('change', persistRules); });
  $('#drw-watch-select').addEventListener('change', (e) => {
    const v = e.target.value; if (v && !monWatch.includes(v)) { monWatch.push(v); renderWatchChips(); persistRules(); }
    e.target.value = '';
  });
  $('#drw-toggle').onclick = async () => {
    const t = $('#drw-toggle');
    if (t.disabled || t.classList.contains('busy')) return;
    const turningOn = !MON.subscribed;
    t.classList.add('busy');
    t.classList.toggle('on', turningOn);                       // optimistic: move the knob now
    $('#drw-perm-state').textContent = turningOn ? 'Connecting…' : 'Turning off…';
    if (turningOn) await enablePush(); else await disablePush();
    t.classList.remove('busy');
    reflectPushUI();
    if (MON.subscribed) loadAlertFeed();
  };
  $('#drw-test').onclick = async () => {
    if (!MON.subscribed) { toast('Turn on Push notifications first', true); return; }
    const st = $('#drw-status'); if (st) st.textContent = 'Sending…';
    try {
      const reg = await ensureReg();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { toast('Turn on Push notifications first', true); return; }
      const res = await jsend('/api/subscribe', 'POST', { action: 'test', subscription: sub.toJSON() });
      if (res && res.ok) toast('Test sent — check your notifications');
      else toast('Test failed' + (res && res.status ? ' (' + res.status + ')' : ''), true);
    } catch { toast('Test failed', true); }
    finally { updateArmedSummary(readRulesUI()); }
  };
  $('#drw-feed-mine') && $('#drw-feed-mine').addEventListener('change', loadAlertFeed);
  $('#wn-view').onclick = () => { const l = $('#wn-list'); l.hidden = !l.hidden; };
  $('#wn-close').onclick = markSeen;

  // register the SW up-front so an already-permitted device keeps receiving
  if (pushSupported() && Notification.permission === 'granted') { ensureReg().catch(() => {}); }

  // ask the server what's available
  try {
    const cfg = await jget('/api/subscribe');
    MON.pushEnabled = Boolean(cfg && cfg.enabled);
    MON.publicKey = (cfg && cfg.publicKey) || '';
  } catch { MON.pushEnabled = false; }

  if (!MON.pushEnabled) {
    showNote('Alerts backend isn’t configured yet. Add Upstash + VAPID env vars (see README) to arm push notifications.');
    $('#drw-toggle').disabled = true;
  } else if (localStorage.getItem(LS.subscribed) === '1' && Notification.permission === 'granted') {
    try { const reg = await ensureReg(); MON.subscribed = Boolean(await reg.pushManager.getSubscription()); } catch { MON.subscribed = false; }
  }
  reflectPushUI();

  // history + pulse (independent of push config)
  refreshWhatsNew(); refreshPulse();
  poll(refreshWhatsNew, 120000);
  poll(refreshPulse, 120000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMonitor);
else initMonitor();

/* ==========================================================================
   WANTED — official public notices (INTERPOL Red Notices + FBI Most Wanted).
   Both APIs block server/datacenter fingerprints, so they're fetched straight
   from the browser (real fingerprint + residential IP; both send CORS). This is
   a read-only re-display of official appeals for public awareness — no
   private-individual lookup, tracking, or user-generated accusations.
   ========================================================================== */
let wantedAll = [], wantedLoaded = false, wantedLoading = false, wantedFilter = 'all', wantedSearchT = 0;
const wantedSources = { fbi: false, interpol: false };

const stripTags = (h) => (h || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function fbiHeight(min, max) { if (!min) return ''; const f = (n) => Math.floor(n / 12) + "'" + (n % 12) + '"'; return min === max ? f(min) : f(min) + '–' + f(max); }

function normFbi(it) {
  const img = (it.images || [])[0] || {};
  return {
    source: 'fbi', id: it.uid, name: it.title || 'Unknown',
    photo: img.large || img.original || img.thumb || '', thumb: img.thumb || img.large || img.original || '',
    url: it.url || '', category: (it.subjects && it.subjects[0]) || 'Wanted',
    charges: (it.subjects || []).join(', '),
    caution: stripTags(it.caution), description: stripTags(it.description),
    remarks: stripTags(it.remarks), reward: stripTags(it.reward_text), warning: stripTags(it.warning_message),
    nationality: it.nationality || '', countries: [it.nationality, it.place_of_birth, ...(it.possible_countries || [])].filter(Boolean),
    natCodes: [], dob: (it.dates_of_birth_used || []).join('; '),
    sex: it.sex || '', race: it.race || '', hair: it.hair || it.hair_raw || '', eyes: it.eyes || it.eyes_raw || '',
    build: it.build || '', complexion: it.complexion || '',
    height: fbiHeight(it.height_min, it.height_max), weight: it.weight || '',
    marks: it.scars_and_marks || '', aliases: (it.aliases || []).join(', '),
    languages: (it.languages || []).join(', '), placeOfBirth: it.place_of_birth || '',
    occupations: (it.occupations || []).join(', '), fieldOffices: (it.field_offices || []).join(', '),
  };
}
function normInterpol(n) {
  const l = n._links || {};
  const thumb = (l.thumbnail && l.thumbnail.href) || '';
  return {
    source: 'interpol', id: n.entity_id, name: [n.forename, n.name].filter(Boolean).join(' ') || 'Unknown',
    thumb, photo: thumb, url: 'https://www.interpol.int/en/How-we-work/Notices/Red-Notices/View-Red-Notices',
    detailHref: l.self && l.self.href, imagesHref: l.images && l.images.href,
    category: 'Red Notice', charges: '', nationality: (n.nationalities || []).join(', '),
    countries: (n.nationalities || []), natCodes: (n.nationalities || []),
    dob: (n.date_of_birth || '').replace(/\//g, '-'), sex: '', lazy: true,
  };
}
async function fetchFbiWanted() {
  const res = await Promise.allSettled([1, 2, 3].map((p) =>
    fetch('https://api.fbi.gov/wanted/v1/list?pageSize=50&page=' + p, { headers: { Accept: 'application/json' } }).then((r) => r.ok ? r.json() : null)));
  const items = [];
  for (const r of res) if (r.status === 'fulfilled' && r.value) items.push(...(r.value.items || []));
  const seen = new Set();
  return items.filter((it) => it.uid && !seen.has(it.uid) && seen.add(it.uid)).map(normFbi);
}
async function fetchInterpolWanted() {
  try {
    const r = await fetch('https://ws-public.interpol.int/notices/v1/red?resultPerPage=100&page=1', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return ((j._embedded && j._embedded.notices) || []).map(normInterpol);
  } catch { return null; }   // Interpol edge-blocks some connections → degrade to FBI only
}
// Targeted Red-Notice query (e.g. arrestWarrantCountryId=PH → wanted BY the Philippines).
async function fetchInterpolFiltered(qs) {
  try {
    const r = await fetch('https://ws-public.interpol.int/notices/v1/red?' + qs + '&resultPerPage=100&page=1', { headers: { Accept: 'application/json' } });
    if (!r.ok) return [];
    const j = await r.json();
    return ((j._embedded && j._embedded.notices) || []).map(normInterpol);
  } catch { return []; }
}
async function ensureWanted(force) {
  if (wantedLoading || (wantedLoaded && !force)) return;
  wantedLoading = true;
  const [fbi, ipol] = await Promise.all([fetchFbiWanted().catch(() => []), fetchInterpolWanted()]);
  wantedSources.fbi = !!(fbi && fbi.length);
  wantedSources.interpol = Array.isArray(ipol);
  wantedAll = [...(ipol || []), ...(fbi || [])];
  wantedAll.forEach((p) => { p._key = 'w:' + p.source + ':' + p.id; personReg[p._key] = p; });
  wantedLoaded = true; wantedLoading = false;
}
// INTERPOL uses short reference codes for colours + ISO-639 for languages.
const IP_COLOR = { BLA: 'Black', BRO: 'Brown', BLO: 'Blonde', BLD: 'Blonde', GRY: 'Grey', GRE: 'Green', BLU: 'Blue', HAZ: 'Hazel', RED: 'Red', WHI: 'White', BAL: 'Bald', SAN: 'Sandy', AUB: 'Auburn', MAR: 'Maroon', PIN: 'Pink', VIO: 'Violet', MUL: 'Multicoloured' };
const IP_LANG = { SPA: 'Spanish', ENG: 'English', FRA: 'French', POR: 'Portuguese', ARA: 'Arabic', RUS: 'Russian', DEU: 'German', ITA: 'Italian', ZHO: 'Chinese', JPN: 'Japanese', NLD: 'Dutch', TUR: 'Turkish', POL: 'Polish', RON: 'Romanian', UKR: 'Ukrainian', SRP: 'Serbian', HRV: 'Croatian', ALB: 'Albanian', BUL: 'Bulgarian', ELL: 'Greek', HEB: 'Hebrew', HIN: 'Hindi', URD: 'Urdu', FAS: 'Persian', KOR: 'Korean', VIE: 'Vietnamese', THA: 'Thai', SWE: 'Swedish', CES: 'Czech', SLK: 'Slovak', HUN: 'Hungarian' };
const ipColor = (c) => IP_COLOR[c] || c || '';
// INTERPOL notice detail (charges + descriptors + portrait) — fetched lazily on open.
async function loadInterpolDetail(p) {
  if (!p.lazy) return;
  try {
    const d = await fetch(p.detailHref, { headers: { Accept: 'application/json' } }).then((r) => r.json());
    p.charges = (d.arrest_warrants || []).map((w) => stripTags(w.charge) + (w.issuing_country_id ? ' (' + w.issuing_country_id + ')' : '')).join('; ');
    p.sex = d.sex_id === 'M' ? 'Male' : d.sex_id === 'F' ? 'Female' : '';
    p.height = d.height ? d.height + ' m' : ''; p.weight = d.weight ? d.weight + ' kg' : '';
    p.marks = d.distinguishing_marks || ''; p.hair = ipColor(d.hairs_id); p.eyes = ipColor(d.eyes_colors_id);
    p.languages = (d.languages_spoken_ids || []).map((x) => IP_LANG[x] || x).join(', ');
    p.placeOfBirth = [d.place_of_birth, d.country_of_birth_id].filter(Boolean).join(', ');
    if (p.imagesHref) {
      try {
        const ij = await fetch(p.imagesHref, { headers: { Accept: 'application/json' } }).then((r) => r.json());
        const im = ((ij._embedded && ij._embedded.images) || [])[0];
        if (im && im._links && im._links.self) p.photo = im._links.self.href;
      } catch { /* keep thumbnail */ }
    }
  } catch { /* show what the list gave us */ }
  p.lazy = false;
}

/* -------- rendering (shared by wanted + missing) ------------------------ */
const personReg = {};   // _key -> person, so cards from any list route correctly
const wSrcBadge = (s) => s === 'interpol' ? '<span class="w-src si">INTERPOL</span>'
  : s === 'yellow' ? '<span class="w-src sy">MISSING</span>'
  : '<span class="w-src sf">FBI</span>';
function wPhoto(p, big) {
  const src = big ? (p.photo || p.thumb) : (p.thumb || p.photo);
  if (!src) return '<span class="w-photo-ph"></span>';
  return `<img class="${big ? 'wm-photo' : 'w-photo-img'}" src="${escapeHtml(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'w-photo-ph'}))">`;
}
function wCard(p) {
  return `<button class="w-card" data-pid="${escapeHtml(p._key || '')}" type="button">`
    + `<span class="w-photo">${wPhoto(p)}</span>`
    + `<span class="w-info"><span class="w-name">${escapeHtml(p.name)}</span>`
    + `<span class="w-meta">${wSrcBadge(p.source)}<span class="w-cat">${escapeHtml(p.charges || p.category || '')}</span></span>`
    + (p.nationality ? `<span class="w-nat">${escapeHtml(p.nationality)}</span>` : '')
    + `</span></button>`;
}
function filteredWanted() {
  const el = $('#wanted-search'); const q = (el ? el.value : '').trim().toLowerCase();
  return wantedAll.filter((p) => (wantedFilter === 'all' || p.source === wantedFilter) && (!q || p.name.toLowerCase().includes(q)));
}
function renderWantedList() {
  const box = $('#wanted-list'); if (!box) return;
  if (!wantedLoaded) { box.innerHTML = '<div class="w-empty"><div class="spinner"></div>Loading official notices…</div>'; return; }
  const list = filteredWanted();
  const note = !wantedSources.interpol ? '<div class="w-src-note">INTERPOL couldn’t be reached from your connection — showing FBI notices only.</div>' : '';
  $('#wanted-count').textContent = list.length + ' notice' + (list.length === 1 ? '' : 's');
  box.innerHTML = note + (list.length ? list.map(wCard).join('') : '<div class="w-empty">No matching notices.</div>');
}

function wRow(k, v) { return (v || v === 0) && String(v).trim() ? `<div class="wm-row"><span class="wm-k">${k}</span><span class="wm-v">${escapeHtml(String(v))}</span></div>` : ''; }
async function openWantedDetail(p) {
  if (!p) return;
  const modal = $('#wanted-modal'), card = $('#wm-card');
  modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
  pushLayer(modal, closeWantedDetail);
  card.scrollTop = 0;
  card.innerHTML = '<div class="w-empty"><div class="spinner"></div>Loading…</div>';
  if (p.lazy) await loadInterpolDetail(p);
  const warn = [p.warning, p.caution].filter(Boolean).join(' — ');
  const auth = p.source === 'interpol' ? 'INTERPOL' : 'FBI';
  card.innerHTML =
    `<button class="wm-close" id="wm-close" title="Close" aria-label="Close">✕</button>`
    + `<div class="wm-hero">${wPhoto(p, true)}<div class="wm-head">${wSrcBadge(p.source)}<h2>${escapeHtml(p.name)}</h2><div class="wm-cat">${escapeHtml(p.category || '')}</div></div></div>`
    + (warn ? `<div class="wm-warn">⚠ ${escapeHtml(warn)}</div>` : '')
    + '<div class="wm-rows">'
    + wRow('Charges', p.charges) + wRow('Reward', p.reward)
    + wRow('Nationality', p.nationality) + wRow('Date of birth', p.dob)
    + wRow('Sex', p.sex) + wRow('Place of birth', p.placeOfBirth)
    + wRow('Race', p.race) + wRow('Height', p.height) + wRow('Weight', p.weight)
    + wRow('Build', p.build) + wRow('Hair', p.hair) + wRow('Eyes', p.eyes)
    + wRow('Complexion', p.complexion) + wRow('Scars & marks', p.marks)
    + wRow('Aliases', p.aliases) + wRow('Languages', p.languages)
    + wRow('Occupations', p.occupations) + wRow('FBI field office', p.fieldOffices)
    + '</div>'
    + (p.description ? `<div class="wm-desc"><b>Details</b><br>${escapeHtml(p.description)}</div>` : '')
    + (p.remarks ? `<div class="wm-desc"><b>Remarks</b><br>${escapeHtml(p.remarks)}</div>` : '')
    + `<div class="wm-disclaim">Presumed innocent unless convicted by a court. Republished from the official ${auth} notice for public awareness. <b>Do not approach.</b> Report information only to the issuing authority.</div>`
    + (p.url ? `<a class="wm-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">View official ${auth} notice ↗</a>` : '');
  $('#wm-close').onclick = closeWantedDetail;
  focusLayer(modal);   // the real close button only exists now the card has rendered
}
function closeWantedDetail() {
  const m = $('#wanted-modal'); m.hidden = true; m.setAttribute('aria-hidden', 'true'); $('#wm-card').innerHTML = '';
  popLayer(m);
}

async function openWanted() {
  const d = $('#wanted-drawer'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
  pushLayer(d, closeWanted);
  if (!wantedLoaded) { renderWantedList(); await ensureWanted(); }
  renderWantedList();
}
function closeWanted() { const d = $('#wanted-drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); popLayer(d); }

// Country-drawer section: the country's wanted list — people WANTED BY that
// country's authorities (INTERPOL arrest-warrant country) + its nationals wanted
// internationally + any FBI matches. Targeted fetches → complete, not a sample.
async function renderCountryWanted(country) {
  const host = $('#cd-wanted'); if (!host) return;
  const my = drawerToken;
  const iso2 = (typeof ISO3_TO_ISO2 !== 'undefined' && ISO3_TO_ISO2[country.id]) || '';
  const nm = (country.name || '').toLowerCase();
  const interpol = [];
  if (iso2) {
    const [byCountry, byNat] = await Promise.all([
      fetchInterpolFiltered('arrestWarrantCountryId=' + iso2),   // wanted BY this country
      fetchInterpolFiltered('nationality=' + iso2),              // nationals wanted internationally
    ]);
    const seen = new Set();
    for (const p of [...byCountry, ...byNat]) if (!seen.has(p.id)) { seen.add(p.id); interpol.push(p); }
    interpol.forEach((p) => { p._key = 'w:' + p.source + ':' + p.id; personReg[p._key] = p; });
  }
  await ensureWanted();
  const fbi = wantedAll.filter((p) => p.source === 'fbi'
    && ((p.countries || []).some((c) => c && c.toLowerCase().includes(nm)) || (p.nationality || '').toLowerCase().includes(nm)));
  const people = [...interpol, ...fbi].slice(0, 24);
  if (my !== drawerToken || !$('#cd-wanted')) return;   // drawer moved on while we fetched
  host.innerHTML = people.length
    ? people.map(wCard).join('')
    : '<div class="cd-empty">No public wanted notices linked to this country.</div>';
}

function initWanted() {
  $('#wanted-btn').onclick = openWanted;
  $('#wanted-close').onclick = closeWanted;
  $('#wanted-search').addEventListener('input', () => { clearTimeout(wantedSearchT); wantedSearchT = setTimeout(renderWantedList, 180); });
  $('#wanted-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.wtab'); if (!t) return;
    wantedFilter = t.dataset.src;
    [...$('#wanted-tabs').children].forEach((b) => b.classList.toggle('active', b === t));
    renderWantedList();
  });
  $('#wm-backdrop').onclick = closeWantedDetail;
  // Escape is handled by the layer stack, which closes only the topmost overlay.
  // one delegated handler for cards in every list (wanted, missing, country drawer)
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.w-card');
    if (!b || !b.dataset.pid) return;
    const p = personReg[b.dataset.pid];
    if (!p) return;
    if (p.source === 'yellow') openMissingDetail(p); else openWantedDetail(p);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWanted);
else initWanted();

/* ==========================================================================
   MISSING PERSONS — official INTERPOL Yellow Notices (public appeals).
   A missing person is SOUGHT / at-risk, not accused — framed and disclaimed
   accordingly (never "wanted"). Fetched client-side like the Red Notices;
   reuses the person card + modal components with missing-appropriate fields.
   ========================================================================== */
let missingAll = [], missingLoaded = false, missingLoading = false, missingSource = false, missingSearchT = 0;

function ageFromDob(dob) {
  const m = /(\d{4})[-/](\d{2})[-/](\d{2})/.exec(dob || '');
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const yrs = (Date.now() - d) / 3.15576e10;
  return yrs > 0 && yrs < 130 ? Math.floor(yrs) + ' yrs' : '';
}
function normYellow(n) {
  const l = n._links || {};
  const thumb = (l.thumbnail && l.thumbnail.href) || '';
  return {
    source: 'yellow', id: n.entity_id, name: [n.forename, n.name].filter(Boolean).join(' ') || 'Unknown',
    thumb, photo: thumb, url: 'https://www.interpol.int/en/How-we-work/Notices/View-Yellow-Notices',
    detailHref: l.self && l.self.href, imagesHref: l.images && l.images.href,
    category: 'Missing person', charges: '', nationality: (n.nationalities || []).join(', '),
    countries: (n.nationalities || []), natCodes: (n.nationalities || []),
    dob: (n.date_of_birth || '').replace(/\//g, '-'), lazy: true,
  };
}
async function fetchMissing() {
  try {
    const r = await fetch('https://ws-public.interpol.int/notices/v1/yellow?resultPerPage=100&page=1', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return ((j._embedded && j._embedded.notices) || []).map(normYellow);
  } catch { return null; }
}
async function ensureMissing(force) {
  if (missingLoading || (missingLoaded && !force)) return;
  missingLoading = true;
  const list = await fetchMissing();
  missingSource = Array.isArray(list);
  missingAll = list || [];
  missingAll.forEach((p) => { p._key = 'm:' + p.id; personReg[p._key] = p; });
  missingLoaded = true; missingLoading = false;
}
async function loadYellowDetail(p) {
  if (!p.lazy) return;
  try {
    const d = await fetch(p.detailHref, { headers: { Accept: 'application/json' } }).then((r) => r.json());
    p.sex = d.sex_id === 'M' ? 'Male' : d.sex_id === 'F' ? 'Female' : '';
    p.height = d.height ? d.height + ' m' : ''; p.weight = d.weight ? d.weight + ' kg' : '';
    p.marks = d.distinguishing_marks || ''; p.hair = ipColor(d.hairs_id); p.eyes = ipColor(d.eyes_colors_id);
    p.languages = (d.languages_spoken_ids || []).map((x) => IP_LANG[x] || x).join(', ');
    p.placeOfBirth = [d.place_of_birth, d.country_of_birth_id].filter(Boolean).join(', ');
    p.missingSince = (d.date_of_event || '').replace(/\//g, '-');
    p.lastSeen = d.place || '';
    p.countriesLikely = (d.countries_likely_to_be_visited || []).join(', ');
    p.mother = [d.mother_forename, d.mother_name].filter(Boolean).join(' ');
    p.father = [d.father_forename, d.father_name].filter(Boolean).join(' ');
    if (p.imagesHref) {
      try {
        const ij = await fetch(p.imagesHref, { headers: { Accept: 'application/json' } }).then((r) => r.json());
        const im = ((ij._embedded && ij._embedded.images) || [])[0];
        if (im && im._links && im._links.self) p.photo = im._links.self.href;
      } catch { /* keep thumbnail */ }
    }
  } catch { /* show list-level info */ }
  p.lazy = false;
}
function filteredMissing() {
  const el = $('#missing-search'); const q = (el ? el.value : '').trim().toLowerCase();
  return missingAll.filter((p) => !q || p.name.toLowerCase().includes(q));
}
function renderMissingList() {
  const box = $('#missing-list'); if (!box) return;
  if (!missingLoaded) { box.innerHTML = '<div class="w-empty"><div class="spinner"></div>Loading appeals…</div>'; return; }
  if (!missingSource) { $('#missing-count').textContent = ''; box.innerHTML = '<div class="w-empty">INTERPOL couldn’t be reached from your connection.</div>'; return; }
  const list = filteredMissing();
  $('#missing-count').textContent = list.length + ' appeal' + (list.length === 1 ? '' : 's');
  box.innerHTML = list.length ? list.map(wCard).join('') : '<div class="w-empty">No matching appeals.</div>';
}
async function openMissingDetail(p) {
  if (!p) return;
  const modal = $('#wanted-modal'), card = $('#wm-card');
  modal.hidden = false; modal.setAttribute('aria-hidden', 'false'); card.scrollTop = 0;
  pushLayer(modal, closeWantedDetail);
  card.innerHTML = '<div class="w-empty"><div class="spinner"></div>Loading…</div>';
  if (p.lazy) await loadYellowDetail(p);
  card.innerHTML =
    '<button class="wm-close" id="wm-close" title="Close" aria-label="Close">✕</button>'
    + `<div class="wm-hero">${wPhoto(p, true)}<div class="wm-head"><span class="w-src sy">MISSING</span><h2>${escapeHtml(p.name)}</h2><div class="wm-cat">INTERPOL Yellow Notice · public appeal</div></div></div>`
    + '<div class="wm-appeal">If you have information that could help locate this person, contact INTERPOL or your local police via the official link below.</div>'
    + '<div class="wm-rows">'
    + wRow('Missing since', p.missingSince) + wRow('Last seen', p.lastSeen)
    + wRow('Nationality', p.nationality) + wRow('Date of birth', p.dob) + wRow('Age', ageFromDob(p.dob))
    + wRow('Sex', p.sex) + wRow('Place of birth', p.placeOfBirth)
    + wRow('Height', p.height) + wRow('Weight', p.weight)
    + wRow('Hair', p.hair) + wRow('Eyes', p.eyes)
    + wRow('Distinguishing marks', p.marks) + wRow('Languages', p.languages)
    + wRow('May have travelled to', p.countriesLikely)
    + wRow('Mother', p.mother) + wRow('Father', p.father)
    + '</div>'
    + '<div class="wm-disclaim">Republished from the official INTERPOL Yellow Notice for public awareness. If you have any information about this person, please contact INTERPOL or your local police.</div>'
    + (p.url ? `<a class="wm-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">View official INTERPOL notice ↗</a>` : '');
  $('#wm-close').onclick = closeWantedDetail;
  focusLayer(modal);   // the real close button only exists now the card has rendered
}
async function openMissing() {
  const d = $('#missing-drawer'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
  pushLayer(d, closeMissing);
  if (!missingLoaded) { renderMissingList(); await ensureMissing(); }
  renderMissingList();
}
function closeMissing() { const d = $('#missing-drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); popLayer(d); }

async function renderCountryMissing(country) {
  const host = $('#cd-missing'); if (!host) return;
  const my = drawerToken;
  const iso2 = (typeof ISO3_TO_ISO2 !== 'undefined' && ISO3_TO_ISO2[country.id]) || '';
  let people = [];
  if (iso2) {
    try {
      const r = await fetch('https://ws-public.interpol.int/notices/v1/yellow?nationality=' + iso2 + '&resultPerPage=100&page=1', { headers: { Accept: 'application/json' } });
      if (r.ok) {
        const j = await r.json();
        people = ((j._embedded && j._embedded.notices) || []).map(normYellow);
        people.forEach((p) => { p._key = 'm:' + p.id; personReg[p._key] = p; });
      }
    } catch { /* degrade to empty */ }
  }
  if (my !== drawerToken || !$('#cd-missing')) return;
  host.innerHTML = people.length ? people.slice(0, 24).map(wCard).join('') : '<div class="cd-empty">No missing-person appeals linked to this country.</div>';
}

function initMissing() {
  $('#missing-btn').onclick = openMissing;
  $('#missing-close').onclick = closeMissing;
  $('#missing-search').addEventListener('input', () => { clearTimeout(missingSearchT); missingSearchT = setTimeout(renderMissingList, 180); });
  // Escape is handled by the layer stack, which closes only the topmost overlay.
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMissing);
else initMissing();
