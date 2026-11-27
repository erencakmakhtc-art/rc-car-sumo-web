// Keep the Ball Up — HTML5 ana bilgisayarı: H5'in derlediği oyun kodunu (game.js) tarayıcıya bağlar.
// çizim WebGL2 (Unity'deki Ink ve Paper shader'larının aynısı), giriş, Web Audio, kayıt, ağ, CrazyGames köprüsü (portal.js)
(function () {
  'use strict';
  var cv = document.getElementById('kk-canvas');
  var gl = cv.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  var KH = window.KH = {};
  KH.files = window.KK_FILES || {};
  var t0 = performance.now();
  KH.now = function () { return performance.now() - t0; };
  KH.log = function (s) { if (window.KK_DEBUG) console.log(s); };

  // ---------- ekran ----------
  var W = 1, H = 1;
  function fit() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var r = cv.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  }
  window.addEventListener('resize', fit); fit();
  KH.width = function () { return W; }; KH.height = function () { return H; };
  KH.url = function () { return location.href; };
  KH.lang = function () { return (navigator.language || 'en').toLowerCase(); };
  KH.mobile = function () { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || '')); };

  // ---------- giriş ----------
  var CODE = { Backspace: 8, Enter: 13, NumpadEnter: 13, Escape: 27, Space: 32, ArrowUp: 273, ArrowDown: 274, ArrowRight: 275, ArrowLeft: 276, ShiftLeft: 304, ShiftRight: 303 };
  for (var d = 0; d <= 9; d++) { CODE['Digit' + d] = 48 + d; CODE['Numpad' + d] = 256 + d; }
  for (var c = 0; c < 26; c++) CODE['Key' + String.fromCharCode(65 + c)] = 97 + c;
  var down = {}, pressed = {};
  window.addEventListener('keydown', function (e) { var k = CODE[e.code]; if (k) { if (!down[k] && !e.repeat) pressed[k] = 1; down[k] = 1; } if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault(); }, { passive: false });
  window.addEventListener('keyup', function (e) { var k = CODE[e.code]; if (k) down[k] = 0; if (e.key === 'Meta') down = {}; });
  window.addEventListener('blur', function () { down = {}; });
  KH.key = function (k) { return !!down[k]; };
  KH.keyDown = function (k) { return !!pressed[k]; };

  var mx = 0, my = 0, mb = {}, mbDown = {};
  function setMouse(e) { var r = cv.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width * W; my = (1 - (e.clientY - r.top) / r.height) * H; }
  cv.addEventListener('mousedown', function (e) { setMouse(e); if (!mb[e.button]) mbDown[e.button] = 1; mb[e.button] = 1; unlockAudio(); });
  window.addEventListener('mouseup', function (e) { setMouse(e); mb[e.button] = 0; });
  window.addEventListener('mousemove', setMouse);
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  KH.mouse = function (b) { return !!mb[b]; };
  KH.mouseDown = function (b) { return !!mbDown[b]; };
  KH.mouseX = function () { return mx; }; KH.mouseY = function () { return my; };

  // dokunuşlar: Unity gibi her parmağın bir evresi var (0 başladı, 1 kıpırdadı, 2 duruyor, 3 bitti, 4 iptal); biten parmak bir kare daha listede kalır
  var touches = [], tmap = {}, mouseFinger = -1;
  function tpos(t) { var r = cv.getBoundingClientRect(); return [(t.clientX - r.left) / r.width * W, (1 - (t.clientY - r.top) / r.height) * H]; }
  function onTouch(e, phase) {
    e.preventDefault(); unlockAudio();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], p = tpos(t), o = tmap[t.identifier];
      // Unity gibi: ilk parmak fareyi de taklit eder (menü düğmeleri GetMouseButtonDown ile okur)
      if (phase === 0 && mouseFinger === -1) { mouseFinger = t.identifier; mx = p[0]; my = p[1]; mbDown[0] = 1; mb[0] = 1; }
      else if (t.identifier === mouseFinger) { mx = p[0]; my = p[1]; if (phase >= 3) { mb[0] = 0; mouseFinger = -1; } }
      if (phase === 0) { o = { id: t.identifier, x: p[0], y: p[1], ph: 0, fresh: 1 }; tmap[t.identifier] = o; touches.push(o); }
      else if (o) { o.x = p[0]; o.y = p[1]; if (phase === 1) { if (!o.fresh) o.ph = 1; } else if (o.fresh) o.pend = phase; else { o.ph = phase; o.end = 1; } }   /* kareyi görmeden biten hızlı dokunuş: bu kare "başladı", sonraki kare "bitti" */
    }
  }
  cv.addEventListener('touchstart', function (e) { onTouch(e, 0); }, { passive: false });
  cv.addEventListener('touchmove', function (e) { onTouch(e, 1); }, { passive: false });
  cv.addEventListener('touchend', function (e) { onTouch(e, 3); }, { passive: false });
  cv.addEventListener('touchcancel', function (e) { onTouch(e, 4); }, { passive: false });
  KH.touchCount = function () { return touches.length; };
  KH.touchId = function (i) { return touches[i] ? touches[i].id : 0; };
  KH.touchX = function (i) { return touches[i] ? touches[i].x : 0; };
  KH.touchY = function (i) { return touches[i] ? touches[i].y : 0; };
  KH.touchPhase = function (i) { return touches[i] ? touches[i].ph : 3; };
  function inputEndFrame() {
    pressed = {}; mbDown = {};
    for (var i = touches.length - 1; i >= 0; i--) { var o = touches[i]; if (o.end) { touches.splice(i, 1); delete tmap[o.id]; } else if (o.pend) { o.ph = o.pend; o.pend = 0; o.end = 1; o.fresh = 0; } else { if (o.ph === 0) o.ph = 2; else if (o.ph === 1) o.ph = 2; o.fresh = 0; } }
  }

  // ---------- kayıt ----------
  KH.prefGet = function (k) { try { var v = localStorage.getItem('kk_h5_' + k); return v === null ? null : v; } catch (e) { return null; } };
  KH.prefSet = function (k, v) { try { if (v === null || v === undefined) localStorage.removeItem('kk_h5_' + k); else localStorage.setItem('kk_h5_' + k, '' + v); } catch (e) {} };
  KH.prefClear = function () { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('kk_h5_') === 0) localStorage.removeItem(k); }); } catch (e) {} };

  // ---------- ağ ----------
  var reqs = [];
  KH.http = function (method, url, body, ctype, auth, timeout) {
    var id = reqs.length, r = { done: 0, code: 0, text: '' }; reqs.push(r);
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, h = {};
    if (ctype) h['Content-Type'] = ctype; if (auth) h['Authorization'] = auth;
    if (ctl && timeout > 0) setTimeout(function () { ctl.abort(); }, timeout * 1000);
    fetch(url, { method: method, headers: h, body: method === 'GET' ? undefined : body, signal: ctl ? ctl.signal : undefined })
      .then(function (res) { r.code = res.status; return res.text(); }).then(function (t) { r.text = t; r.done = 1; })
      .catch(function () { r.done = -1; });
    return id;
  };
  KH.httpDone = function (id) { return reqs[id] ? reqs[id].done : -1; };
  KH.httpCode = function (id) { return reqs[id] ? reqs[id].code : 0; };
  KH.httpText = function (id) { var r = reqs[id]; return r ? r.text : ''; };

  // ---------- ses (Web Audio) ----------
  var AC = window.AudioContext || window.webkitAudioContext, ac = AC ? new AC() : null, master = null;
  if (ac) { master = ac.createGain(); master.connect(ac.destination); }
  function unlockAudio() { if (ac && ac.state === 'suspended') ac.resume(); }
  window.addEventListener('keydown', unlockAudio); window.addEventListener('pointerdown', unlockAudio);
  var clips = [null], srcs = [];
  KH.clip = function (name, samples, n, ch, freq) {
    var c = { buf: null, state: 2, len: n, sec: n / freq, data: samples };
    if (ac && n > 0) { var b = ac.createBuffer(1, n, freq), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = samples[i] || 0; c.buf = b; }
    clips.push(c); return clips.length - 1;
  };
  // dosya sesleri: KK_AUDIO içine gömülü base64 OGG/MP3 ya da dosya yolu. çözülene kadar "yükleniyor"
  KH.clipFile = function (path) {
    var c = { buf: null, state: 1, len: 0, sec: 0, data: null }; clips.push(c); var id = clips.length - 1;
    // ses düzeyi eşitleme (Sfx.LoadFiles RMS'i hemen ister, çözme ise sonradan biter): pack.py her dosyanın RMS'ini önceden yazar; tek örnekli veri o RMS'i verir
    var rms = window.KK_RMS && window.KK_RMS[path]; if (rms) { c.len = 1; c.data = [rms]; c.fixed = 1; }
    var src = (window.KK_AUDIO && window.KK_AUDIO[path]) || ('audio/' + path + '.m4a');
    if (!ac) { c.state = 3; return id; }
    fetch(src).then(function (r) { return r.arrayBuffer(); }).then(function (a) { return new Promise(function (ok, no) { ac.decodeAudioData(a, ok, no); }); })
      .then(function (b) { c.buf = b; c.sec = b.duration; c.state = 2; if (!c.fixed) { c.len = b.length; c.data = b.getChannelData(0); } }).catch(function () { c.state = 3; });
    return id;
  };
  KH.clipLen = function (id) { return clips[id] ? clips[id].len : 0; };
  KH.clipSec = function (id) { return clips[id] ? clips[id].sec : 0; };
  KH.clipState = function (id) { return clips[id] ? clips[id].state : 3; };
  KH.clipData = function (id) { var c = clips[id]; return c && c.data ? Array.prototype.slice.call(c.data) : null; };
  KH.src = function () { srcs.push({ node: null, gain: null, pan: null, playing: false, clip: 0, startAt: 0, offset: 0, loop: false }); return srcs.length - 1; };
  function stopNode(s) { if (s.node) { try { s.node.onended = null; s.node.stop(); } catch (e) {} s.node = null; } s.playing = false; }
  KH.srcPlay = function (si, ci, vol, pitch, pan, loop) {
    var s = srcs[si], c = clips[ci]; if (!s || !ac) return; stopNode(s);
    if (!c || !c.buf) { s.clip = ci; s.loop = loop; s.wantPlay = true; s.vol = vol; s.pitch = pitch; s.panv = pan; return; }
    var n = ac.createBufferSource(); n.buffer = c.buf; n.loop = !!loop; n.playbackRate.value = pitch;
    var g = ac.createGain(); g.gain.value = vol; var p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = pan; n.connect(g); g.connect(p); p.connect(master); } else { n.connect(g); g.connect(master); }
    n.onended = function () { if (s.node === n) s.playing = false; };
    var off = loop && s.clip === ci && s.paused ? s.offset % c.buf.duration : 0;
    n.start(0, off); s.node = n; s.gain = g; s.pan = p; s.playing = true; s.clip = ci; s.loop = loop; s.startAt = ac.currentTime - off / Math.max(0.01, pitch); s.paused = false; s.wantPlay = false;
  };
  KH.srcSet = function (si, vol, pitch, pan) { var s = srcs[si]; if (!s) return; s.vol = vol; s.pitch = pitch; s.panv = pan; if (s.gain) s.gain.gain.value = vol; if (s.node) s.node.playbackRate.value = pitch; if (s.pan) s.pan.pan.value = pan; };
  KH.srcPause = function (si) { var s = srcs[si]; if (!s || !ac) return; if (s.node) s.offset = (ac.currentTime - s.startAt) * (s.pitch || 1); s.paused = true; stopNode(s); };
  KH.srcStop = function (si) { var s = srcs[si]; if (s) { s.paused = false; s.offset = 0; stopNode(s); } };
  KH.srcPlaying = function (si) { var s = srcs[si]; if (!s) return false; if (s.wantPlay) { var c = clips[s.clip]; if (c && c.buf) KH.srcPlay(si, s.clip, s.vol, s.pitch, s.panv, s.loop); } return s.playing || !!s.wantPlay; };
  document.addEventListener('visibilitychange', function () { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

  // ---------- çizim (WebGL2) ----------
  var VS_INK = '#version 300 es\nprecision highp float;\nin vec2 aP; in vec4 aC; in vec4 aU0; in vec4 aU1;\nuniform vec4 uCam; uniform vec2 uRot;\nout vec4 vC; out vec4 vU0; out vec4 vU1; out vec2 vW;\nvoid main(){ vec2 d=aP-uCam.xy; vec2 r=vec2(d.x*uRot.x+d.y*uRot.y, -d.x*uRot.y+d.y*uRot.x); gl_Position=vec4(r.x/uCam.z, r.y/uCam.w, 0.0, 1.0); vC=aC; vU0=aU0; vU1=aU1; vW=aP; }';
  var FS_INK = '#version 300 es\nprecision highp float;\nin vec4 vC; in vec4 vU0; in vec4 vU1; in vec2 vW;\nuniform sampler2D uGrain; uniform float uGS; uniform float uRough;\nout vec4 o;\n' +
    'void main(){ vec4 c=vC; float g=texture(uGrain, vW*uGS).r;\n' +
    ' if(vU1.w<0.5){ float av=abs(vU0.x), fw=max(fwidth(vU0.x),0.0001); float e=clamp((1.0-av)/fw+0.5,0.0,1.0); float wpx=2.0/fw; float du=max(fwidth(vU0.y)*1.5,0.0001);\n' +
    '  float ends=clamp(min(vU0.y, vU0.z-vU0.y)/du,0.0,1.0); float amt=vU0.w*clamp((wpx-1.5)/4.5,0.0,1.0); float body=mix(1.0, smoothstep(0.24,0.58, g+(1.0-clamp(av,0.0,1.0))*0.45-uRough), amt); c.a*=e*ends*body; }\n' +
    ' else { vec2 d=vU1.xy; vec2 q=vec2(dot(vW,d), dot(vW, vec2(-d.y,d.x))); float h=texture(uGrain, q*vec2(0.07,1.1)*vU1.z*uGS).r; c.a*=mix(1.0, smoothstep(0.2,0.72, h*0.8+g*0.3-uRough*0.5), vU0.w); }\n' +
    ' o=c; }';
  var VS_PAPER = '#version 300 es\nprecision highp float;\nin vec2 aP; in vec4 aU0;\nuniform vec4 uCam; uniform vec2 uRot;\nout vec2 vW; out vec2 vUV;\nvoid main(){ vec2 d=aP-uCam.xy; vec2 r=vec2(d.x*uRot.x+d.y*uRot.y, -d.x*uRot.y+d.y*uRot.x); gl_Position=vec4(r.x/uCam.z, r.y/uCam.w, 0.0, 1.0); vW=aP; vUV=aU0.xy; }';
  var FS_PAPER = '#version 300 es\nprecision highp float;\nin vec2 vW; in vec2 vUV;\nuniform sampler2D uGrain; uniform float uGS; uniform vec4 uPaper, uRule, uMargin, uDesk, uPage, uTone;\nout vec4 o;\n' +
    'float lineAt(float x, float gap, float w){ float f=abs(fract(x/gap+0.5)-0.5)*gap, aa=fwidth(x)*1.2; return 1.0-smoothstep(w, w+aa, f); }\n' +
    'void main(){ float g=texture(uGrain, vW*uGS).r, b=texture(uGrain, vW*0.071+0.37).r, b2=texture(uGrain, vW.yx*0.023+0.11).r;\n' +
    ' vec3 c=uPaper.rgb*(1.0+(g-0.5)*uTone.x+(b-0.5)*uTone.y+(b2-0.5)*uTone.y*0.8); float px=fwidth(vW.y);\n' +
    ' if(uPage.w>0.5){ float l=lineAt(vW.y-0.02, uPage.y, px*0.9)*(0.75+0.5*g); if(uPage.w>1.5) l=max(l, lineAt(vW.x, uPage.y, px*0.9)*(0.75+0.5*g)); c=mix(c, uRule.rgb, clamp(l,0.0,1.0)*uRule.a); float m=1.0-smoothstep(px*1.1, px*2.3, abs(vW.x-uPage.z)); c=mix(c, uMargin.rgb, m*uMargin.a*(0.7+0.6*g)); }\n' +
    ' float out_=abs(vW.x)-uPage.x; vec3 desk=uDesk.rgb*(0.9+0.2*texture(uGrain, vW*vec2(0.02,0.33)).r); desk*=0.55+0.45*smoothstep(0.0,0.2,out_); c*=1.0-0.1*smoothstep(-0.09,0.0,out_); c=mix(c, desk, smoothstep(0.0, px*1.5, out_));\n' +
    ' vec2 q=vUV-0.5; c*=1.0-uTone.z*smoothstep(0.35,0.95, length(q)*1.25); o=vec4(c,1.0); }';

  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aC'); gl.bindAttribLocation(p, 2, 'aU0'); gl.bindAttribLocation(p, 3, 'aU1'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p)); var u = {}; var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (var i = 0; i < n; i++) { var a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p: p, u: u }; }
  var P_INK = prog(VS_INK, FS_INK), P_PAPER = prog(VS_PAPER, FS_PAPER);

  var meshes = {}, mats = {}, texs = {}, binds = [];
  function M(id) { var m = meshes[id]; if (!m) { m = meshes[id] = { vao: gl.createVertexArray(), bp: gl.createBuffer(), bc: gl.createBuffer(), b0: gl.createBuffer(), b1: gl.createBuffer(), bi: gl.createBuffer(), nt: 0 }; gl.bindVertexArray(m.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.bp); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.bc); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.b0); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.b1); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.bi); gl.bindVertexArray(null); } return m; }
  // H5'in dizileri sıradan JS dizileri: yazmadan önce tipli diziye kopyalanır (yeniden ayrılmasın diye büyüyen tamponlar)
  var tf = { p: new Float32Array(1 << 16), c: new Uint8Array(1 << 17), a: new Float32Array(1 << 17), b: new Float32Array(1 << 17), i: new Uint32Array(1 << 17) };
  function grow(name, n, T) { if (tf[name].length < n) { var s = tf[name].length; while (s < n) s *= 2; tf[name] = new T(s); } return tf[name]; }
  KH.mesh = function (id, v, col, u0, u1, tri, nv, nt) {
    var m = M(id);
    var fp = grow('p', nv * 2, Float32Array), fc = grow('c', nv * 4, Uint8Array), fa = grow('a', nv * 4, Float32Array), fb = grow('b', nv * 4, Float32Array), fi = grow('i', nt, Uint32Array), i;
    for (i = 0; i < nv * 2; i++) fp[i] = v[i];
    for (i = 0; i < nv * 4; i++) { fc[i] = col[i]; fa[i] = u0[i]; fb[i] = u1[i]; }
    for (i = 0; i < nt; i++) fi[i] = tri[i];
    gl.bindVertexArray(m.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.bp); gl.bufferData(gl.ARRAY_BUFFER, fp.subarray(0, nv * 2), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.bc); gl.bufferData(gl.ARRAY_BUFFER, fc.subarray(0, nv * 4), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.b0); gl.bufferData(gl.ARRAY_BUFFER, fa.subarray(0, nv * 4), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.b1); gl.bufferData(gl.ARRAY_BUFFER, fb.subarray(0, nv * 4), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.bi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, fi.subarray(0, nt), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null); m.nt = nt;
  };
  // Ink'in tipli dizileri doğrudan (kopyasız) yüklenir
  KH.meshT = function (id, P, C, U0, U1, T, nv, nt) {
    var m = M(id); gl.bindVertexArray(m.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.bp); gl.bufferData(gl.ARRAY_BUFFER, P.subarray(0, nv * 2), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.bc); gl.bufferData(gl.ARRAY_BUFFER, C.subarray(0, nv * 4), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.b0); gl.bufferData(gl.ARRAY_BUFFER, U0.subarray(0, nv * 4), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.b1); gl.bufferData(gl.ARRAY_BUFFER, U1.subarray(0, nv * 4), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.bi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, T.subarray(0, nt), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null); m.nt = nt;
  };
  function MAT(id) { return mats[id] || (mats[id] = { f: {}, v: {}, t: {} }); }
  KH.matF = function (id, n, v) { MAT(id).f[n] = v; };
  KH.matV = function (id, n, x, y, z, w) { MAT(id).v[n] = [x, y, z, w]; };
  KH.matTex = function (id, n, t) { MAT(id).t[n] = t; };
  KH.tex = function (id, w, h, rgba) {
    var t = texs[id] || (texs[id] = gl.createTexture()); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  };
  var camv = [0, 0, 5, 0, 0, 0, 0];
  KH.cam = function (x, y, size, rot, r, g, b) { camv = [x, y, size, rot, r, g, b]; };
  KH.bind = function (mesh, mat, shader, z) { binds.push({ mesh: mesh, mat: mat, paper: /Paper/.test(shader), z: z }); binds.sort(function (a, b) { return b.z - a.z; }); };

  function draw() {
    gl.viewport(0, 0, W, H); gl.clearColor(camv[4], camv[5], camv[6], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    var hh = camv[2], hw = hh * W / H, a = camv[3] * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (var i = 0; i < binds.length; i++) {
      var bd = binds[i], m = meshes[bd.mesh], mt = mats[bd.mat]; if (!m || !m.nt || !mt) continue;
      var P = bd.paper ? P_PAPER : P_INK; gl.useProgram(P.p);
      gl.uniform4f(P.u.uCam, camv[0], camv[1], hw, hh); gl.uniform2f(P.u.uRot, ca, sa);
      var gt = mt.t._Grain; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gt ? texs[gt] : null); gl.uniform1i(P.u.uGrain, 0);
      gl.uniform1f(P.u.uGS, mt.f._GrainScale || 1);
      if (bd.paper) { gl.disable(gl.BLEND); ['Paper', 'Rule', 'Margin', 'Desk', 'Page', 'Tone'].forEach(function (k) { var v = mt.v['_' + k] || [0, 0, 0, 0]; gl.uniform4f(P.u['u' + k], v[0], v[1], v[2], v[3]); }); }
      else { gl.uniform1f(P.u.uRough, mt.f._Rough || 0); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
      gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.nt, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
    }
  }

  // ---------- açılış ----------
  KH.start = function () {
    window.kkPortalInstall(); window.kkInstallInk();
    Kick.Game.Boot(); var g = Kick.Game.I; g.Awake();
    var loader = document.getElementById('kk-loader'); if (loader) { loader.style.opacity = 0; setTimeout(function () { loader.style.display = 'none'; }, 260); }
    function frame() {
      fit();
      try { UnityEngine.HostLoop.Pre(); g.Update(); UnityEngine.HostLoop.Post(); } catch (e) { console.error(e); }
      draw(); inputEndFrame();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
})();
