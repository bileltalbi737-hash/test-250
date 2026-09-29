#!/usr/bin/env node
// Génère les icônes PNG de Carnet sans aucune dépendance (zlib natif).
// Style : tache de couleur impressionniste (nymphéa → rose Renoir → ciel) + coche blanche.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'web', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ---- PNG minimal ----------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Dessin ---------------------------------------------------------------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Palette impressionniste
const LAVANDE = hex('#8f86d8');
const ROSE = hex('#f0a3bd');
const CIEL = hex('#8cc4e8');
const SAULE = hex('#9cc9a2');
const CREME = hex('#fbf5e9');

// Petites « touches » de pinceau : ellipses translucides.
const DABS = [
  { x: 0.22, y: 0.30, rx: 0.26, ry: 0.16, rot: -0.5, c: ROSE, a: 0.55 },
  { x: 0.78, y: 0.26, rx: 0.22, ry: 0.14, rot: 0.4, c: CIEL, a: 0.55 },
  { x: 0.30, y: 0.78, rx: 0.24, ry: 0.15, rot: 0.3, c: SAULE, a: 0.45 },
  { x: 0.80, y: 0.76, rx: 0.26, ry: 0.15, rot: -0.35, c: LAVANDE, a: 0.5 },
  { x: 0.55, y: 0.52, rx: 0.30, ry: 0.18, rot: 0.15, c: ROSE, a: 0.25 },
];

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const t = clamp01((wx * vx + wy * vy) / (vx * vx + vy * vy));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

function render(size, { rounded, pad }) {
  const buf = Buffer.alloc(size * size * 4);
  const r = rounded ? size * 0.22 : 0;
  const inset = pad ? size * 0.08 : 0;
  const stroke = size * 0.085;
  // Coche : trois points en coordonnées relatives
  const A = [0.30, 0.53], B = [0.45, 0.68], C = [0.72, 0.36];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      // Fond : dégradé diagonal lavande → crème rosé → ciel
      let base = mix(mix(LAVANDE, ROSE, clamp01(u * 0.9 + v * 0.3)), CIEL, clamp01((v - u) * 0.8 + 0.35));
      base = mix(base, CREME, 0.12);
      // Touches
      for (const d of DABS) {
        const cs = Math.cos(d.rot), sn = Math.sin(d.rot);
        const dx = u - d.x, dy = v - d.y;
        const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
        const e = (lx * lx) / (d.rx * d.rx) + (ly * ly) / (d.ry * d.ry);
        const cov = clamp01((1.15 - e) * 3);
        if (cov > 0) base = mix(base, d.c, d.a * cov);
      }
      // Coche blanche avec anti-aliasing
      const px = u * size, py = v * size;
      const dist = Math.min(
        distToSegment(px, py, A[0] * size, A[1] * size, B[0] * size, B[1] * size),
        distToSegment(px, py, B[0] * size, B[1] * size, C[0] * size, C[1] * size)
      );
      const checkCov = clamp01((stroke / 2 - dist) + 0.75);
      // Ombre légère sous la coche
      const shadowCov = clamp01((stroke / 2 + size * 0.02 - distToSegment(px + size * 0.01, py + size * 0.015, A[0] * size, A[1] * size, B[0] * size, B[1] * size)) + 0.75)
        * 0.18;
      let col = mix(base, [60, 40, 90], shadowCov);
      col = mix(col, [255, 252, 246], checkCov);
      // Forme : carré arrondi (icône PWA) ou plein cadre (Apple)
      let alpha = 1;
      if (rounded) {
        const cx = Math.max(inset + r - x - 0.5, 0, x + 0.5 - (size - inset - r));
        const cy = Math.max(inset + r - y - 0.5, 0, y + 0.5 - (size - inset - r));
        const dd = Math.hypot(cx, cy) - r;
        alpha = clamp01(0.5 - dd);
        if (x + 0.5 < inset || y + 0.5 < inset || x + 0.5 > size - inset || y + 0.5 > size - inset) alpha = 0;
      }
      const i = (y * size + x) * 4;
      buf[i] = Math.round(col[0]); buf[i + 1] = Math.round(col[1]); buf[i + 2] = Math.round(col[2]);
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePNG(size, size, buf);
}

fs.writeFileSync(path.join(OUT, 'icon-192.png'), render(192, { rounded: false, pad: false }));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), render(512, { rounded: false, pad: false }));
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), render(180, { rounded: false, pad: false }));
fs.writeFileSync(path.join(OUT, 'favicon-rounded.png'), render(96, { rounded: true, pad: false }));
console.log('Icônes générées dans', OUT);
