/*
 * /el-nino map: a small web-Mercator tile viewer on a canvas, centred on the
 * Pacific, wrapping across the date line. Everything drawn comes from NASA GIBS
 * (daily imagery, coastlines, place names), plus the Niño boxes. No dependencies.
 *
 * Tiles come from GIBS's WMS rather than its WMTS: in testing about 35-40% of WMTS
 * requests for tiles that exist returned 404, leaving holes in the map, while WMS
 * answered every one. WMS is a little slower, and answers an unpublished date with
 * a blank image instead of an error.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var dataEl = $('enso-data');
  var page = dataEl ? JSON.parse(dataEl.textContent) : { regions: [], series: [] };

  var WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&STYLES=&WIDTH=256&HEIGHT=256';
  var MERC_EDGE = 20037508.342789244;
  function wmsTile(layer, date, z, x, y) {
    var size = 2 * MERC_EDGE / Math.pow(2, z);
    var bbox = [-MERC_EDGE + x * size, MERC_EDGE - (y + 1) * size, -MERC_EDGE + (x + 1) * size, MERC_EDGE - y * size].join(',');
    return WMS + '&BBOX=' + bbox + '&LAYERS=' + layer + (date ? '&TIME=' + date : '');
  }
  var LAYERS = {
    sst: { max: 7, id: 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies' },
    rain: { max: 6, id: 'IMERG_Precipitation_Rate' },
  };
  // A blank 256px tile is 334 bytes; real imagery of the Pacific runs to many KB.
  var BLANK_BYTES = 1000;

  // Curated rather than from a tile layer: GIBS's Reference_Labels layer came back empty.
  // [name, lat, lon, smallest zoom it appears at]
  var PLACES = [
    ['Australia', -25, 134, 0], ['Indonesia', -2, 118, 0], ['Japan', 36.5, 138, 0], ['China', 33, 108, 0],
    ['Philippines', 12.5, 122, 0], ['Peru', -10, -75, 0], ['Ecuador', -1.5, -78.5, 0], ['Colombia', 4, -73, 0],
    ['Chile', -30, -70.5, 0], ['Mexico', 23.5, -102, 0], ['United States', 39, -98, 0], ['Canada', 56, -100, 0],
    ['Brazil', -10, -55, 0], ['Russia', 60, 110, 0], ['Alaska', 64, -152, 0], ['New Zealand', -42, 172, 0],
    ['Papua New Guinea', -6, 144, 0], ['Hawaii', 21.5, -156, 0], ['Galápagos', 0.8, -90.5, 0], ['Tahiti', -17.6, -149.5, 3.5],
    ['Fiji', -17.8, 178, 3.5], ['Samoa', -13.8, -172, 3.5], ['Kiribati', 1.8, -157.4, 3.5], ['Vietnam', 16, 107.5, 3.5],
    ['Thailand', 15, 101, 3.5], ['Malaysia', 3.5, 102, 3.5], ['South Korea', 36.5, 128, 3.5], ['India', 21, 79, 3.5],
    ['Panama', 8.6, -80.5, 3.5], ['Bolivia', -17, -65, 3.5], ['Solomon Islands', -9, 160, 4], ['Guam', 13.4, 144.8, 4],
  ];

  var RETRIES = 5;
  var CACHE_MAX = 500;
  var DAYS = 30;
  var MAX_ZOOM = 8;

  var mapEl = $('enso-map');
  var canvas = $('enso-canvas');
  if (!mapEl || !canvas) return;
  var ctx = canvas.getContext('2d');
  var tipEl = $('enso-tip');
  var statusEl = $('enso-status');

  var view = { cx: 0, cy: 0.5, z: 2, w: 0, h: 0, dpr: 1 };
  var opts = { layer: 'sst', boxes: true, labels: true };
  var latest = null;      // newest date with imagery, once found
  var date = null;        // date on the map
  var prevDate = null;    // kept on screen while the new date's tiles arrive

  /* ---- dates ---------------------------------------------------------- */
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  var addDays = function (s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  var longDate = function (s) { return new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
  var shortDate = function (s) { return new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };

  /* ---- projection ------------------------------------------------------ */
  var worldX = function (lon) { return (lon + 180) / 360; };
  var worldY = function (lat) {
    var s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  };
  var latOf = function (y) { return Math.atan(Math.sinh((0.5 - y) * 2 * Math.PI)) * 180 / Math.PI; };
  var scale = function () { return 256 * Math.pow(2, view.z); };
  var wrap01 = function (v) { return v - Math.floor(v); };

  function clampView() {
    // Never so far out that the world repeats across a wide window.
    var minZ = Math.log2(Math.max(view.h, view.w, 1) / 256);
    view.z = Math.max(minZ, Math.min(MAX_ZOOM, view.z));
    var half = view.h / 2 / scale();
    view.cy = Math.max(half, Math.min(1 - half, view.cy));
    view.cx = wrap01(view.cx);
  }

  // Fit 120°E to 80°W, the whole basin, centred on the equator.
  var viewTouched = false;
  function resetView() {
    viewTouched = false;
    view.cx = worldX(-160);
    view.cy = 0.5;
    view.z = Math.log2(view.w * 360 / 160 / 256);
    clampView();
  }

  /* ---- tile cache ------------------------------------------------------ */
  var tiles = new Map(); // key -> { img, state: 'loading'|'ok'|'failed', tries, px }
  var pending = 0;
  var redraw = null;

  // tint: repaint the tile's opaque pixels one colour (NASA's coastlines are dark, for light maps).
  function loadTile(key, url, retries, tint) {
    var t = tiles.get(key);
    if (t) return t;
    t = { img: null, state: 'loading', tries: 0, px: null };
    tiles.set(key, t);
    if (tiles.size > CACHE_MAX) tiles.delete(tiles.keys().next().value);
    pending++;
    var attempt = function () {
      t.tries++;
      var img = new Image();
      img.crossOrigin = 'anonymous'; // needed to read pixels for the hover value
      img.onload = function () {
        t.img = tint ? tinted(img, tint) : img;
        t.state = 'ok'; pending--; scheduleDraw();
      };
      img.onerror = function () {
        if (t.tries < retries) { setTimeout(attempt, 400 * t.tries); return; }
        t.state = 'failed'; pending--; scheduleDraw();
        // Not final: forget it after a while, so a hiccup can't leave a permanent hole.
        setTimeout(function () { if (tiles.get(key) === t) { tiles.delete(key); scheduleDraw(); } }, 20000);
      };
      img.src = url;
    };
    attempt();
    return t;
  }

  function tinted(img, color) {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  var dataKey = function (layer, d, z, x, y) { return layer + '/' + d + '/' + z + '/' + x + '/' + y; };
  function dataTile(layer, d, z, x, y) {
    return loadTile(dataKey(layer, d, z, x, y), wmsTile(LAYERS[layer].id, d, z, x, y), RETRIES);
  }

  /* ---- drawing --------------------------------------------------------- */
  function scheduleDraw() {
    if (redraw) return;
    redraw = requestAnimationFrame(function () { redraw = null; draw(); });
  }

  function visibleRange(level) {
    var n = Math.pow(2, level), s = scale();
    return {
      n: n,
      x0: Math.floor((view.cx - view.w / 2 / s) * n), x1: Math.floor((view.cx + view.w / 2 / s) * n),
      y0: Math.max(0, Math.floor((view.cy - view.h / 2 / s) * n)), y1: Math.min(n - 1, Math.floor((view.cy + view.h / 2 / s) * n)),
    };
  }

  // Calls fn(wrappedX, y, screenX, screenY, screenSize) for each tile on screen.
  function eachTile(level, fn) {
    var r = visibleRange(level), s = scale(), size = s / r.n;
    for (var x = r.x0; x <= r.x1; x++) {
      for (var y = r.y0; y <= r.y1; y++) {
        var wx = ((x % r.n) + r.n) % r.n;
        fn(wx, y, (x / r.n - view.cx) * s + view.w / 2, (y / r.n - view.cy) * s + view.h / 2, size);
      }
    }
  }

  var levelFor = function (max) { return Math.max(0, Math.min(max, Math.round(view.z + Math.log2(view.dpr)))); };

  function drawCoastlines() {
    var name = 'Coastlines_15m', level = levelFor(8);
    eachTile(level, function (x, y, sx, sy, size) {
      var key = name + '/' + level + '/' + x + '/' + y;
      var t = loadTile(key, wmsTile(name, null, level, x, y), RETRIES, 'rgba(255,255,255,0.7)');
      if (t.state === 'ok') ctx.drawImage(t.img, sx, sy, size + 0.5, size + 0.5);
    });
  }

  // Draws a coarser tile of the same date under a tile that's still loading.
  function drawParent(layer, d, level, x, y, sx, sy, size) {
    for (var up = 1; up <= level; up++) {
      var z = level - up, f = Math.pow(2, up);
      var t = tiles.get(dataKey(layer, d, z, Math.floor(x / f), Math.floor(y / f)));
      if (t && t.state === 'ok') {
        var part = 256 / f;
        ctx.drawImage(t.img, (x % f) * part, (y % f) * part, part, part, sx, sy, size + 0.5, size + 0.5);
        return true;
      }
    }
    return false;
  }

  var noImagery = false;
  var blankDates = {}; // 'layer/date' -> true (nothing published) | false | null (asking)

  // WMS answers a missing date with a blank image, so tile errors can't reveal it.
  function checkPublished(layer, d) {
    var key = layer + '/' + d;
    if (key in blankDates) return blankDates[key];
    blankDates[key] = null;
    fetch(wmsTile(LAYERS[layer].id, d, 2, 0, 1)).then(function (r) { return r.blob(); }).then(function (b) {
      blankDates[key] = b.size < BLANK_BYTES;
      scheduleDraw();
    }).catch(function () { delete blankDates[key]; });
    return null;
  }

  function drawDataLayer() {
    if (!date) return;
    var layer = opts.layer, level = levelFor(LAYERS[layer].max);
    var ok = 0, failed = 0, loading = 0;
    // Ask for a few coarse tiles first: browsers allow six requests to a host at once and
    // WMS takes ~0.6s a tile, so this paints the whole view while the sharp tiles queue.
    var coarse = Math.max(0, level - 2);
    if (coarse < level) eachTile(coarse, function (x, y) { dataTile(layer, date, coarse, x, y); });
    eachTile(level, function (x, y, sx, sy, size) {
      var t = dataTile(layer, date, level, x, y);
      if (t.state === 'ok') { ok++; ctx.drawImage(t.img, sx, sy, size + 0.5, size + 0.5); return; }
      if (t.state === 'failed') { failed++; return; }
      loading++;
      if (drawParent(layer, date, level, x, y, sx, sy, size) || !prevDate) return;
      var old = tiles.get(dataKey(layer, prevDate, level, x, y));
      if (old && old.state === 'ok') ctx.drawImage(old.img, sx, sy, size + 0.5, size + 0.5);
    });
    noImagery = checkPublished(layer, date) === true || (failed > 0 && ok === 0 && loading === 0);
    if (loading === 0) prevDate = null;
  }

  function drawBoxes() {
    var s = scale();
    page.regions.forEach(function (r) {
      var isMain = r.id === 'nino34';
      var w = (r.e - r.w) / 360 * s;
      var top = (worldY(r.n) - view.cy) * s + view.h / 2;
      var h = (worldY(r.s) - worldY(r.n)) * s;
      // The world repeats sideways, so draw every copy that lands on screen.
      for (var m = -2; m <= 2; m++) {
        var sx = (worldX(r.w) + m - view.cx) * s + view.w / 2;
        if (sx <= view.w && sx + w >= 0) {
          ctx.lineWidth = isMain ? 2 : 1;
          ctx.setLineDash(isMain ? [] : [5, 4]);
          ctx.strokeStyle = 'rgba(0,0,0,0.75)';
          ctx.strokeRect(sx - 1, top - 1, w + 2, h + 2);
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(sx, top, w, h);
          ctx.setLineDash([]);
          if (w < 44) continue; // too small to label at this zoom
          var label = r.name + (r.anom == null ? '' : ' ' + fmtSigned(r.anom) + '°C');
          ctx.font = (isMain ? '600 ' : '') + '11px system-ui, sans-serif';
          ctx.textBaseline = 'bottom';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          // Stagger the overlapping equatorial boxes so their labels don't collide.
          var ly = r.id === 'nino12' ? top + h + 15 : (r.id === 'nino34' ? top - 18 : top - 4);
          ctx.strokeText(label, sx + 2, ly);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, sx + 2, ly);
        }
      }
    });
  }

  function drawPlaces() {
    var s = scale();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    PLACES.forEach(function (p) {
      if (view.z < p[3]) return;
      var y = (worldY(p[1]) - view.cy) * s + view.h / 2;
      if (y < -10 || y > view.h + 10) return;
      for (var m = -2; m <= 2; m++) {
        var x = (worldX(p[2]) + m - view.cx) * s + view.w / 2;
        if (x < -60 || x > view.w + 60) continue;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(p[0], x, y);
        ctx.fillStyle = '#fff';
        ctx.fillText(p[0], x, y);
      }
    });
    ctx.textAlign = 'left';
  }

  function draw() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, view.w, view.h);
    drawDataLayer();
    if (date) drawCoastlines(); // after the data, so outlines never hold up the imagery
    if (opts.boxes) drawBoxes();
    if (opts.labels) drawPlaces();
    if (!date) statusEl.textContent = 'Finding the latest NASA imagery…';
    else if (noImagery) statusEl.textContent = 'NASA has no imagery for ' + shortDate(date) + '. Try another day.';
    else if (pending > 0) statusEl.textContent = 'Loading imagery…';
    else statusEl.textContent = '';
  }

  function resize() {
    var r = mapEl.getBoundingClientRect();
    var first = view.w === 0;
    view.w = r.width; view.h = r.height;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * view.dpr);
    canvas.height = Math.round(r.height * view.dpr);
    if (first || !viewTouched) resetView(); else clampView();
    draw();
  }

  /* ---- pan and zoom ---------------------------------------------------- */
  function zoomAt(nextZ, px, py) {
    viewTouched = true;
    var s = scale();
    var wx = view.cx + (px - view.w / 2) / s, wy = view.cy + (py - view.h / 2) / s;
    view.z = nextZ;
    clampView();
    var s2 = scale();
    view.cx = wx - (px - view.w / 2) / s2;
    view.cy = wy - (py - view.h / 2) / s2;
    clampView();
    scheduleDraw();
  }

  var pointers = new Map();
  var pinch = null;
  var localPos = function (e) { var r = mapEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function pinchInfo() {
    var p = Array.from(pointers.values());
    return { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
  }

  mapEl.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('button')) return;
    mapEl.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localPos(e));
    mapEl.classList.add('dragging');
    if (pointers.size === 2) { var i = pinchInfo(); pinch = { d: i.d, z: view.z }; }
  });
  mapEl.addEventListener('pointermove', function (e) {
    var pos = localPos(e);
    if (!pointers.has(e.pointerId)) { if (e.pointerType === 'mouse') showTip(pos); return; }
    var last = pointers.get(e.pointerId);
    pointers.set(e.pointerId, pos);
    tipEl.hidden = true;
    if (pointers.size === 2 && pinch) {
      var i = pinchInfo();
      zoomAt(pinch.z + Math.log2(i.d / pinch.d), i.x, i.y);
    } else if (pointers.size === 1) {
      var s = scale();
      viewTouched = true;
      view.cx -= (pos.x - last.x) / s;
      view.cy -= (pos.y - last.y) / s;
      clampView();
      scheduleDraw();
    }
  });
  var endPointer = function (e) {
    var start = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) mapEl.classList.remove('dragging');
    if (start && e.pointerType !== 'mouse' && e.type === 'pointerup') showTip(localPos(e)); // tap for a value
  };
  mapEl.addEventListener('pointerup', endPointer);
  mapEl.addEventListener('pointercancel', endPointer);
  mapEl.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') tipEl.hidden = true; });
  // Ctrl+wheel only, matching the main dashboard, so the map never traps page scrolling.
  mapEl.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    var p = localPos(e);
    zoomAt(view.z - e.deltaY * 0.003, p.x, p.y);
  }, { passive: false });
  var zoomBy = function (d) { zoomAt(view.z + d, view.w / 2, view.h / 2); };
  $('enso-zoom-in').onclick = function () { zoomBy(0.75); };
  $('enso-zoom-out').onclick = function () { zoomBy(-0.75); };
  $('enso-reset').onclick = function () { resetView(); scheduleDraw(); };
  mapEl.addEventListener('keydown', function (e) {
    var step = 60 / scale(), used = true;
    if (e.key === 'ArrowLeft') view.cx -= step;
    else if (e.key === 'ArrowRight') view.cx += step;
    else if (e.key === 'ArrowUp') view.cy -= step;
    else if (e.key === 'ArrowDown') view.cy += step;
    else if (e.key === '+' || e.key === '=') view.z += 0.5;
    else if (e.key === '-') view.z -= 0.5;
    else used = false;
    if (used) { e.preventDefault(); viewTouched = true; clampView(); scheduleDraw(); }
  });

  /* ---- hover value ----------------------------------------------------- */
  var fmtSigned = function (v) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1); };
  var fmtCoord = function (lat, lon) {
    return Math.abs(lat).toFixed(1) + '°' + (lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(lon).toFixed(1) + '°' + (lon >= 0 ? 'E' : 'W');
  };

  function tilePixels(t) {
    if (t.px !== null) return t.px;
    try {
      var c = document.createElement('canvas');
      c.width = t.img.naturalWidth; c.height = t.img.naturalHeight;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(t.img, 0, 0);
      t.px = g;
    } catch (err) { t.px = false; }
    return t.px;
  }

  // Colour under the pointer → anomaly. Null over land, gaps, or a blended pixel.
  function sstAt(wx, wy) {
    if (!date || opts.layer !== 'sst') return null;
    var level = levelFor(LAYERS.sst.max), n = Math.pow(2, level);
    var t = tiles.get(dataKey('sst', date, level, Math.floor(wx * n), Math.floor(wy * n)));
    if (!t || t.state !== 'ok') return null;
    var g = tilePixels(t);
    if (!g) return null;
    var size = t.img.naturalWidth;
    var d;
    try { d = g.getImageData(Math.floor((wx * n % 1) * size), Math.floor((wy * n % 1) * size), 1, 1).data; } catch (err) { return null; }
    return window.SST.label(d[0], d[1], d[2], d[3]);
  }

  function showTip(pos) {
    var s = scale();
    var wx = wrap01(view.cx + (pos.x - view.w / 2) / s);
    var wy = view.cy + (pos.y - view.h / 2) / s;
    if (wy < 0 || wy > 1) { tipEl.hidden = true; return; }
    var lon = wx * 360 - 180, lat = latOf(wy);
    var val = sstAt(wx, wy);
    tipEl.textContent = '';
    if (val) {
      var strong = document.createElement('strong');
      strong.textContent = val;
      tipEl.appendChild(strong);
      tipEl.appendChild(document.createTextNode(' vs usual · '));
    }
    tipEl.appendChild(document.createTextNode(fmtCoord(lat, lon)));
    tipEl.hidden = false;
    var left = Math.min(pos.x + 14, view.w - tipEl.offsetWidth - 6);
    var top = pos.y + 14 + tipEl.offsetHeight > view.h ? pos.y - tipEl.offsetHeight - 10 : pos.y + 14;
    tipEl.style.left = Math.max(6, left) + 'px';
    tipEl.style.top = Math.max(6, top) + 'px';
  }

  /* ---- legend ---------------------------------------------------------- */
  function renderLegend() {
    var el = $('enso-legend');
    if (opts.layer === 'rain') {
      el.innerHTML = '<div class="enso-legend-title">Rain rate from NASA GPM IMERG. Clear areas had no rain.</div>' +
        '<div class="enso-legend-bar" style="background:linear-gradient(90deg,#8fdcff,#1f9e3a,#b8e000,#ffe100,#ff8a00,#e0202a)"></div>' +
        '<div class="enso-legend-ends"><span>Lighter</span><span>Heavier</span></div>';
      return;
    }
    var colors = window.SST.COLORS;
    var stops = colors.map(function (c, i) { return 'rgb(' + c.join(',') + ') ' + (i / (colors.length - 1) * 100).toFixed(1) + '%'; });
    var ticks = [-3, -2, -1, 0, 1, 2, 3].map(function (v) {
      return '<span style="left:' + ((v + 3.1) / 6.2 * 100).toFixed(1) + '%">' + (v === 0 ? '0' : fmtSigned(v).replace('.0', '')) + '</span>';
    }).join('');
    el.innerHTML = '<div class="enso-legend-title">Sea surface temperature vs usual (°C)</div>' +
      '<div class="enso-legend-bar" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></div>' +
      '<div class="enso-legend-ticks">' + ticks + '</div>' +
      '<div class="enso-legend-ends"><span>Cooler</span><span>Normal</span><span>Warmer</span></div>';
  }

  /* ---- date and layer controls ----------------------------------------- */
  var slider = $('enso-date');
  var dateLabel = $('enso-date-label');
  var pendingDate = null;

  function syncUrl() {
    var q = new URLSearchParams();
    if (date && date !== latest) q.set('date', date);
    if (opts.layer !== 'sst') q.set('layer', opts.layer);
    var s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }

  function setDate(d) {
    if (d === date) return;
    prevDate = date;
    date = d;
    noImagery = false;
    syncUrl();
    scheduleDraw();
  }

  function showSlider(i, immediate) {
    i = Math.max(0, Math.min(DAYS - 1, i));
    slider.value = String(i);
    var d = addDays(latest, i - (DAYS - 1));
    dateLabel.textContent = longDate(d) + (d === latest ? ' (latest)' : '');
    $('enso-prev').disabled = i === 0;
    $('enso-next').disabled = i === DAYS - 1;
    clearTimeout(pendingDate);
    if (immediate) setDate(d);
    else pendingDate = setTimeout(function () { setDate(d); }, 140); // don't fetch every day dragged past
  }

  function setLayer(id) {
    opts.layer = id;
    prevDate = null;
    noImagery = false;
    document.querySelectorAll('.enso-seg-btns button').forEach(function (b) {
      var on = b.dataset.layer === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    tipEl.hidden = true;
    renderLegend();
    syncUrl();
    scheduleDraw();
  }

  slider.addEventListener('input', function () { if (latest) showSlider(+slider.value); });
  $('enso-prev').onclick = function () { if (latest) showSlider(+slider.value - 1, true); };
  $('enso-next').onclick = function () { if (latest) showSlider(+slider.value + 1, true); };
  document.querySelectorAll('.enso-seg-btns button').forEach(function (b) {
    b.onclick = function () { setLayer(b.dataset.layer); };
  });
  $('enso-boxes').onchange = function (e) { opts.boxes = e.target.checked; scheduleDraw(); };
  $('enso-labels').onchange = function (e) { opts.labels = e.target.checked; scheduleDraw(); };

  // Newest day with a non-blank Pacific tile.
  function findLatest() {
    var today = iso(new Date());
    var probe = function (off) {
      var d = addDays(today, -off);
      return fetch(wmsTile(LAYERS.sst.id, d, 2, 0, 1)).then(function (r) { return r.blob(); })
        .then(function (b) { return b.size >= BLANK_BYTES ? d : null; })
        .catch(function () { return null; });
    };
    return Promise.all([1, 2, 3, 4, 5, 6, 7].map(probe)).then(function (found) {
      return found.filter(Boolean)[0] || addDays(today, -3);
    });
  }

  /* ---- trend chart ----------------------------------------------------- */
  function renderTrend() {
    var host = $('enso-trend');
    var data = page.series;
    if (!host || !data.length) return;
    var W = host.clientWidth, H = 240;
    var m = { t: 14, r: 62, b: 26, l: 40 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var vals = data.map(function (d) { return d.v; });
    var lo = Math.floor(Math.min(0, Math.min.apply(null, vals))), hi = Math.ceil(Math.max(1, Math.max.apply(null, vals)));
    var X = function (i) { return m.l + i / (data.length - 1) * iw; };
    var Y = function (v) { return m.t + (hi - v) / (hi - lo) * ih; };
    var svg = '';
    for (var v = lo; v <= hi; v++) {
      svg += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="' + (v === 0 ? 'enso-axis' : 'enso-grid') + '"/>' +
        '<text x="' + (m.l - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="enso-tick">' + (v === 0 ? '0' : fmtSigned(v).replace('.0', '')) + '</text>';
    }
    svg += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(0.5) + '" y2="' + Y(0.5) + '" class="enso-threshold"/>' +
      '<text x="' + (m.l + 6) + '" y="' + (Y(0.5) - 5) + '" class="enso-tick">+0.5 El Niño threshold</text>';
    var lastMonth = null, lastTickX = -100;
    data.forEach(function (d, i) {
      var mo = d.date.slice(0, 7);
      if (mo !== lastMonth) {
        lastMonth = mo;
        var x = X(i);
        if (x - lastTickX >= 44 && x < W - m.r - 16) {
          lastTickX = x;
          svg += '<text x="' + x + '" y="' + (H - 7) + '" text-anchor="middle" class="enso-tick">' + new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) + '</text>';
        }
      }
    });
    var path = data.map(function (d, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(d.v).toFixed(1); }).join('');
    var end = data[data.length - 1];
    svg += '<path d="' + path + '" class="enso-line"/>' +
      '<circle cx="' + X(data.length - 1) + '" cy="' + Y(end.v) + '" r="4" class="enso-dot"/>' +
      '<text x="' + (X(data.length - 1) + 9) + '" y="' + (Y(end.v) + 4) + '" class="enso-end">' + fmtSigned(end.v) + '°C</text>' +
      '<line id="enso-cross" class="enso-cross" y1="' + m.t + '" y2="' + (H - m.b) + '" visibility="hidden"/>';
    host.innerHTML = '<svg width="' + W + '" height="' + H + '" aria-hidden="true">' + svg + '</svg><div class="enso-tip" id="enso-trend-tip" hidden></div>';
    var cross = $('enso-cross'), tip = $('enso-trend-tip');
    host.onpointermove = function (e) {
      var r = host.getBoundingClientRect();
      var i = Math.max(0, Math.min(data.length - 1, Math.round((e.clientX - r.left - m.l) / iw * (data.length - 1))));
      var x = X(i);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      tip.textContent = '';
      var strong = document.createElement('strong');
      strong.textContent = fmtSigned(data[i].v) + '°C';
      tip.appendChild(strong);
      tip.appendChild(document.createTextNode(' · week of ' + shortDate(data[i].date)));
      tip.hidden = false;
      tip.style.left = Math.max(4, Math.min(x + 10, W - tip.offsetWidth - 4)) + 'px';
      tip.style.top = Math.max(4, Y(data[i].v) - tip.offsetHeight - 10) + 'px';
    };
    host.onpointerleave = function () { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  }

  /* ---- start ----------------------------------------------------------- */
  var q = new URLSearchParams(location.search);
  if (q.get('layer') === 'rain') opts.layer = 'rain';
  setLayer(opts.layer);

  if (window.ResizeObserver) {
    new ResizeObserver(function () { resize(); renderTrend(); }).observe(mapEl);
  } else {
    window.addEventListener('resize', function () { resize(); renderTrend(); });
  }
  resize();
  renderTrend();

  findLatest().then(function (d) {
    latest = d;
    var i = DAYS - 1;
    var want = q.get('date');
    if (want && /^\d{4}-\d{2}-\d{2}$/.test(want)) {
      var back = Math.round((new Date(latest + 'T00:00:00Z') - new Date(want + 'T00:00:00Z')) / 864e5);
      if (back >= 0 && back < DAYS) i = DAYS - 1 - back;
    }
    showSlider(i, true);
  });
})();
