'use strict';
/*
 * Minimal GRIB2 decoder for one message on a regular lat/lon grid — enough to
 * read NOAA GFS fields (wind, temperature, humidity, pressure).
 *
 * Supports grid template 3.0 (lat/lon) and data representation templates
 * 5.0 (simple packing), 5.2 (complex packing) and 5.3 (complex packing with
 * spatial differencing — what GFS uses). Bitmaps (section 6) are honoured.
 * JPEG2000 / PNG packed messages are rejected.
 *
 *   decode(buf) → { ni, nj, la1, lo1, dlat, dlon, values: Float32Array }
 *   values are row-major in the file's scan order (GFS: north → south, east from lo1).
 */

// Sign-and-magnitude integers, as GRIB2 stores signed fields.
function smInt(buf, off, len) {
  let v = 0;
  for (let i = 0; i < len; i++) v = v * 256 + buf[off + i];
  const top = 2 ** (8 * len - 1);
  return v >= top ? -(v - top) : v;
}

class Bits {
  constructor(buf, off) { this.buf = buf; this.pos = off * 8; }
  read(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const p = this.pos++;
      v = v * 2 + ((this.buf[p >> 3] >> (7 - (p & 7))) & 1);
    }
    return v;
  }
  align() { this.pos = (this.pos + 7) & ~7; }
}

function decode(buf) {
  if (buf.toString('ascii', 0, 4) !== 'GRIB' || buf[7] !== 2) throw new Error('not a GRIB2 message');
  let p = 16, grid = null, rep = null, bitmap = null, data = null;
  while (p < buf.length - 4) {
    if (buf.toString('ascii', p, p + 4) === '7777') break;
    const len = buf.readUInt32BE(p), sec = buf[p + 4];
    if (sec === 3) {
      const tmpl = buf.readUInt16BE(p + 12);
      if (tmpl !== 0) throw new Error('grid template ' + tmpl + ' not supported');
      grid = {
        ni: buf.readUInt32BE(p + 30), nj: buf.readUInt32BE(p + 34),
        la1: smInt(buf, p + 46, 4) / 1e6, lo1: smInt(buf, p + 50, 4) / 1e6,
        la2: smInt(buf, p + 55, 4) / 1e6, lo2: smInt(buf, p + 59, 4) / 1e6,
        di: buf.readUInt32BE(p + 63) / 1e6, dj: buf.readUInt32BE(p + 67) / 1e6,
        scan: buf[p + 71],
      };
    } else if (sec === 5) {
      rep = { n: buf.readUInt32BE(p + 5), tmpl: buf.readUInt16BE(p + 9), off: p };
    } else if (sec === 6) {
      if (buf[p + 5] === 0) bitmap = { off: p + 6 };
      else if (buf[p + 5] !== 255) throw new Error('predefined bitmaps not supported');
    } else if (sec === 7) {
      data = { off: p + 5, len: len - 5 };
    }
    p += len;
  }
  if (!grid || !rep || !data) throw new Error('incomplete GRIB2 message');

  const s = rep.off;
  const R = buf.readFloatBE(s + 11);
  const E = smInt(buf, s + 15, 2), D = smInt(buf, s + 17, 2);
  const nbits = buf[s + 19];
  const bscale = 2 ** E, dscale = 10 ** -D;
  const n = rep.n;
  const packed = new Float64Array(n);     // integer field before scaling

  if (rep.tmpl === 0) {
    const bits = new Bits(buf, data.off);
    if (nbits) for (let i = 0; i < n; i++) packed[i] = bits.read(nbits);
  } else if (rep.tmpl === 2 || rep.tmpl === 3) {
    const ng = buf.readUInt32BE(s + 31);
    const widthRef = buf[s + 35], widthBits = buf[s + 36];
    const lenRef = buf.readUInt32BE(s + 37), lenInc = buf[s + 41];
    const lastLen = buf.readUInt32BE(s + 42), lenBits = buf[s + 46];
    const order = rep.tmpl === 3 ? buf[s + 47] : 0;
    const extra = rep.tmpl === 3 ? buf[s + 48] : 0;
    if (buf[s + 22] !== 0) throw new Error('missing-value management not supported');

    let o = data.off;
    const first = [];
    for (let k = 0; k < order; k++) { first.push(smInt(buf, o, extra)); o += extra; }
    const minsd = order ? smInt(buf, o, extra) : 0;
    if (order) o += extra;

    const bits = new Bits(buf, o);
    const refs = new Array(ng), widths = new Array(ng), lens = new Array(ng);
    for (let g = 0; g < ng; g++) refs[g] = nbits ? bits.read(nbits) : 0;
    bits.align();
    for (let g = 0; g < ng; g++) widths[g] = widthRef + (widthBits ? bits.read(widthBits) : 0);
    bits.align();
    for (let g = 0; g < ng; g++) lens[g] = lenRef + (lenBits ? bits.read(lenBits) : 0) * lenInc;
    lens[ng - 1] = lastLen;
    bits.align();

    let i = 0;
    for (let g = 0; g < ng; g++) {
      const w = widths[g], r = refs[g], L = lens[g];
      if (w === 0) for (let k = 0; k < L; k++) packed[i++] = r;
      else for (let k = 0; k < L; k++) packed[i++] = r + bits.read(w);
    }
    if (order === 1) {
      packed[0] = first[0];
      for (let k = 1; k < n; k++) packed[k] = packed[k] + minsd + packed[k - 1];
    } else if (order === 2) {
      packed[0] = first[0]; packed[1] = first[1];
      for (let k = 2; k < n; k++) packed[k] = packed[k] + minsd + 2 * packed[k - 1] - packed[k - 2];
    }
  } else {
    throw new Error('data template 5.' + rep.tmpl + ' not supported');
  }

  const total = grid.ni * grid.nj, values = new Float32Array(total);
  if (bitmap) {
    let k = 0;
    for (let i = 0; i < total; i++) {
      const on = (buf[bitmap.off + (i >> 3)] >> (7 - (i & 7))) & 1;
      values[i] = on ? (R + packed[k++] * bscale) * dscale : NaN;
    }
  } else {
    for (let i = 0; i < total; i++) values[i] = (R + packed[i] * bscale) * dscale;
  }
  return {
    ni: grid.ni, nj: grid.nj, la1: grid.la1, lo1: grid.lo1,
    dlat: (grid.scan & 0x40) ? grid.dj : -grid.dj,   // GFS scans north → south
    dlon: grid.di,
    values,
  };
}

module.exports = { decode };
