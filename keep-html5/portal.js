// CrazyGames köprüsü: Unity sürümündeki KickPortal.jslib'in aynısı (otomatik üretildi, elle düzenleme)
window.kkPortalInstall = function () {
  var F = {
  KKBoot: function () {
    var K = window.kkPortal = window.kkPortal || {};
    if (K.booted) return;
    K.booted = true; K.keys = 0; K.hit = 0; K.fresh = 0; K.rw = 0; K.down = {}; K.hidden = document.hidden ? 1 : 0; K.mute = 0; K.ad = 0; K.sdk = 0; K.ready = 0; K.mem = {};
    // tuşlar klavyedeki yerine göre okunur (e.code): AZERTY'de de aynı tuşlar
    var bits = { ArrowLeft: 1, KeyA: 1, ArrowRight: 2, KeyD: 2, ArrowUp: 4, KeyW: 4, KeyM: 8, Enter: 16, Space: 32, KeyX: 32, KeyJ: 32, KeyZ: 64, KeyK: 64, ArrowDown: 128, KeyS: 128 };
    // sol ve sağ birlikte basılı görünüyorsa son basılan geçerlidir (bırakılışı kaçmış "takılı" bir yön tuşu öbür yönü sıfırlayıp oyuncuyu olduğu yerde durdurmasın)
    function mask() { var m = 0; for (var c in K.down) if (K.down[c]) m |= bits[c]; if ((m & 3) === 3) m &= K.lastH === 1 ? ~2 : ~1; K.keys = m; }
    window.addEventListener('keydown', function (e) {
      // taze basış (tekrar olmayan keydown) ayrıca işaretlenir: oyun basışı tuşun düzeyinden değil olaydan okur.
      // (düzeyden okununca iki kare arasına sığan bırak-bas ve keyup'ı kaçmış 'takılı' tuşun ardından gelen basış görünmüyordu: şut / atış tuşu ara sıra yutuluyordu)
      if (bits[e.code]) { if (!e.repeat) { K.fresh |= bits[e.code]; if (bits[e.code] === 1 || bits[e.code] === 2) K.lastH = bits[e.code]; } K.down[e.code] = true; K.hit |= bits[e.code]; mask(); }   // iki kare arasına sığan kısa basış da kaçmasın
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();   // sayfa kaymasın
    }, { passive: false });
    window.addEventListener('keyup', function (e) { if (bits[e.code]) { K.down[e.code] = false; mask(); } if (e.key === 'Meta') { K.down = {}; K.keys = 0; } });   // macOS: Cmd basılıyken öbür tuşların keyup'ı gelmez; Cmd bırakılınca hepsi bırakılmış sayılır (tuş takılı kalmasın)
    window.addEventListener('blur', function () { K.down = {}; K.keys = 0; });
    window.addEventListener('focus', function () { K.down = {}; K.keys = 0; });
    // klavye odağı oyundan çıkmışsa (sayfanın başka yerine, tarayıcı çubuğuna tıklandı) tuşlar oyuna gelmez: oyuncu "durdu, hareket etmiyor" sanar.
    // imleç oyunun üstünde oynayınca ya da oyuna tıklanınca odak geri alınır
    function refocus() { try { if (!document.hasFocus()) window.focus(); } catch (e) {} }
    window.addEventListener('mousemove', refocus); window.addEventListener('mousedown', refocus); window.addEventListener('touchstart', refocus, { passive: true });
    document.addEventListener('visibilitychange', function () { K.hidden = document.hidden ? 1 : 0; if (document.hidden) { K.down = {}; K.keys = 0; } });
    try { var cv = (typeof Module !== 'undefined' && Module.canvas) || document.querySelector('canvas'); if (cv) cv.addEventListener('contextmenu', function (e) { e.preventDefault(); }); } catch (e) {}

    function hooks() {
      var S = window.CrazyGames.SDK;
      try { if (S.environment === 'disabled') { K.ready = 1; return; } } catch (e) {}
      K.sdk = 1;
      function mute() { try { K.mute = S.game.settings && S.game.settings.muteAudio ? 1 : 0; } catch (e) {} }
      mute();
      try { S.game.addSettingsChangeListener(mute); } catch (e) {}
      // CrazyGames kullanıcı adı (giriş yapmışsa) ve "doğrudan çok oyunculu" açılış
      function setUser(u) { K.user = (u && u.username) ? ('' + u.username) : ''; }
      try { S.user.getUser().then(setUser).catch(function () {}); } catch (e) {}
      try { S.user.addAuthListener(setUser); } catch (e) {}
      try { K.instant = S.game.isInstantMultiplayer ? 1 : 0; } catch (e) {}
      K.ready = 1;
    }
    function init() {
      try {
        var p = window.kkCrazyInit || (window.kkCrazyInit = window.CrazyGames.SDK.init());
        p.then(hooks).catch(function () { try { if (window.CrazyGames.SDK.game) hooks(); else K.ready = 1; } catch (e) { K.ready = 1; } });
      } catch (e) { K.ready = 1; }
    }
    var crazy = false;
    try {
      var h = (location.hostname || '') + ' ' + (document.referrer || '');
      if (location.ancestorOrigins) for (var i = 0; i < location.ancestorOrigins.length; i++) h += ' ' + location.ancestorOrigins[i];
      crazy = /crazygames|1001juegos/i.test(h) || /[?&]useLocalSdk=true/.test(location.search || '');
    } catch (e) {}
    if (window.CrazyGames && window.CrazyGames.SDK) init();
    else if (crazy) {
      try {
        var s = document.createElement('script'); s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
        s.onload = function () { if (window.CrazyGames && window.CrazyGames.SDK) init(); else K.ready = 1; };
        s.onerror = function () { K.ready = 1; };
        document.head.appendChild(s);
      } catch (e) { K.ready = 1; }
      setTimeout(function () { K.ready = 1; }, 4000);   // SDK gelmezse oyun yine açılır
    }
    else K.ready = 1;
  },
  KKUser: function () {
    var s = (window.kkPortal && window.kkPortal.user) || '';
    return s;
  },
  KKInstant: function () { return window.kkPortal ? window.kkPortal.instant | 0 : 0; },
  KKReady: function () { return window.kkPortal ? window.kkPortal.ready | 0 : 1; },
  KKSdk: function () { return window.kkPortal ? window.kkPortal.sdk | 0 : 0; },
  KKKeys: function () { var K = window.kkPortal; if (!K) return 0; var m = (K.keys | K.hit) | 0; K.hit = 0; return m; },
  KKFresh: function () { var K = window.kkPortal; if (!K) return 0; var m = K.fresh | 0; K.fresh = 0; return m; },
  KKFocus: function () { try { return document.hasFocus() ? 1 : 0; } catch (e) { return 1; } },
  KKHidden: function () { return window.kkPortal ? window.kkPortal.hidden | 0 : 0; },
  KKMute: function () { return window.kkPortal ? window.kkPortal.mute | 0 : 0; },
  KKGameplay: function (on) {
    try { var K = window.kkPortal; if (K && K.sdk) { if (on) window.CrazyGames.SDK.game.gameplayStart(); else window.CrazyGames.SDK.game.gameplayStop(); } } catch (e) {}
  },
  KKHappy: function () { try { var K = window.kkPortal; if (K && K.sdk) window.CrazyGames.SDK.game.happytime(); } catch (e) {} },
  // 1: istek gitti; bitince KKAdState 0 olur. 2: reklam oynuyor (ses kapanır)
  KKAd: function () {
    var K = window.kkPortal; if (!K || !K.sdk || K.ad) return 0;
    try {
      K.ad = 1;
      var fin = function () { K.ad = 0; };
      window.CrazyGames.SDK.ad.requestAd('midgame', { adStarted: function () { K.ad = 2; }, adFinished: fin, adError: fin });
      setTimeout(function () { if (K.ad === 1) K.ad = 0; }, 6000);   // yanıt gelmezse oyun beklemesin
      return 1;
    } catch (e) { K.ad = 0; return 0; }
  },
  KKAdState: function () { return window.kkPortal ? window.kkPortal.ad | 0 : 0; },
  // ödüllü reklam. durum (K.rw): 0 boş, 1 istendi ya da oynuyor, 2 izlendi (ödül verilir), 3 şu an reklam yok, 4 reklamlar kapalı ya da engelli
  KKReward: function () {
    var K = window.kkPortal; if (!K || !K.sdk || K.ad || K.rw === 1) return 0;
    try {
      K.rw = 1; K.ad = 1;
      window.CrazyGames.SDK.ad.requestAd('rewarded', {
        adStarted: function () { K.ad = 2; },
        adFinished: function () { K.ad = 0; K.rw = 2; },
        adError: function (e) { K.ad = 0; var c = e && e.code; K.rw = (c === 'adsDisabled' || c === 'adblock') ? 4 : 3; }
      });
      setTimeout(function () { if (K.rw === 1 && K.ad === 1) { K.ad = 0; K.rw = 3; } }, 8000);   // yanıt gelmezse oyun beklemesin
      return 1;
    } catch (e) { K.ad = 0; K.rw = 0; return 0; }
  },
  KKRewardState: function () { return window.kkPortal ? window.kkPortal.rw | 0 : 0; },
  KKRewardClear: function () { if (window.kkPortal) window.kkPortal.rw = 0; },
  // kayıt: CrazyGames'te veri modülü (hesaba bağlı), başka yerde tarayıcı deposu
  KKGetInt: function (key, def) {
    var K = window.kkPortal || { mem: {} }, k = key, v = null;
    try { if (K.sdk && window.CrazyGames.SDK.data) v = window.CrazyGames.SDK.data.getItem(k); } catch (e) { v = null; }
    if (v === null || v === undefined)
    {
      // veri modülünde yoksa tarayıcı deposuna bakılır; orada varsa veri modülüne de taşınır
      try { v = window.localStorage.getItem(k); } catch (e) { v = null; }
      try { if (v !== null && v !== undefined && K.sdk && window.CrazyGames.SDK.data) window.CrazyGames.SDK.data.setItem(k, '' + v); } catch (e) {}
    }
    if (v === null || v === undefined) { if (K.mem && (k in K.mem)) v = K.mem[k]; else return def; }
    var n = parseInt(v, 10);
    return isNaN(n) ? def : n;
  },
  KKSetInt: function (key, val) {
    var K = window.kkPortal || { mem: {} }, k = key;
    if (K.mem) K.mem[k] = '' + val;
    try { if (K.sdk && window.CrazyGames.SDK.data) window.CrazyGames.SDK.data.setItem(k, '' + val); } catch (e) {}
    try { window.localStorage.setItem(k, '' + val); } catch (e) {}
  },
  // metin kaydı (skor tablosu kimliği): veri modülü, yoksa tarayıcı deposu
  KKGetStr: function (key) {
    var K = window.kkPortal || {}, k = key, v = null;
    try { if (K.sdk && window.CrazyGames.SDK.data) v = window.CrazyGames.SDK.data.getItem(k); } catch (e) { v = null; }
    if (v === null || v === undefined) { try { v = window.localStorage.getItem(k); } catch (e) { v = null; } }
    var s = (v === null || v === undefined) ? '' : '' + v;
    return s;
  },
  KKSetStr: function (key, val) {
    var K = window.kkPortal || {}, k = key, v = val;
    try { if (K.sdk && window.CrazyGames.SDK.data) window.CrazyGames.SDK.data.setItem(k, v); } catch (e) {}
    try { window.localStorage.setItem(k, v); } catch (e) {}
  },
  // CrazyGames cihaz türünü kendisi bildiriyor; dokunma algısına bakma diyor
  KKMobile: function () {
    try { if (/[?&]mobile=1/.test(location.search || '')) return 1; } catch (e) {}   // masaüstünde dokunmatik düzeni denemek için
    try {
      var K = window.kkPortal, s = K && K.sdk && window.CrazyGames.SDK.user && window.CrazyGames.SDK.user.systemInfo;
      if (s && s.device && s.device.type) return s.device.type === 'desktop' ? 0 : 1;
    } catch (e) {}
    try {
      var ua = navigator.userAgent || '';
      if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return 1;
      if (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || '')) return 1;
    } catch (e) {}
    return 0;
  },
  // 1: Türkçe, 0: başka (İngilizce)
  KKLang: function () {
    try {
      var K = window.kkPortal, l = '', s = K && K.sdk && window.CrazyGames.SDK.user && window.CrazyGames.SDK.user.systemInfo;
      if (s && s.locale) l = s.locale;
      if (!l) l = navigator.language || '';
      return ('' + l).toLowerCase().indexOf('tr') === 0 ? 1 : 0;
    } catch (e) { return 0; }
  }
};
  for (var k in F) Kick.Portal[k] = F[k];
};
