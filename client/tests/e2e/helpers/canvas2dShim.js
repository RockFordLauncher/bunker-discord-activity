// Pure-JS Headless HTML5 Canvas 2D RGBA Rasterizer & Browser Shim
// Strictly scoped to the E2E test harness (d:\game\client\tests\e2e).

const NAMED_COLORS = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0, 255],
  white: [255, 255, 255, 255],
  red: [255, 0, 0, 255],
  green: [0, 128, 0, 255],
  lime: [0, 255, 0, 255],
  blue: [0, 0, 255, 255],
  yellow: [255, 255, 0, 255],
  cyan: [0, 255, 255, 255],
  aqua: [0, 255, 255, 255],
  magenta: [255, 0, 255, 255],
  silver: [192, 192, 192, 255],
  gray: [128, 128, 128, 255],
  grey: [128, 128, 128, 255],
  maroon: [128, 0, 0, 255],
  olive: [128, 128, 0, 255],
  purple: [128, 0, 128, 255],
  teal: [0, 128, 128, 255],
  navy: [0, 0, 128, 255],
  orange: [255, 165, 0, 255],
  gold: [255, 215, 0, 255],
  pink: [255, 192, 203, 255],
  brown: [165, 42, 42, 255],
};

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}

export function parseCssColor(color) {
  if (typeof color !== 'string') return [0, 0, 0, 255];
  const s = color.trim().toLowerCase();
  if (NAMED_COLORS[s]) return NAMED_COLORS[s];

  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) : 255;
      return [r || 0, g || 0, b || 0, Number.isNaN(a) ? 255 : a];
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
      return [r || 0, g || 0, b || 0, Number.isNaN(a) ? 255 : a];
    }
  }

  const rgbMatch = s.match(/^rgba?\(\s*([^)]+)\s*\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[\s,/]+/).filter(Boolean);
    const r = Math.max(0, Math.min(255, Math.round(parseFloat(parts[0]) || 0)));
    const g = Math.max(0, Math.min(255, Math.round(parseFloat(parts[1]) || 0)));
    const b = Math.max(0, Math.min(255, Math.round(parseFloat(parts[2]) || 0)));
    let a = 255;
    if (parts[3] !== undefined) {
      const rawA = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      a = Math.max(0, Math.min(255, Math.round((Number.isNaN(rawA) ? 1 : rawA) * 255)));
    }
    return [r, g, b, a];
  }

  const hslMatch = s.match(/^hsla?\(\s*([^)]+)\s*\)$/);
  if (hslMatch) {
    const parts = hslMatch[1].split(/[\s,/]+/).filter(Boolean);
    const h = parseFloat(parts[0]) || 0;
    const sat = (parseFloat(parts[1]) || 0) / 100;
    const lig = (parseFloat(parts[2]) || 0) / 100;
    const [r, g, b] = hslToRgb(h, sat, lig);
    let a = 255;
    if (parts[3] !== undefined) {
      const rawA = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      a = Math.max(0, Math.min(255, Math.round((Number.isNaN(rawA) ? 1 : rawA) * 255)));
    }
    return [r, g, b, a];
  }

  return [0, 0, 0, 255];
}

export class MockCanvasGradient {
  constructor(type, coords, opsRef) {
    this.type = type; // 'linear' | 'radial'
    this.coords = coords;
    this.stops = [];
    this._opsRef = opsRef;
  }

  addColorStop(offset, color) {
    const t = Math.max(0, Math.min(1, Number(offset)));
    this.stops.push({ t, rgba: parseCssColor(color) });
    this.stops.sort((a, b) => a.t - b.t);
    if (this._opsRef) this._opsRef.gradientStops++;
  }

  sample(x, y) {
    if (this.stops.length === 0) return [0, 0, 0, 0];
    if (this.stops.length === 1) return this.stops[0].rgba;

    let t = 0;
    if (this.type === 'linear') {
      const [x0, y0, x1, y1] = this.coords;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const lenSq = dx * dx + dy * dy;
      if (lenSq > 1e-9) {
        t = ((x - x0) * dx + (y - y0) * dy) / lenSq;
      }
    } else {
      const [x0, y0, r0, x1, y1, r1] = this.coords;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dr = r1 - r0;
      // Simplified radial interpolation (exact when concentric, smooth approximation otherwise)
      const dist = Math.hypot(x - x1, y - y1);
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
        t = Math.abs(dr) > 1e-6 ? (dist - r0) / dr : 0;
      } else {
        const d0 = Math.hypot(x - x0, y - y0);
        const span = Math.max(1e-6, r1 - r0 + Math.hypot(dx, dy));
        t = (d0 - r0) / span;
      }
    }

