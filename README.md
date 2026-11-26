# 🌍 WORLDWATCH — Real-Time Global Situation Monitor

A single-page web app that shows what's happening across the planet **right now**:
breaking news from every country, plus live natural-disaster, war, conflict and
crisis feeds — all on an interactive world map.

![status](https://img.shields.io/badge/status-live-brightgreen) no build step · no API keys · two bundled libraries ([satellite.js](https://github.com/shashwatak/satellite-js) for orbits, [hls.js](https://github.com/video-dev/hls.js) for camera video — both vendored locally, nothing fetched from a CDN at runtime)

## Run it

```bash
node server.js
# → open http://localhost:4173
```

Requires Node 18+ (uses the built-in `fetch`). That's it — no `npm install`.

> ⚠️ It must be served by `server.js`, **not** opened as a `file://` page.
> The tiny bundled server proxies the news/disaster feeds (which don't send
> CORS headers) and only allows the four allow-listed upstream hosts.

## What it does

| Feature | Source |
| --- | --- |
| 📺 **Live TV** — embedded news streams: Al Jazeera, DW, Sky, ABC, CNA, Euronews, TRT, LiveNOW + 🇵🇭 GMA, ABS-CBN, TV5/News5 | YouTube live (auto-resolved) |
| 🌐 **3D globe (Google-Earth style)** — satellite imagery on a spinning sphere, drag to rotate, `Ctrl`+scroll to zoom, auto-spin until you grab it; **Flat** map mode still available | orthographic projection + NASA Blue Marble |
| 🔍 **Deep zoom to street level** — keep zooming past the planet view and the sphere streams real map tiles all the way to **zoom 19**: individual buildings, rooftops and street names. Zoom is anchored on the pointer and dragging tracks the ground 1:1, exactly like Google Maps. | Esri World Imagery |
| ✈️ **Live flight tracker** — real aircraft moving across the globe in real time. Each one is dead-reckoned along a great circle from its own ADS-B fix, so planes drift continuously instead of jumping between refreshes. Zoomed out they are altitude-coloured dots; zoom in and they become silhouettes turned to their heading, labelled with callsign, flight level and speed, growing to true size against the ground. Hover for type and registration, **click to follow** one | [adsb.fi](https://adsb.fi) · [adsb.lol](https://adsb.lol) · [OpenSky](https://opensky-network.org) |
| 🛫 **Airports for every flight** — click an aircraft and its card shows the airline, aircraft type, registration and the two airports it is flying between, with the leg drawn on the globe as a great circle and both airports marked. ADS-B carries no route data at all — a transponder broadcasts position and callsign, not a flight plan — so the callsign is resolved against [adsbdb](https://api.adsbdb.com) | [adsbdb](https://www.adsbdb.com) |
| 📷 **Traffic cameras** — ~7 200 public road-authority CCTV cameras plotted where they actually stand. ~1 800 of them carry **genuine live HLS video**; the rest are stills the authority refreshes every 1–15 min. The card labels which you are getting — **LIVE** or **SNAPSHOT** — and never dresses one up as the other | Caltrans · DriveBC · HK Transport Dept · Ontario 511 · Fintraffic · LTA Singapore |
| 🗺️ **Map layers** — country labels, satellite toggle, every hazard plotted in both views | country polygons (`world-data.js`) |
| 📉 **Earthquakes** (past 24 h, sized by magnitude) | [USGS](https://earthquake.usgs.gov) |
| 🔥 **Natural events** — wildfires, storms, volcanoes, floods, ice | [NASA EONET](https://eonet.gsfc.nasa.gov) |
| ⚠️ **Disaster alerts** — cyclones, floods, droughts with Green/Orange/Red levels | [GDACS](https://www.gdacs.org) |
| 🔥 **Active fires** — near-real-time satellite fire hotspots, colored by radiative power (optional map layer) | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) |
| 🛡️ **Wanted — public notices** — official INTERPOL Red Notices + FBI Most Wanted with full descriptors, browsable and linked into the country drawer | [INTERPOL](https://www.interpol.int) · [FBI](https://www.fbi.gov/wanted) |
| 🔎 **Missing persons** — official INTERPOL Yellow Notice public appeals (missing since, last seen, descriptors, next-of-kin), browsable and linked into the country drawer | [INTERPOL Yellow Notices](https://www.interpol.int/How-we-work/Notices/Yellow-Notices) |
| 📰 **News wire for every country** — pick any of ~180 countries | [Google News](https://news.google.com) |
| ⚔️ **Themed feeds** — War & Conflict · Crisis & Unrest · Disasters · Business · Tech · Science · Health · Sports | Google News search/topics |
| 🌐 **Native-language editions** — selecting e.g. Japan or Ukraine returns local-language headlines | Google News editions |
| 📈 **Trending topics** — auto-extracted from the current headlines | derived |
| 🔴 **Breaking ticker + auto-refresh** — hazards every 3 min, news every 4 min | — |
| 🛰️ **Background monitor** — server-side ingestion + event history, "what's new since I last looked", a 24h activity pulse, and **rule-based push alerts** delivered even with the tab closed | `api/ingest` + Upstash + Web Push |

### How to use
- **Click a country** on the map (or use the dropdown) to load its national news.
- **Category tabs** switch the theme (War & Conflict, Crisis, Disasters, …).
- **Search box** runs a free-text query, scoped to the selected country.
- **Click a hazard** in the side feed to zoom the map to it and pull related news.
- **Layer toggles** under the map show/hide earthquakes, events, and alerts.
- **Flights** plots live aircraft. Zoomed out it shows a global snapshot; zoom past ~250 nm
  across and it switches to a fast regional feed with callsigns, aircraft type and registration.
  Click an aircraft to lock the globe onto it and ride along.
- **Cameras** plots public traffic CCTV. Click a marker for that authority's view. Caltrans cameras
  play as **live video**; the others are stills that re-pull every 5 s. The badge on the card tells
  you which. Coverage follows whoever publishes openly — California, British Columbia, Ontario,
  Hong Kong, Finland and Singapore today.
- **Country intelligence** (click a country) now also lists the **live cameras** and **aircraft**
  inside that country. Both are filtered against the country polygon, not just a bounding box, so a
  neighbour's traffic never leaks in. Every row is clickable — it switches the layer on, flies the
  globe to the subject and opens its card. Aircraft rows fill in their `ORIG → DEST` as the route
  lookups land.
- **Full screen** puts the map edge-to-edge with every control moved into a left-hand rail. The
  toolbar is *moved*, not cloned, so nothing rebinds and no state is lost. `Esc` or **Exit** restores it.
- **Zoom in** with `Ctrl`+scroll (or the `+` / `−` buttons, or pinch on touch) and keep going —
  the globe streams sharper imagery the closer you get, down to individual houses and streets.
  A scale bar sits bottom-left and the imagery credit bottom-right. **Reset** returns to the spinning planet.

## Deploy free on Vercel

The app is laid out for Vercel: static files at the repo root, and the two
proxy routes as serverless functions in `api/`. Free (Hobby) plan, no card.

**Fastest — Vercel CLI (no GitHub needed):**

```bash
npm i -g vercel          # one-time
cd D:\Franklin\world-monitor
vercel                   # log in via browser, accept defaults → preview URL
vercel --prod            # publish to your production URL
```

When prompted for **Framework Preset**, choose **Other** (there's no build step).

**Or via GitHub (auto-deploys on every push):**

1. Push this folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework Preset → **Other**, leave build/output empty, click **Deploy**.

That's it — `/` serves the app, `/api/fetch` and `/api/live` run as functions.
Responses are edge-cached (`s-maxage`) so the free function quota is barely touched.

> Local dev still uses `node server.js`, which serves the same files and
> implements the same two routes — so what you see locally matches production.

### Live TV in production needs a YouTube API key

Live TV works locally with no key (the `/api/live` function scrapes YouTube from
your home IP). **But from Vercel's datacenter IP, YouTube won't resolve live
streams** — it serves the channel's latest upload instead. The fix is a free
**YouTube Data API v3** key, which resolves live streams reliably from any IP:

1. In [Google Cloud Console](https://console.cloud.google.com/): create a project →
   **APIs & Services → Library** → enable **YouTube Data API v3** → **Credentials**
   → **Create credentials → API key**. Copy it.
2. Add it to Vercel:
   `npx vercel env add YOUTUBE_API_KEY production` (paste the key), or add it in
   **Project → Settings → Environment Variables**.
3. Redeploy: `npx vercel --prod`.

Verify: `https://YOUR-APP.vercel.app/api/live?h=@dwnews` should return
`{"videoId":"…","live":true,"src":"api"}`. Free quota is 10,000 units/day; each
live-resolution costs 100 (~100 channel-opens/day) and is cached, and thumbnails
never hit the API. Without the key, TV still plays — just the latest clip, not live.

## Active-fire layer (optional)

The **Active Fires** map toggle plots NASA FIRMS satellite hotspots (VIIRS), sized/colored by fire radiative power. It needs a **free MAP_KEY**:

1. Request one at [firms.modaps.eosdis.nasa.gov/api/map_key](https://firms.modaps.eosdis.nasa.gov/api/map_key) (instant, email only).
2. Set `FIRMS_MAP_KEY` locally in `.env.local` and on Vercel (Settings → Environment Variables). Optional `FIRMS_SOURCE` (default `VIIRS_SNPP_NRT`).

The key stays server-side. A single global FIRMS query is ~6 MB and 502s, so `/api/firms` fetches the world as a grid of bounding-box tiles in parallel, merges them, keeps the most intense fires, and caches the result for 15 min — in memory and (if Upstash is configured) in a shared cache, so the slow fetch runs at most once per interval rather than once per request. Without the key the toggle simply reports it's unconfigured; everything else works unchanged.

## Live flights

The ✈ **Flights** toggle plots real aircraft from ADS-B. No key, nothing to configure.

`/api/flights` normalises two very different upstreams into one compact payload, because
neither alone does the job:

- **Zoomed in** (view narrower than ~250 nm) it queries the community feeds
  [adsb.fi](https://adsb.fi), falling back to [adsb.lol](https://adsb.lol). These are free,
  unmetered and carry registration and aircraft type — but they cap at a 250 nm radius.
- **Zoomed out** it falls back to [OpenSky](https://opensky-network.org), the only keyless
  source with genuine global coverage. Anonymous access is metered at 400 credits/day and a
  global query costs 4, so the snapshot is cached for 4 minutes and sampled down to 4 000
  aircraft. That works out to roughly 6 hours of continuous world-view tracking per day; past
  that the layer says so and regional tracking keeps working. Zoomed-in use never touches it.

**Coverage is not uniform.** These feeds come from volunteer ground receivers, so density
varies enormously: ~350 aircraft within 150 nm of Frankfurt against ~11 within *250* nm of
Cebu. An empty sky over much of Asia, Africa and the oceans is usually real rather than a
fault, so the layer says which it is — "no aircraft within 90 nm", or "4 within 90 nm · none in
view yet" when traffic is nearby but outside a tight zoom. Requests always cover at least
90 nm regardless of zoom, so aircraft fly *into* view instead of appearing from nowhere.
Aircraft parked or taxiing are dimmed and cast no shadow, so a jet on a stand can't be
mistaken for one in the cruise.

Positions are packed as arrays rather than objects (a global snapshot is ~13 000 aircraft, and
key names would dominate the payload), and each carries the age of its own fix. The browser
dead-reckons every aircraft along a great circle from that moment, so planes move continuously
at their true ground speed between refreshes rather than teleporting — and a stale snapshot
still looks live. A fix older than 15 minutes stops being extrapolated instead of drifting into
fiction.

## Traffic cameras

The 📷 **Cameras** toggle plots public road-authority CCTV. No key, nothing to configure.
Click a marker and the card shows that authority's own live image, re-pulled every 5 seconds.

> The re-pull rate is the *client's*, not the camera's. Caltrans refreshes its stills about once
> a minute, Hong Kong and Finland every few minutes, Windy every 10–30. Pulling every 5 s
> catches a new frame the moment it lands, but between updates it re-fetches the same JPEG —
> a still that looks frozen is the camera, not the app.

**There is no global registry of traffic cameras.** Every road authority publishes on its own
terms, in its own format, or not at all — and most of the US "511" systems sit behind API keys
that need individual registration. `/api/webcams` merges the authorities that publish openly:

| Source | Region | Cameras |
| --- | --- | --- |
| [Caltrans](https://dot.ca.gov) | California, USA | ~3 360 |
| [DriveBC](https://www.drivebc.ca) | British Columbia, Canada | ~1 050 |
| [Transport Department](https://data.gov.hk) | Hong Kong | ~1 010 |
| [Ontario 511](https://511on.ca) | Ontario, Canada | ~950 |
| [Fintraffic](https://www.digitraffic.fi) | Finland | ~810 |
| [LTA](https://data.gov.sg) | Singapore | live subset |

### Coverage outside the road authorities — Windy (optional key)

Everything above is a road authority, so coverage stops where authorities stop publishing.
Large parts of the world — **the Philippines included** — have no open feed at all: MMDA's old
public endpoint (`mmdatraffic.interaksyon.com`) now returns HTTP 522, and both `mmda.gov.ph`
and `dotr.gov.ph` sit behind Cloudflare bot protection. NLEX, Skyway and PAGASA publish no API.

[Windy](https://www.windy.com/webcams) aggregates **71 000+ public webcams worldwide** and fills
those gaps. Set `WM_WINDY_KEY` and it activates:

1. Sign in at [windy.com](https://www.windy.com) and request a free Webcams API key at
   [api.windy.com/keys](https://api.windy.com/keys) (choose the **Webcams API**).
2. Put it in `.env.local` as `WM_WINDY_KEY=...`, or Vercel → Settings → Environment Variables.
   `.env.local` is git- and vercel-ignored, so the key never leaves the machine it's set on.

It contributes up to 50 webcams per viewport anywhere on the globe. Philippine coverage is
thin but real: **7 nationwide, 4 in Metro Manila** (Mandaluyong, Navotas, Kaunlaran, Maybunga)
plus Angeles — and **none in Cebu**, which has no public webcam in any source checked.

Unlike the road authorities, Windy is queried **per viewport** rather than indexed globally —
the network is far too large to enumerate and the free tier is metered — with results cached
per rounded box for 10 minutes. Windy serves stills (its live player is an iframe embed, not an
HLS playlist), so these appear as **SNAPSHOT**. A missing or rejected key is not fatal: the
source silently contributes nothing and the road-authority cameras carry on.

### Adding more US coverage (optional keys)

Most US states run the same "511" platform, which is key-gated. Set any of these and that
state's cameras appear automatically — no code change:

| Env var | State | Get a free key |
| --- | --- | --- |
| `WM_511_NY` | New York | [511ny.org/developers](https://511ny.org/developers) |
| `WM_511_PA` | Pennsylvania | [511pa.com/developers](https://www.511pa.com/developers) |
| `WM_511_GA` | Georgia | [511ga.org/developers](https://511ga.org/developers) |
| `WM_511_IA` | Iowa | [511ia.org/developers](https://511ia.org/developers) |
| `WM_511_ID` | Idaho | [511.idaho.gov/developers](https://511.idaho.gov/developers) |
| `WM_511_VA` | Virginia | [511virginia.org/developers](https://511virginia.org/developers) |

Put them in `.env.local` for local dev, or Vercel → Settings → Environment Variables.

> **These add cameras, not video.** Every 511 deployment checked serves stills only — the
> platform exposes no video field at all. The loader picks up an HLS URL automatically if one
> ever appears, but today Caltrans is the only source of live moving video I could find that
> publishes openly.

Adding another authority is one entry in `SOURCES` in `api/webcams.js` — a name, a region and
a loader returning `[lat, lon, name, imageUrl]`. Only official government and road-authority
feeds are used; this deliberately does **not** aggregate unsecured private cameras.

### Live video vs stills

Most authorities publish a **still image**, refreshed on their own schedule — Caltrans updates
every minute, others every 5–15. Re-pulling faster than that just re-fetches the same JPEG,
which is why a snapshot camera looks frozen. That is the feed being what it is, not a fault.

**Caltrans also publishes real HLS video**, and ~1 800 of its cameras carry it. Those play as
actual moving video in the card. The stream is verifiably live — its media sequence advances in
step with wall-clock time — and the CDN sends `Access-Control-Allow-Origin: *`, so the browser
plays it directly with no proxy in the path.

Playback uses [hls.js](https://github.com/video-dev/hls.js), vendored as `hls.light.min.js`
because browsers cannot feed MPEG-TS segments to Media Source Extensions themselves and only
Safari plays HLS natively. It is **loaded lazily** — the first time you open a camera that
streams — so the 290 KB never touches page load for anyone who doesn't watch video. If the
stream fails or stalls for nine seconds, the card falls back to that camera's still image.

On the map the two are drawn differently, so you can tell before clicking: video cameras are
solid red and slightly larger, stills are dimmed pink. The card badge then confirms it —
**LIVE** or **SNAPSHOT**.

Caltrans advertises a `streamingVideoURL` for a lot of cameras whose stream does not actually
exist — about one in four 404s. Painting those red and then falling back to a still is worse
than never promising video, so every advertised playlist is probed and the dead ones dropped:
**1 712 advertised → 1 224 real**. That takes ~2 min for 1 800 URLs, far too long to block a
request, so it runs in the background after the index is built and the verdicts are cached; the
map self-corrects within a couple of minutes of boot. If a stream fails anyway at play time,
that camera is demoted on the spot — its marker turns pink and it stops claiming video.

Ontario, DriveBC, Hong Kong and Singapore were each checked for a stream field and have none;
their feeds are stills only. That is an upstream limit, not something the app can work around.

Camera *positions* barely change, so the merged index is cached for hours and the browser
fetches only the cameras inside the current viewport. Each upstream — and each of Caltrans's
twelve district files — is cached separately, because the big districts take upwards of ten
seconds and a single timeout would otherwise discard everything fetched alongside it; repeated
requests converge on the full set. The *images* are never proxied: the browser loads them
straight from the authority, cache-busted, so the app never sits in the path of the video.

## Wanted — public notices

The 🛡️ button in the top bar opens a browsable panel of **official INTERPOL Red Notices and FBI Most Wanted**, with full available descriptors (charges, physical description, aliases, warnings, photo), a filter/search, and a link to each official notice. The country intelligence drawer also lists notices linked to that nationality.

It's a **read-only re-display of official appeals for public awareness** — no private-individual lookup, tracking, or user-generated accusations; a presumption-of-innocence / do-not-approach disclaimer is shown throughout.

Both APIs block datacenter/server fingerprints (and Vercel's runtime), so they're fetched **directly from the browser** (both send CORS). No key or server route is needed. INTERPOL additionally edge-blocks some networks; if it can't be reached from a given connection the panel degrades to FBI-only and says so.

The 🔎 button opens **Missing Persons** — official **INTERPOL Yellow Notices** (public appeals to help locate people, many of them children). It's kept deliberately separate from Wanted and framed as an appeal, not an accusation: no "charges", no presumption-of-innocence language, and a "if you have information, please contact the authorities" disclaimer (no "do not approach" — that's wanted-notice framing, wrong for a missing person). Same browser-side fetch as the Red Notices; the country drawer lists appeals linked to each nationality.

## Background monitor & push alerts (optional)

Everything above works with **zero setup**. This section turns the *viewer* into a
*monitor*: a server-side job polls the hazard feeds every few minutes independent of
any browser, stores an event history, and pushes **notifications to your phone or
desktop even when the tab is closed** — driven by rules you define ("M6.0+ anywhere",
"severe alert in my watchlist countries", "new Cat-3+ cyclone").

It stays true to the project's ethos: **no npm dependencies** — Web Push (VAPID +
RFC 8291 encryption) is implemented on Node's built-in `crypto`, and Upstash Redis is
called over its plain REST API. If the pieces below aren't configured, the app simply
hides the monitor features and runs exactly as before.

**Architecture:** serverless functions + a cheap datastore + an external ticker.

```
scheduler ──▶ /api/ingest ──▶ poll USGS/EONET/GDACS ──▶ Upstash Redis (history)
                    │                                        ▲
                    └── match each new event to rules ──▶ Web Push ──▶ your device
browser ──▶ /api/events   (what's-new / 24h pulse)  ──────┘
browser ──▶ /api/subscribe (store push subscription + rules)
```

### 1. Datastore — Upstash Redis (free tier)

1. Create a database at [console.upstash.com](https://console.upstash.com) (or add the
   **Upstash** / **Vercel KV** integration from the Vercel marketplace).
2. Copy its REST credentials and set them as Vercel env vars — either name pair works:
   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` +
   `KV_REST_API_TOKEN`.

### 2. Push keys — VAPID

A keypair was generated for you into `.env.local`. Set the **same three** on Vercel:

```
VAPID_PUBLIC_KEY   (public — also shipped to the browser)
VAPID_PRIVATE_KEY  (secret)
VAPID_SUBJECT      mailto:you@example.com   ← change to a real contact
INGEST_SECRET      guards /api/ingest so only your scheduler can trigger it
```

Regenerate anytime with:
`node -e "const c=require('crypto');const{publicKey,privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const j=publicKey.export({format:'jwk'});console.log('VAPID_PUBLIC_KEY='+Buffer.concat([Buffer.from([4]),Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]).toString('base64url'));console.log('VAPID_PRIVATE_KEY='+privateKey.export({format:'jwk'}).d)"`

### 3. The ticker — trigger `/api/ingest` every few minutes

The ingestion function is a normal HTTP endpoint; something has to call it on a schedule:

- **Vercel Cron (Pro plan)** — add to `vercel.json` and it runs server-side:
  ```json
  "crons": [{ "path": "/api/ingest?key=YOUR_INGEST_SECRET", "schedule": "*/3 * * * *" }]
  ```
  > On the **Hobby** plan Vercel Cron only fires **once per day**, so use the option below.
- **Free external pinger (works on Hobby)** — create a job at
  [cron-job.org](https://cron-job.org) (1-minute granularity, free) hitting
  `https://YOUR-APP.vercel.app/api/ingest?key=YOUR_INGEST_SECRET` every 3–5 minutes.

Verify: opening that URL returns
`{"ok":true,"total":…,"fresh":…,"alerts":{…}}`.

### 4. Use it

Open the app → click the **🔔 bell** in the top bar → **turn on Push notifications**
(grant the browser prompt) → tick the rules you care about, optionally add watchlist
countries, and hit **Send test**. Rules are stored per-device; the always-on backend
does the rest. The **"what's new since you last looked"** banner and the **24h Pulse**
card appear automatically once `/api/events` has history.

> Local dev: `node server.js` loads `.env.local` and serves the same `/api/ingest`,
> `/api/events`, `/api/subscribe` routes, so you can develop the whole flow locally
> (point the Upstash vars at a real free database).

## Files

```
index.html           page shell (+ alert console, what's-new banner, pulse card)
styles.css           command-center theme
app.js               map rendering, feed loaders, news wire, controls, monitor client
sw.js                service worker — receives Web Push, shows notifications
world-data.js        country boundary polygons (GeoJSON)
api/
  fetch.js           Vercel function — allow-listed feed proxy
  live.js            Vercel function — YouTube live-stream resolver
  firms.js           Vercel function — NASA FIRMS active-fire proxy (needs FIRMS_MAP_KEY)
  flights.js         Vercel function — live ADS-B aircraft (adsb.fi/adsb.lol + OpenSky)
  webcams.js         Vercel function — merged public traffic-camera index
  ingest.js          Vercel function — background poll → history → rule alerts (cron target)
  events.js          Vercel function — event history: "what's new" + 24h trends
  subscribe.js       Vercel function — store push subscription + alert rules
lib/
  store.js           Upstash Redis over REST (no SDK)
  feeds.js           server-side USGS/EONET/GDACS fetch + normalise
  rules.js           match events to subscriber rules
  push.js            native Web Push (VAPID + RFC 8291), no dependency
server.js            local dev server (serves static files + all API routes)
```

## Notes
- Headlines link to their original publishers. This is a situational-awareness
  aggregator, **not** an official emergency service.
- Google News feeds are for personal, non-commercial use per Google's terms.
- Feeds are cached ~150 s server-side so refreshes don't hammer upstreams.
