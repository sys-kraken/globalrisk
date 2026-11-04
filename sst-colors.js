/*
 * NASA's published colour table for the GHRSST MUR sea temperature anomaly
 * layer: one row per 0.1°C from -3 to +3, open ended at both extremes.
 * Inverting it turns a pixel back into a value, for the hover readouts on the
 * /el-nino map and the dashboard globe.
 */
(function () {
  'use strict';
  var COLORS = [
    [107,0,219],[116,0,214],[127,0,211],[137,0,207],[150,0,202],[145,9,204],[127,26,209],[96,49,220],[65,75,230],[34,100,241],
    [8,124,251],[0,148,255],[0,174,255],[0,202,255],[0,227,255],[3,248,250],[24,252,229],[47,255,206],[71,255,182],[96,255,158],
    [118,255,140],[136,255,132],[151,255,139],[164,255,145],[177,255,152],[189,254,158],[191,244,163],[191,232,169],[191,219,176],[191,208,182],
    [194,202,184],[202,202,183],[213,213,172],[226,226,162],[237,237,152],[249,248,141],[255,246,121],[255,234,94],[255,222,67],[255,208,37],
    [255,194,9],[255,182,1],[255,170,0],[255,157,0],[255,145,0],[255,130,0],[255,113,0],[255,89,0],[255,61,0],[255,33,0],
    [254,9,0],[249,1,19],[243,0,45],[236,0,74],[230,0,103],[222,0,125],[211,0,133],[191,0,104],[171,0,72],[154,0,44],
    [136,0,15],[128,0,0]
  ];
  var MAX_DIST = 400; // squared RGB distance; anything further isn't a colour from this table

  // Label for one pixel, e.g. "+2.4°C", or null over land, gaps or a blended pixel.
  function label(r, g, b, a) {
    if (a < 200) return null;
    var best = -1, bestDist = MAX_DIST;
    for (var i = 0; i < COLORS.length; i++) {
      var c = COLORS[i];
      var dist = (c[0] - r) * (c[0] - r) + (c[1] - g) * (c[1] - g) + (c[2] - b) * (c[2] - b);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    if (best < 0) return null;
    if (best === 0) return 'below −3.0°C';
    if (best === COLORS.length - 1) return 'above +3.0°C';
    var v = -3.05 + best * 0.1; // the middle of the row's 0.1°C band
    if (Math.abs(v) < 0.1) return '0.0°C';
    return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1) + '°C';
  }

  window.SST = { COLORS: COLORS, label: label };
})();