    t = Math.max(0, Math.min(1, t));
    if (t <= this.stops[0].t) return this.stops[0].rgba;
    const last = this.stops[this.stops.length - 1];
    if (t >= last.t) return last.rgba;

    for (let i = 0; i < this.stops.length - 1; i++) {
      const s0 = this.stops[i];
      const s1 = this.stops[i + 1];
      if (t >= s0.t && t <= s1.t) {
        const span = s1.t - s0.t;
        const f = span > 1e-9 ? (t - s0.t) / span : 0;
        return [
          Math.round(s0.rgba[0] + (s1.rgba[0] - s0.rgba[0]) * f),
          Math.round(s0.rgba[1] + (s1.rgba[1] - s0.rgba[1]) * f),
          Math.round(s0.rgba[2] + (s1.rgba[2] - s0.rgba[2]) * f),
          Math.round(s0.rgba[3] + (s1.rgba[3] - s0.rgba[3]) * f),
        ];
      }
    }
    return last.rgba;
  }
}

export class MockCanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this._stack = [];
    this._path = [];
    this._subpathStart = null;
    this._lineDash = [];

    this._resetState();
    this.__ops = {
      fillRect: 0,
      strokeRect: 0,
      clearRect: 0,
      fill: 0,
      stroke: 0,
      arc: 0,
      ellipse: 0,
      linearGradients: 0,
      radialGradients: 0,
      gradientStops: 0,
      fillText: 0,
      strokeText: 0,
      drawImage: 0,
    };
  }

  _resetState() {
    this._transform = [1, 0, 0, 1, 0, 0]; // [a, b, c, d, e, f]
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1.0;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.miterLimit = 10;
    this.shadowColor = 'rgba(0, 0, 0, 0)';
    this.shadowBlur = 0;
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.imageSmoothingEnabled = true;
  }

  save() {
    this._stack.push({
      transform: [...this._transform],
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      miterLimit: this.miterLimit,
      shadowColor: this.shadowColor,
      shadowBlur: this.shadowBlur,
      shadowOffsetX: this.shadowOffsetX,
      shadowOffsetY: this.shadowOffsetY,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      imageSmoothingEnabled: this.imageSmoothingEnabled,
      lineDash: [...this._lineDash],
    });
  }

  restore() {
    const s = this._stack.pop();
    if (!s) return;
    this._transform = s.transform;
    this.globalAlpha = s.globalAlpha;
    this.globalCompositeOperation = s.globalCompositeOperation;
    this.fillStyle = s.fillStyle;
    this.strokeStyle = s.strokeStyle;
    this.lineWidth = s.lineWidth;
    this.lineCap = s.lineCap;
    this.lineJoin = s.lineJoin;
    this.miterLimit = s.miterLimit;
    this.shadowColor = s.shadowColor;
    this.shadowBlur = s.shadowBlur;
    this.shadowOffsetX = s.shadowOffsetX;
    this.shadowOffsetY = s.shadowOffsetY;
    this.font = s.font;
    this.textAlign = s.textAlign;
    this.textBaseline = s.textBaseline;
    this.imageSmoothingEnabled = s.imageSmoothingEnabled;
    this._lineDash = s.lineDash;
  }

  transform(a, b, c, d, e, f) {
    const [ta, tb, tc, td, te, tf] = this._transform;
    this._transform = [
      ta * a + tc * b,
      tb * a + td * b,
      ta * c + tc * d,
      tb * c + td * d,
      ta * e + tc * f + te,
      tb * e + td * f + tf,
    ];
  }

  setTransform(a, b, c, d, e, f) {
    if (typeof a === 'object' && a !== null) {
      this._transform = [a.a ?? 1, a.b ?? 0, a.c ?? 0, a.d ?? 1, a.e ?? 0, a.f ?? 0];
    } else {
      this._transform = [a, b, c, d, e, f];
    }
  }

  resetTransform() {
    this._transform = [1, 0, 0, 1, 0, 0];
  }

  getTransform() {
    const [a, b, c, d, e, f] = this._transform;
    return { a, b, c, d, e, f };
  }

  translate(x, y) {
    this.transform(1, 0, 0, 1, x, y);
  }

  scale(sx, sy) {
    this.transform(sx, 0, 0, sy, 0, 0);
  }

  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.transform(cos, sin, -sin, cos, 0, 0);
  }

  setLineDash(segments) {
    this._lineDash = Array.isArray(segments) ? [...segments] : [];
  }

  getLineDash() {
    return [...this._lineDash];
  }

  _tx(x, y) {
    const [a, b, c, d, e, f] = this._transform;
    return [a * x + c * y + e, b * x + d * y + f];
  }

  _invTx(px, py) {
    const [a, b, c, d, e, f] = this._transform;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-12) return [px, py];
    const dx = px - e;
    const dy = py - f;
    return [(d * dx - c * dy) / det, (-b * dx + a * dy) / det];
  }

  createLinearGradient(x0, y0, x1, y1) {
    this.__ops.linearGradients++;
    return new MockCanvasGradient('linear', [x0, y0, x1, y1], this.__ops);
  }

  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    this.__ops.radialGradients++;
    return new MockCanvasGradient('radial', [x0, y0, r0, x1, y1, r1], this.__ops);
  }

  createPattern() {
    return { _isPattern: true };
  }

  _blendPixel(idx, sr, sg, sb, saRaw) {
    const buf = this.canvas._buffer;
    const sa = (saRaw / 255) * Math.max(0, Math.min(1, this.globalAlpha));
    if (sa <= 0) return;

    const op = this.globalCompositeOperation;
    if (op === 'copy') {
      buf[idx] = sr;
      buf[idx + 1] = sg;
      buf[idx + 2] = sb;
      buf[idx + 3] = Math.round(sa * 255);
      return;
    }

    const dr = buf[idx];
    const dg = buf[idx + 1];
    const db = buf[idx + 2];
    const da = buf[idx + 3] / 255;

    if (op === 'destination-out') {
      buf[idx + 3] = Math.round(da * (1 - sa) * 255);
      return;
    }

    let r = sr;
    let g = sg;
    let b = sb;

    if (op === 'multiply') {
      r = (sr * dr) / 255;
      g = (sg * dg) / 255;
      b = (sb * db) / 255;
    } else if (op === 'lighter' || op === 'add') {
      buf[idx] = Math.min(255, Math.round(dr + sr * sa));
      buf[idx + 1] = Math.min(255, Math.round(dg + sg * sa));
      buf[idx + 2] = Math.min(255, Math.round(db + sb * sa));
      buf[idx + 3] = Math.min(255, Math.round((da + sa) * 255));
      return;
    } else if (op === 'screen') {
      r = 255 - ((255 - sr) * (255 - dr)) / 255;
      g = 255 - ((255 - sg) * (255 - dg)) / 255;
      b = 255 - ((255 - sb) * (255 - db)) / 255;
    } else if (op === 'overlay') {
      r = dr < 128 ? (2 * sr * dr) / 255 : 255 - (2 * (255 - sr) * (255 - dr)) / 255;
      g = dg < 128 ? (2 * sg * dg) / 255 : 255 - (2 * (255 - sg) * (255 - dg)) / 255;
      b = db < 128 ? (2 * sb * db) / 255 : 255 - (2 * (255 - sb) * (255 - db)) / 255;
    } else if (op === 'source-atop') {
      if (da <= 0) return;
      const outR = r * sa + dr * (1 - sa);
      const outG = g * sa + dg * (1 - sa);
      const outB = b * sa + db * (1 - sa);
      buf[idx] = Math.round(outR);
      buf[idx + 1] = Math.round(outG);
      buf[idx + 2] = Math.round(outB);
      return;
    }

    // Standard source-over Porter-Duff
    const outA = sa + da * (1 - sa);
    if (outA <= 1e-6) return;
    if (sa >= 0.999 && op === 'source-over') {
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    } else {
      const invOutA = 1 / outA;
      buf[idx] = Math.round((r * sa + dr * da * (1 - sa)) * invOutA);
      buf[idx + 1] = Math.round((g * sa + dg * da * (1 - sa)) * invOutA);
      buf[idx + 2] = Math.round((b * sa + db * da * (1 - sa)) * invOutA);
      buf[idx + 3] = Math.round(outA * 255);
    }
  }

  _resolveStyle(style) {
    if (style instanceof MockCanvasGradient) return { isGrad: true, grad: style };
    if (typeof style === 'string') return { isGrad: false, rgba: parseCssColor(style) };
    return { isGrad: false, rgba: [128, 128, 128, 255] };
  }

  _sampleStyleAtCanvasXY(resolved, cx, cy) {
    if (!resolved.isGrad) return resolved.rgba;
    const [ux, uy] = this._invTx(cx + 0.5, cy + 0.5);
    return resolved.grad.sample(ux, uy);
  }

  clearRect(x, y, w, h) {
    this.__ops.clearRect++;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const pts = [
      this._tx(x, y),
      this._tx(x + w, y),
      this._tx(x + w, y + h),
      this._tx(x, y + h),
    ];
    const minX = Math.max(0, Math.floor(Math.min(...pts.map(p => p[0]))));
    const maxX = Math.min(cw - 1, Math.ceil(Math.max(...pts.map(p => p[0]))) - 1);
    const minY = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1]))));
    const maxY = Math.min(ch - 1, Math.ceil(Math.max(...pts.map(p => p[1]))) - 1);
    const buf = this.canvas._buffer;
    for (let py = minY; py <= maxY; py++) {
      let idx = (py * cw + minX) * 4;
      for (let px = minX; px <= maxX; px++) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        idx += 4;
      }
    }
  }

  fillRect(x, y, w, h) {
    this.__ops.fillRect++;
    if (w === 0 || h === 0) return;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }

    const [a, b, c, d] = this._transform;
    const isAxisAligned = Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6 && a > 0 && d > 0;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const resolved = this._resolveStyle(this.fillStyle);

    if (isAxisAligned) {
      const [x0, y0] = this._tx(x, y);
      const [x1, y1] = this._tx(x + w, y + h);
      const minX = Math.max(0, Math.floor(x0));
      const maxX = Math.min(cw - 1, Math.ceil(x1) - 1);
      const minY = Math.max(0, Math.floor(y0));
      const maxY = Math.min(ch - 1, Math.ceil(y1) - 1);
      if (minX > maxX || minY > maxY) return;

      // Fast path for opaque solid fill
      if (!resolved.isGrad && resolved.rgba[3] === 255 && this.globalAlpha >= 0.999 && this.globalCompositeOperation === 'source-over') {
        const [sr, sg, sb] = resolved.rgba;
        const buf = this.canvas._buffer;
        for (let py = minY; py <= maxY; py++) {
          let idx = (py * cw + minX) * 4;
          for (let px = minX; px <= maxX; px++) {
            buf[idx] = sr;
            buf[idx + 1] = sg;
            buf[idx + 2] = sb;
            buf[idx + 3] = 255;
            idx += 4;
          }
        }
        return;
      }

      if (!resolved.isGrad) {
        const [sr, sg, sb, sa] = resolved.rgba;
        for (let py = minY; py <= maxY; py++) {
          let idx = (py * cw + minX) * 4;
          for (let px = minX; px <= maxX; px++) {
            this._blendPixel(idx, sr, sg, sb, sa);
            idx += 4;
          }
        }
      } else {
        for (let py = minY; py <= maxY; py++) {
          let idx = (py * cw + minX) * 4;
          for (let px = minX; px <= maxX; px++) {
            const [sr, sg, sb, sa] = this._sampleStyleAtCanvasXY(resolved, px, py);
            this._blendPixel(idx, sr, sg, sb, sa);
            idx += 4;
          }
        }
      }
      return;
    }

    // General transformed rectangle via polygon scanline
    const poly = [
      this._tx(x, y),
      this._tx(x + w, y),
      this._tx(x + w, y + h),
      this._tx(x, y + h),
    ];
    this._rasterizePolygons([poly], resolved);
  }

  strokeRect(x, y, w, h) {
    this.__ops.strokeRect++;
    const resolved = this._resolveStyle(this.strokeStyle);
    const pts = [
      this._tx(x, y),
      this._tx(x + w, y),
      this._tx(x + w, y + h),
      this._tx(x, y + h),
      this._tx(x, y),
    ];
    this._strokePolyline(pts, resolved);
  }

  beginPath() {
    this._path = [];
    this._subpathStart = null;
  }

  moveTo(x, y) {
    const p = this._tx(x, y);
    const sub = [p];
    this._path.push({ pts: sub, closed: false });
    this._subpathStart = p;
  }

  lineTo(x, y) {
    if (this._path.length === 0) {
      this.moveTo(x, y);
      return;
    }
    const p = this._tx(x, y);
    this._path[this._path.length - 1].pts.push(p);
  }

  quadraticCurveTo(cpx, cpy, x, y) {
    if (this._path.length === 0) {
      this.moveTo(cpx, cpy);
    }
    const sub = this._path[this._path.length - 1].pts;
    const p0 = sub[sub.length - 1];
    const p1 = this._tx(cpx, cpy);
    const p2 = this._tx(x, y);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      sub.push([
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      ]);
    }
  }

  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    if (this._path.length === 0) {
      this.moveTo(cp1x, cp1y);
    }
    const sub = this._path[this._path.length - 1].pts;
    const p0 = sub[sub.length - 1];
    const p1 = this._tx(cp1x, cp1y);
    const p2 = this._tx(cp2x, cp2y);
    const p3 = this._tx(x, y);
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const u2 = u * u;
      const t2 = t * t;
      sub.push([
        u2 * u * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t2 * t * p3[0],
        u2 * u * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t2 * t * p3[1],
      ]);
    }
  }

  arc(cx, cy, r, startAngle, endAngle, ccw = false) {
    this.__ops.arc++;
    this.ellipse(cx, cy, r, r, 0, startAngle, endAngle, ccw);
  }

  ellipse(cx, cy, rx, ry, rotation, startAngle, endAngle, ccw = false) {
    this.__ops.ellipse++;
    let sa = startAngle;
    let ea = endAngle;
    if (ccw) {
      while (ea > sa) ea -= Math.PI * 2;
      if (Math.abs(sa - ea) < 1e-9 && startAngle !== endAngle) ea -= Math.PI * 2;
    } else {
      while (ea < sa) ea += Math.PI * 2;
      if (Math.abs(ea - sa) < 1e-9 && startAngle !== endAngle) ea += Math.PI * 2;
    }
    const span = ea - sa;
    const steps = Math.max(8, Math.min(48, Math.ceil(Math.abs(span) / (Math.PI / 12))));
    const cosR = Math.cos(rotation || 0);
    const sinR = Math.sin(rotation || 0);

    for (let i = 0; i <= steps; i++) {
      const ang = sa + (span * i) / steps;
      const lx = rx * Math.cos(ang);
      const ly = ry * Math.sin(ang);
      const px = cx + lx * cosR - ly * sinR;
      const py = cy + lx * sinR + ly * cosR;
      if (i === 0 && this._path.length === 0) {
        this.moveTo(px, py);
      } else if (i === 0) {
        this.lineTo(px, py);
      } else {
        this.lineTo(px, py);
      }
    }
  }

  rect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }

  roundRect(x, y, w, h, radii = 0) {
    const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? (radii[0] || 0) : 0);
    const cr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    if (cr <= 0) {
      this.rect(x, y, w, h);
      return;
    }
    this.moveTo(x + cr, y);
    this.lineTo(x + w - cr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + cr);
    this.lineTo(x + w, y + h - cr);
    this.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
    this.lineTo(x + cr, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - cr);
    this.lineTo(x, y + cr);
    this.quadraticCurveTo(x, y, x + cr, y);
    this.closePath();
  }

  closePath() {
    if (this._path.length === 0) return;
    const sub = this._path[this._path.length - 1];
    sub.closed = true;
    if (sub.pts.length > 1) {
      sub.pts.push([...sub.pts[0]]);
    }
  }

  clip() {
    // No-op clip stub for compatibility
  }

  _rasterizePolygons(polygons, resolved) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    let minY = ch;
    let maxY = -1;
    let minX = cw;
    let maxX = -1;

    for (const poly of polygons) {
      for (const p of poly) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(ch - 1, Math.ceil(maxY));
    if (y0 > y1 || maxX < 0 || minX >= cw) return;

    const nodes = [];
    for (let py = y0; py <= y1; py++) {
      const scanY = py + 0.5;
      nodes.length = 0;
      for (const poly of polygons) {
        const n = poly.length;
        if (n < 3) continue;
        for (let i = 0; i < n; i++) {
          const p0 = poly[i];
          const p1 = poly[(i + 1) % n];
          if ((p0[1] <= scanY && p1[1] > scanY) || (p1[1] <= scanY && p0[1] > scanY)) {
            const xInt = p0[0] + ((scanY - p0[1]) * (p1[0] - p0[0])) / (p1[1] - p0[1]);
            nodes.push(xInt);
          }
        }
      }
      if (nodes.length < 2) continue;
      nodes.sort((a, b) => a - b);
      for (let i = 0; i < nodes.length - 1; i += 2) {
        const xs = Math.max(0, Math.floor(nodes[i]));
        const xe = Math.min(cw - 1, Math.ceil(nodes[i + 1]) - 1);
        if (xs > xe) continue;
        let idx = (py * cw + xs) * 4;
        if (!resolved.isGrad) {
          const [sr, sg, sb, sa] = resolved.rgba;
          for (let px = xs; px <= xe; px++) {
            this._blendPixel(idx, sr, sg, sb, sa);
            idx += 4;
          }
        } else {
          for (let px = xs; px <= xe; px++) {
            const [sr, sg, sb, sa] = this._sampleStyleAtCanvasXY(resolved, px, py);
            this._blendPixel(idx, sr, sg, sb, sa);
            idx += 4;
          }
        }
      }
    }
  }

  _strokePolyline(pts, resolved) {
    if (pts.length < 2) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scaleApprox = Math.max(
      Math.hypot(this._transform[0], this._transform[1]),
      Math.hypot(this._transform[2], this._transform[3])
    );
    const radius = Math.max(0.5, (this.lineWidth * scaleApprox) / 2);
    const rCeil = Math.ceil(radius);
    const rSq = radius * radius;

    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const segMinX = Math.max(0, Math.floor(Math.min(x0, x1) - rCeil));
      const segMaxX = Math.min(cw - 1, Math.ceil(Math.max(x0, x1) + rCeil));
      const segMinY = Math.max(0, Math.floor(Math.min(y0, y1) - rCeil));
      const segMaxY = Math.min(ch - 1, Math.ceil(Math.max(y0, y1) + rCeil));
      const dx = x1 - x0;
      const dy = y1 - y0;
      const lenSq = dx * dx + dy * dy;

      for (let py = segMinY; py <= segMaxY; py++) {
        const cy = py + 0.5;
        let idx = (py * cw + segMinX) * 4;
        for (let px = segMinX; px <= segMaxX; px++) {
          const cx = px + 0.5;
          let t = lenSq > 1e-9 ? ((cx - x0) * dx + (cy - y0) * dy) / lenSq : 0;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
          const projX = x0 + t * dx;
          const projY = y0 + t * dy;
          const distSq = (cx - projX) * (cx - projX) + (cy - projY) * (cy - projY);
          if (distSq <= rSq) {
            const [sr, sg, sb, sa] = this._sampleStyleAtCanvasXY(resolved, px, py);
            this._blendPixel(idx, sr, sg, sb, sa);
          }
          idx += 4;
        }
      }
    }
  }

  fill() {
    this.__ops.fill++;
    if (this._path.length === 0) return;
    const resolved = this._resolveStyle(this.fillStyle);
    const polygons = this._path.map(sub => sub.pts).filter(pts => pts.length >= 3);
    if (polygons.length > 0) {
      this._rasterizePolygons(polygons, resolved);
    }
  }

  stroke() {
    this.__ops.stroke++;
    if (this._path.length === 0) return;
    const resolved = this._resolveStyle(this.strokeStyle);
    for (const sub of this._path) {
      this._strokePolyline(sub.pts, resolved);
    }
  }

  _parseFontSize() {
    const m = String(this.font || '').match(/(\d+(?:\.\d+)?)px/i);
    return m ? Math.max(6, parseFloat(m[1])) : 12;
  }

  measureText(text) {
    const fontSize = this._parseFontSize();
    return { width: String(text || '').length * fontSize * 0.6 };
  }

  _rasterizeText(text, x, y, style) {
    const str = String(text ?? '');
    if (!str.length) return;
    const fontSize = this._parseFontSize();
    const charW = Math.max(4, Math.round(fontSize * 0.55));
    const charH = Math.max(6, Math.round(fontSize * 0.85));
    const totalW = str.length * (charW + 2);
    let startX = x;
    if (this.textAlign === 'center') startX -= totalW / 2;
    else if (this.textAlign === 'right' || this.textAlign === 'end') startX -= totalW;

    let startY = y;
    if (this.textBaseline === 'middle') startY -= charH / 2;
    else if (this.textBaseline === 'bottom' || this.textBaseline === 'alphabetic') startY -= charH;

    const prevFill = this.fillStyle;
    this.fillStyle = style;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code === 32) continue;
      const gx = startX + i * (charW + 2);
      // Draw deterministic multi-stroke glyph pattern so characters produce real contrast
      this.fillRect(gx, startY, charW, Math.max(2, Math.round(charH * 0.25)));
      this.fillRect(gx, startY + charH * 0.4, charW * 0.8, Math.max(2, Math.round(charH * 0.2)));
      this.fillRect(gx + (code % 2 === 0 ? 0 : charW * 0.5), startY, Math.max(2, Math.round(charW * 0.35)), charH);
      this.fillRect(gx, startY + charH * 0.78, charW, Math.max(2, Math.round(charH * 0.22)));
    }
    this.fillStyle = prevFill;
  }

  fillText(text, x, y) {
    this.__ops.fillText++;
    this._rasterizeText(text, x, y, this.fillStyle);
  }

  strokeText(text, x, y) {
    this.__ops.strokeText++;
    this._rasterizeText(text, x, y, this.strokeStyle);
  }

  drawImage(img, ...args) {
    this.__ops.drawImage++;
    if (!img || !img._buffer) return;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    let dx = 0, dy = 0, dw = img.width, dh = img.height;
    if (args.length === 2) {
      [dx, dy] = args;
    } else if (args.length === 4) {
      [dx, dy, dw, dh] = args;
    } else if (args.length >= 8) {
      [sx, sy, sw, sh, dx, dy, dw, dh] = args;
    }
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const iw = img.width;
    const ih = img.height;
    if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return;
    const minX = Math.max(0, Math.floor(dx));
    const maxX = Math.min(cw - 1, Math.ceil(dx + dw) - 1);
    const minY = Math.max(0, Math.floor(dy));
    const maxY = Math.min(ch - 1, Math.ceil(dy + dh) - 1);
    for (let py = minY; py <= maxY; py++) {
      const srcY = Math.max(0, Math.min(ih - 1, Math.floor(sy + ((py - dy) / dh) * sh)));
      for (let px = minX; px <= maxX; px++) {
        const srcX = Math.max(0, Math.min(iw - 1, Math.floor(sx + ((px - dx) / dw) * sw)));
        const sIdx = (srcY * iw + srcX) * 4;
        const dIdx = (py * cw + px) * 4;
        this._blendPixel(
          dIdx,
          img._buffer[sIdx],
          img._buffer[sIdx + 1],
          img._buffer[sIdx + 2],
          img._buffer[sIdx + 3]
        );
      }
    }
  }

  createImageData(w, h) {
    return {
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    };
  }

  getImageData(sx = 0, sy = 0, sw = this.canvas.width, sh = this.canvas.height) {
    const out = new Uint8ClampedArray(sw * sh * 4);
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const buf = this.canvas._buffer;
    for (let y = 0; y < sh; y++) {
      const srcY = sy + y;
      if (srcY < 0 || srcY >= ch) continue;
      for (let x = 0; x < sw; x++) {
        const srcX = sx + x;
        if (srcX < 0 || srcX >= cw) continue;
        const sIdx = (srcY * cw + srcX) * 4;
        const dIdx = (y * sw + x) * 4;
        out[dIdx] = buf[sIdx];
        out[dIdx + 1] = buf[sIdx + 1];
        out[dIdx + 2] = buf[sIdx + 2];
        out[dIdx + 3] = buf[sIdx + 3];
      }
    }
    return { width: sw, height: sh, data: out };
  }

  putImageData(imageData, dx = 0, dy = 0) {
    if (!imageData || !imageData.data) return;
    const sw = imageData.width;
    const sh = imageData.height;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const buf = this.canvas._buffer;
    for (let y = 0; y < sh; y++) {
      const dstY = dy + y;
      if (dstY < 0 || dstY >= ch) continue;
      for (let x = 0; x < sw; x++) {
        const dstX = dx + x;
        if (dstX < 0 || dstX >= cw) continue;
        const sIdx = (y * sw + x) * 4;
        const dIdx = (dstY * cw + dstX) * 4;
        buf[dIdx] = imageData.data[sIdx];
        buf[dIdx + 1] = imageData.data[sIdx + 1];
        buf[dIdx + 2] = imageData.data[sIdx + 2];
        buf[dIdx + 3] = imageData.data[sIdx + 3];
      }
    }
  }
}

