// Ink çekirdeğinin hızlı JavaScript sürümü: Unity'deki Ink.cs ile aynı hesaplar (el titremesi gürültüsü, incelen uçlar, tarama),
// ama Vector2 nesneleri ve C# listeleri yerine tipli dizilere yazar. derlenmiş C# sınıfının (Kick.Ink) sıcak metodlarını değiştirir;
// durum alanları (Zoom, Reveal, used, xf, Off...) yine Kick.Ink üzerinde durur, C# tarafı onları ayarlamaya devam eder.
window.kkInstallInk = function () {
  'use strict';
  var I = Kick.Ink;
  var orig = { Stroke: I.Stroke, Fill: I.Fill, Tube: I.Tube };
  // köşe tamponu: konum (2), renk (4 bayt), u0 (4), u1 (4); üçgen dizini
  var cap = 1 << 15, P = new Float32Array(cap * 2), C = new Uint8Array(cap * 4), U0 = new Float32Array(cap * 4), U1 = new Float32Array(cap * 4);
  var tcap = 1 << 16, T = new Uint32Array(tcap);
  var nv = 0, nt = 0;
  function vgrow(n) { if (nv + n <= cap) return; var c = cap; while (nv + n > c) c *= 2; var p = new Float32Array(c * 2); p.set(P); P = p; var cc = new Uint8Array(c * 4); cc.set(C); C = cc; var a = new Float32Array(c * 4); a.set(U0); U0 = a; var b = new Float32Array(c * 4); b.set(U1); U1 = b; cap = c; }
  function tgrow(n) { if (nt + n <= tcap) return; var c = tcap; while (nt + n > c) c *= 2; var t = new Uint32Array(c); t.set(T); T = t; tcap = c; }
  function V(x, y, r, g, b, a, a0, a1, a2, a3, b0, b1, b2, b3) {
    var i = nv++; P[i * 2] = x; P[i * 2 + 1] = y; C[i * 4] = r; C[i * 4 + 1] = g; C[i * 4 + 2] = b; C[i * 4 + 3] = a;
    U0[i * 4] = a0; U0[i * 4 + 1] = a1; U0[i * 4 + 2] = a2; U0[i * 4 + 3] = a3; U1[i * 4] = b0; U1[i * 4 + 1] = b1; U1[i * 4 + 2] = b2; U1[i * 4 + 3] = b3;
  }
  function tri(a, b, c) { T[nt++] = a; T[nt++] = b; T[nt++] = c; }

  // gürültü: Ink.H / Rnd / N ile bit bit aynı (32 bit taşmalı çarpma)
  function H(x) { var h = x >>> 0; h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16; return (h & 0xFFFFFF) * (1 / 16777216); }
  function Rnd(seed, k) { return H(Math.imul(seed | 0, 73856093) ^ Math.imul((k || 0) | 0, 19349663)); }
  function N(x, seed) {
    var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f);
    var b = Math.imul(seed | 0, 668265263), h0 = H((Math.imul(i, 374761393) + b) | 0), h1 = H((Math.imul(i + 1, 374761393) + b) | 0);
    return (h0 + (h1 - h0) * f) * 2 - 1;
  }
  I.H = H; I.Rnd = function (seed, k) { return Rnd(seed, k === void 0 ? 0 : k); }; I.N = N;
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // yerel çerçeve (Xf) ve kayma (Off): C# tarafının alanlarından okunur
  var tx = 0, ty = 0;
  function X(px, py) {
    var o = I.Off;
    if (!I.xf) { tx = px + o.x; ty = py + o.y; return; }
    var x = px * I.xsx, y = py * I.xsy; tx = I.xo.x + x * I.xc - y * I.xs + o.x; ty = I.xo.y + x * I.xs + y * I.xc + o.y;
  }

  // yolu sık noktalara böler (Resample). raw: noktalar zaten dünya koordinatında (Tube kenarları)
  var RS = new Float32Array(4096), RL = new Float32Array(2048), rn = 0;
  function rsPush(x, y, l) { if (rn * 2 + 2 > RS.length) { var a = new Float32Array(RS.length * 2); a.set(RS); RS = a; var b = new Float32Array(RL.length * 2); b.set(RL); RL = b; } RS[rn * 2] = x; RS[rn * 2 + 1] = y; RL[rn] = l; rn++; }
  var SX = new Float32Array(1024), SN = 0;   // kaynak noktalar (listeden ya da elden)
  function srcFromList(pts) { var n = pts._size, it = pts._items; if (SX.length < n * 2) SX = new Float32Array(n * 4); for (var i = 0; i < n; i++) { SX[i * 2] = it[i].x; SX[i * 2 + 1] = it[i].y; } SN = n; }
  function resample(step, raw) {
    rn = 0; if (SN < 1) return 0;
    var ax, ay; if (raw) { ax = SX[0]; ay = SX[1]; } else { X(SX[0], SX[1]); ax = tx; ay = ty; }
    rsPush(ax, ay, 0); var len = 0;
    for (var i = 1; i < SN; i++) {
      var bx, by; if (raw) { bx = SX[i * 2]; by = SX[i * 2 + 1]; } else { X(SX[i * 2], SX[i * 2 + 1]); bx = tx; by = ty; }
      var dx = bx - ax, dy = by - ay, d = Math.sqrt(dx * dx + dy * dy); if (d < 1e-5) continue;
      var k = Math.max(1, Math.ceil(d / step));
      for (var j = 1; j <= k; j++) { var t = j / k; rsPush(ax + dx * t, ay + dy * t, len + d * j / k); }
      len += d; ax = bx; ay = by;
    }
    return len;
  }

  function alpha(a, k) { var v = a * k * I.Alpha * I.Master; return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

  // çizginin kendisi (Ink.Stroke): SX'teki noktalardan
  function strokeCore(w, col, seed, wob, taper, grain, w1, raw) {
    if (SN < 2) return;
    var z = I.Zoom; if (z !== 1) { w *= z; if (w1 > 0) w1 *= z; }
    var Px = I.Px, minW = 1.3 / Px, af = 1, pad = 0.9 / Px;
    if (w < minW) { af = Math.max(0.4, w / minW); if (w1 > 0) w1 = Math.max(w1, minW * w1 / w); w = minW; }
    var st = w * 1.3; st = st < 0.03 ? 0.03 : st > 0.075 ? 0.075 : st;
    var L = resample(st / z, raw), n = rn; if (n < 2 || L < 1e-4) return;
    if (z !== 1) { for (var q = 0; q < n; q++) { RS[q * 2] *= z; RS[q * 2 + 1] *= z; RL[q] *= z; } L *= z; }
    var vis = L, rev = I.Reveal;
    if (rev >= 0) { if (I.used >= rev) { I.used += L; return; } vis = Math.min(L, rev - I.used); I.used += L; } else I.used += 0;
    var Wob = I.Wob, a1 = 0.011 * wob * Wob * z, a2 = 0.0038 * wob * Wob * z, tl = Math.min(L * 0.4, Math.max(0.05 * z, w * 3));
    var boil = (Math.imul(seed | 0, 31) + Math.imul(I.Boil | 0, 7919) + 5) | 0, s37 = seed * 0.37;
    vgrow(n * 2); var b0 = nv, m = 0, cr = col.r, cg = col.g, cb = col.b, ca = col.a, minww = 0.2 / Px;
    for (var i = 0; i < n; i++) {
      var s = RL[i]; if (s > vis + 0.001) break;
      var sn = s / z, j1 = i + 1 < n ? i + 1 : n - 1, j0 = i > 0 ? i - 1 : 0;
      var dx = RS[j1 * 2] - RS[j0 * 2], dy = RS[j1 * 2 + 1] - RS[j0 * 2 + 1], dm = Math.sqrt(dx * dx + dy * dy);
      if (dm > 1e-5) { dx /= dm; dy /= dm; } else { dx = 0; dy = 0; }
      var nx = -dy, ny = dx;
      var off = N(sn * 2.6 + s37, seed) * a1 + N(sn * 4.3, boil) * a2, tg = N(sn * 2.2 + 40, seed + 977) * a1 * 0.6;
      var px = RS[i * 2] + nx * off + dx * tg, py = RS[i * 2 + 1] + ny * off + dy * tg;
      var e = Math.min(s, vis - s), tp = e >= tl ? 1 : (1 - taper) + taper * clamp01(Math.sin(e / tl * 1.5708));
      var ww = (w1 > 0 ? w + (w1 - w) * clamp01(s / L) : w) * (0.86 + 0.14 * N(sn * 1.9, seed + 211)) * tp * 0.5;
      var a = alpha(ca, af * (0.88 + 0.12 * N(sn * 1.3, seed + 53)));
      if (ww < minww) ww = minww; var ev = 1 + pad / ww, h = ww + pad;
      V(px + nx * h, py + ny * h, cr, cg, cb, a, ev, s, vis, grain, 0, 0, 0, 0);
      V(px - nx * h, py - ny * h, cr, cg, cb, a, -ev, s, vis, grain, 0, 0, 0, 0);
      m++;
    }
    tgrow(m * 6);
    for (var k = 0; k < m - 1; k++) { var v = b0 + k * 2; tri(v, v + 1, v + 2); tri(v + 1, v + 3, v + 2); }
  }

  I.Stroke = function (pts, w, col, seed, wob, taper, grain, w1) {
    if (I.Clean) return orig.Stroke.apply(this, arguments);   /* 3B demo: yuvarlak uçlu düz çizgi (oyunda kullanılmıyor) */
    if (pts._size < 2) return;
    srcFromList(pts);
    strokeCore(w, col, seed, wob === void 0 ? 1 : wob, taper === void 0 ? 0.55 : taper, grain === void 0 ? 0.5 : grain, w1 === void 0 ? -1 : w1, false);
  };
  I.Line = function (a, b, w, col, seed, wob, taper, grain) {
    if (I.Clean) { var l = I.sc; l.clear(); l.add(a.$clone()); l.add(b.$clone()); return orig.Stroke.call(I, l, w, col, seed, wob === void 0 ? 1 : wob, taper === void 0 ? 0.55 : taper, grain === void 0 ? 0.5 : grain); }
    SX[0] = a.x; SX[1] = a.y; SX[2] = b.x; SX[3] = b.y; SN = 2;
    strokeCore(w, col, seed, wob === void 0 ? 1 : wob, taper === void 0 ? 0.55 : taper, grain === void 0 ? 0.5 : grain, -1, false);
  };

  // kapalı çokgen dolgusu (Ink.Fill): kulak kesme
  var EAR = new Int32Array(256);
  I.Fill = function (poly, col, seed, hatch, ang, wob, freq) {
    if (hatch === void 0) hatch = 0.4; if (ang === void 0) ang = 0.9; if (wob === void 0) wob = 1; if (freq === void 0) freq = 1;
    var n = poly._size; if (n < 3) return;
    if (I.Clean) { hatch = 0; wob = 0; }
    if (I.Reveal >= 0 && I.used >= I.Reveal) return;
    var it = poly._items, b0 = nv, Wob = I.Wob, a1 = 0.007 * wob * Wob, a2 = 0.0025 * wob * Wob, z = I.Zoom;
    var a = alpha(col.a, 1), dc = Math.cos(ang), ds = Math.sin(ang), df = freq / z;
    var boilA = Math.imul(seed | 0, 31) + Math.imul(I.Boil | 0, 7919) | 0, boilB = Math.imul(seed | 0, 17) + Math.imul(I.Boil | 0, 4099) | 0;
    vgrow(n);
    for (var i = 0; i < n; i++) {
      X(it[i].x, it[i].y); var x = tx, y = ty;
      x += N(i * 1.7, seed) * a1 + N(i * 1.3, boilA) * a2; y += N(i * 1.7 + 50, seed + 3) * a1 + N(i * 1.3 + 9, boilB) * a2;
      V(x * z, y * z, col.r, col.g, col.b, a, 0, 0, 0, hatch, dc, ds, df, 1);
    }
    var area = 0, i2;
    for (i2 = 0; i2 < n; i2++) { var p = b0 + i2, q = b0 + (i2 + 1) % n; area += P[p * 2] * P[q * 2 + 1] - P[q * 2] * P[p * 2 + 1]; }
    if (EAR.length < n) EAR = new Int32Array(n * 2);
    var m = n; if (area >= 0) for (i2 = 0; i2 < n; i2++) EAR[i2] = i2; else for (i2 = 0; i2 < n; i2++) EAR[i2] = n - 1 - i2;
    tgrow(n * 3); var guard = 0;
    while (m > 3 && guard++ < 400) {
      var cut = false;
      for (var e = 0; e < m; e++) {
        var ia = EAR[(e + m - 1) % m], ib = EAR[e], ic = EAR[(e + 1) % m];
        var ax = P[(b0 + ia) * 2], ay = P[(b0 + ia) * 2 + 1], bx = P[(b0 + ib) * 2], by = P[(b0 + ib) * 2 + 1], cx = P[(b0 + ic) * 2], cy = P[(b0 + ic) * 2 + 1];
        if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) <= 1e-9) continue;
        var inside = false;
        for (var j = 0; j < m && !inside; j++) {
          var id = EAR[j]; if (id === ia || id === ib || id === ic) continue;
          var qx = P[(b0 + id) * 2], qy = P[(b0 + id) * 2 + 1];
          var d1 = (qx - bx) * (ay - by) - (ax - bx) * (qy - by), d2 = (qx - cx) * (by - cy) - (bx - cx) * (qy - cy), d3 = (qx - ax) * (cy - ay) - (cx - ax) * (qy - ay);
          inside = !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
        }
        if (inside) continue;
        tri(b0 + ia, b0 + ib, b0 + ic); for (var r = e; r < m - 1; r++) EAR[r] = EAR[r + 1]; m--; cut = true; break;
      }
      if (!cut) break;
    }
    for (i2 = 1; i2 + 1 < m; i2++) tri(b0 + EAR[0], b0 + EAR[i2], b0 + EAR[i2 + 1]);
  };

  // içi dolu şerit (kol, bacak) ve iki kenar çizgisi (Ink.Tube)
  var EA = new Float32Array(1024), EB = new Float32Array(1024);
  I.Tube = function (pts, w0, w1, fill, line, lw, seed, edges) {
    if (edges === void 0) edges = true;
    if (I.Clean) return orig.Tube.apply(this, arguments);
    if (pts._size < 2) return;
    srcFromList(pts); strokeCore(w0, fill, seed, 0.25, 0, 0.12, w1, false);
    if (!edges) return;
    srcFromList(pts); var L = resample(0.05, false), n = rn; if (n < 2) return;
    if (EA.length < n * 2) { EA = new Float32Array(n * 4); EB = new Float32Array(n * 4); }
    for (var i = 0; i < n; i++) {
      var j1 = i + 1 < n ? i + 1 : n - 1, j0 = i > 0 ? i - 1 : 0, dx = RS[j1 * 2] - RS[j0 * 2], dy = RS[j1 * 2 + 1] - RS[j0 * 2 + 1], dm = Math.sqrt(dx * dx + dy * dy);
      if (dm > 1e-5) { dx /= dm; dy /= dm; } else { dx = 0; dy = 0; }
      var hw = (w0 + (w1 - w0) * clamp01(RL[i] / L)) * 0.5, nx = -dy * hw, ny = dx * hw;
      EA[i * 2] = RS[i * 2] + nx; EA[i * 2 + 1] = RS[i * 2 + 1] + ny; EB[i * 2] = RS[i * 2] - nx; EB[i * 2 + 1] = RS[i * 2 + 1] - ny;
    }
    if (SX.length < n * 2) SX = new Float32Array(n * 4);
    SX.set(EA.subarray(0, n * 2)); SN = n; strokeCore(lw, line, seed + 1, 0.7, 0.3, 0.5, -1, true);
    SX.set(EB.subarray(0, n * 2)); SN = n; strokeCore(lw, line, seed + 2, 0.7, 0.3, 0.5, -1, true);
  };

  // küçük dolu daire (yuvarlak uç)
  function dot(x, y, r, c) { var N2 = 12, b0 = nv; vgrow(N2 + 1); tgrow(N2 * 3); V(x, y, c.r, c.g, c.b, c.a, 0, 0, 0, 0, 1, 0, 1, 1); for (var i = 0; i < N2; i++) { var a = i * 6.2832 / N2; V(x + Math.cos(a) * r, y + Math.sin(a) * r, c.r, c.g, c.b, c.a, 0, 0, 0, 0, 1, 0, 1, 1); } for (var k = 0; k < N2; k++) tri(b0, b0 + 1 + k, b0 + 1 + (k + 1) % N2); }
  I.Dot = function (p, r, c) { dot(p.x, p.y, r, c); };

  // karanlık: aydınlık delik bırakan örtü (Ink.Shade)
  I.Shade = function (c, r, soft, col) {
    var N3 = 28, b0 = nv, z = I.Zoom, cx = c.x * z, cy = c.y * z; r *= z; soft *= z; vgrow((N3 + 1) * 3); tgrow(N3 * 12);
    for (var i = 0; i <= N3; i++) {
      var a = i * 6.2832 / N3, ux = Math.cos(a), uy = Math.sin(a);
      V(cx + ux * r, cy + uy * r, col.r, col.g, col.b, 0, 0, 0, 0, 0, 1, 0, 1, 1);
      V(cx + ux * (r + soft), cy + uy * (r + soft), col.r, col.g, col.b, col.a, 0, 0, 0, 0, 1, 0, 1, 1);
      V(cx + ux * 40, cy + uy * 40, col.r, col.g, col.b, col.a, 0, 0, 0, 0, 1, 0, 1, 1);
    }
    for (var k = 0; k < N3; k++) { var v = b0 + k * 3; tri(v, v + 1, v + 3); tri(v + 1, v + 4, v + 3); tri(v + 1, v + 2, v + 4); tri(v + 2, v + 5, v + 4); }
  };

  I.Begin = function () { nv = 0; nt = 0; I.used = 0; I.xf = false; I.Alpha = 1; I.Master = 1; I.Off = UnityEngine.Vector2.zero; I.Zoom = 1; };
  I.End = function (m) { KH.meshT(m.id, P, C, U0, U1, T, nv, nt); };

  // değişmeyen çizimi saklama (arka plandaki mahalle)
  I.Mark = function (v0, t0) { v0.v = nv; t0.v = nt; };
  I.Save = function (v0, t0) {
    var n = nv - v0, m = nt - t0, o = I.Off;
    var c = { v: P.slice(v0 * 2, nv * 2), c: C.slice(v0 * 4, nv * 4), a: U0.slice(v0 * 4, nv * 4), b: U1.slice(v0 * 4, nv * 4), t: new Uint32Array(m), z: I.Zoom, px: I.Px, ox: o.x, oy: o.y };
    for (var i = 0; i < m; i++) c.t[i] = T[t0 + i] - v0;
    return c;
  };
  I.Draw = function (c) {
    if (c == null || c.px !== I.Px) return false;
    var k = I.Zoom / c.z; if (k < 0.5 || k > 2) return false;
    var o = I.Off, dx = (o.x - c.ox) * I.Zoom, dy = (o.y - c.oy) * I.Zoom, n = c.v.length / 2, m = c.t.length, b0 = nv;
    vgrow(n); tgrow(m);
    for (var i = 0; i < n; i++) { P[(b0 + i) * 2] = c.v[i * 2] * k + dx; P[(b0 + i) * 2 + 1] = c.v[i * 2 + 1] * k + dy; }
    C.set(c.c, b0 * 4); U0.set(c.a, b0 * 4); U1.set(c.b, b0 * 4); nv += n;
    for (var j = 0; j < m; j++) T[nt + j] = b0 + c.t[j]; nt += m;
    return true;
  };
  try { Object.defineProperty(I, 'Verts', { get: function () { return nv; }, configurable: true }); } catch (e) {}
};