export class MockHTMLCanvasElement {
  constructor(width = 300, height = 150) {
    this._width = width;
    this._height = height;
    this._buffer = new Uint8ClampedArray(width * height * 4);
    this._ctx2d = null;
    this.style = {};
    this.nodeName = 'CANVAS';
    this.tagName = 'CANVAS';
  }

  get width() {
    return this._width;
  }

  set width(val) {
    const next = Math.max(1, Math.floor(Number(val) || 1));
    if (next !== this._width) {
      this._width = next;
      this._buffer = new Uint8ClampedArray(this._width * this._height * 4);
    }
  }

  get height() {
    return this._height;
  }

  set height(val) {
    const next = Math.max(1, Math.floor(Number(val) || 1));
    if (next !== this._height) {
      this._height = next;
      this._buffer = new Uint8ClampedArray(this._width * this._height * 4);
    }
  }

  getContext(type) {
    if (type === '2d') {
      if (!this._ctx2d) {
        this._ctx2d = new MockCanvasRenderingContext2D(this);
      }
      return this._ctx2d;
    }
    return null;
  }

  toDataURL() {
    return `data:image/png;base64,MOCK_${this._width}x${this._height}`;
  }

  addEventListener() {}
  removeEventListener() {}
}

export class MockImage {
  constructor() {
    this.width = 64;
    this.height = 64;
    this.complete = false;
    this._src = '';
    this.onload = null;
    this.onerror = null;
  }

  get src() {
    return this._src;
  }

  set src(val) {
    this._src = String(val || '');
    this.complete = true;
    if (typeof this.onload === 'function') {
      this.onload();
    }
  }

  addEventListener(ev, fn) {
    if (ev === 'load') this.onload = fn;
    if (ev === 'error') this.onerror = fn;
  }

  removeEventListener() {}
}

export function installBrowserShims({ withImage = true } = {}) {
  const prevDocument = globalThis.document;
  const prevCanvas = globalThis.HTMLCanvasElement;
  const prevCtx = globalThis.CanvasRenderingContext2D;
  const prevImage = globalThis.Image;
  const hadImage = Object.prototype.hasOwnProperty.call(globalThis, 'Image');

  globalThis.HTMLCanvasElement = MockHTMLCanvasElement;
  globalThis.CanvasRenderingContext2D = MockCanvasRenderingContext2D;
  globalThis.document = {
    createElement(tag) {
      if (String(tag).toLowerCase() === 'canvas') {
        return new MockHTMLCanvasElement(300, 150);
      }
      return { tagName: String(tag).toUpperCase(), style: {}, appendChild() {}, addEventListener() {} };
    },
    createElementNS(_ns, tag) {
      return this.createElement(tag);
    },
    body: {
      appendChild() {},
      removeChild() {},
    },
  };

  if (withImage) {
    globalThis.Image = MockImage;
  } else {
    delete globalThis.Image;
  }

  return function restoreBrowserShims() {
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;

    if (prevCanvas === undefined) delete globalThis.HTMLCanvasElement;
    else globalThis.HTMLCanvasElement = prevCanvas;

    if (prevCtx === undefined) delete globalThis.CanvasRenderingContext2D;
    else globalThis.CanvasRenderingContext2D = prevCtx;

    if (!hadImage) delete globalThis.Image;
    else globalThis.Image = prevImage;
  };
}
