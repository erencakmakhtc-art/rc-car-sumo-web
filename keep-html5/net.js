// Photon köprüsü: oyunun C# tarafındaki RealtimeClient (game/Shim/Photon.cs) bunu çağırır.
// Photon'un JS kütüphanesi (vendor/photon.js) olayları istediği an verir; burada sıraya girer, C# her karede Service() içinde okur (Unity'deki gibi).
(function () {
  var P = window.Photon; if (!P || !P.LoadBalancing) { window.KPN = null; return; }
  try { P.Logger.prototype.debug = function () {}; P.Logger.prototype.info = function () {}; } catch (e) {}
  var LBC = P.LoadBalancing.LoadBalancingClient, S = LBC.State;
  var cl = [], cur = null, room = null;
  // mesaj türleri: 1 durum(a=durum), 2 odaya girildi(a=ben kurdum), 3 oyuncu geldi(a), 4 oyuncu gitti(a), 5 olay(a=kod,b=gönderen,arr,kind)
  //                6 işlem hatası(a=işlem kodu,b=hata kodu,s=ileti), 7 hata(a=kod,s), 8 oyuncu bilgisi değişti(a), 9 oda yöneticisi değişti
  function push(c, m) { c.q.push(m); }
  window.KPN = {
    make: function () {
      var c = { q: [], lbc: null, props: {}, nick: '' }; cl.push(c); return cl.length - 1;
    },
    connect: function (id, appId, ver, region, nick) {
      var c = cl[id]; if (!c) return false;
      try { if (c.lbc) { c.lbc.onStateChange = function () {}; c.lbc.disconnect(); } } catch (e) {}
      var l = new LBC(P.ConnectionProtocol.Wss, appId, ver); c.lbc = l; c.q.length = 0;
      try { l.logger.setLevel(P.LogLevel.ERROR); } catch (e) {}
      l.onStateChange = function (s) { push(c, [1, s]); };
      l.onJoinRoom = function (mine) { push(c, [2, mine ? 1 : 0]); };
      l.onActorJoin = function (a) { push(c, [3, a.actorNr]); };
      l.onActorLeave = function (a) { push(c, [4, a.actorNr]); };
      l.onActorPropertiesChange = function (a) { push(c, [8, a.actorNr]); };
      l.onMyRoomPropertiesChange = function () { push(c, [9, 0]); };
      l.onEvent = function (code, data, sender) {
        var kind = 0, arr = null;
        if (data && data.f) { kind = 1; arr = data.f; } else if (data && data.i) { kind = 2; arr = data.i; }
        push(c, [5, code, sender | 0, arr, kind]);
      };
      l.onOperationResponse = function (err, msg, code) { if (err) push(c, [6, code, err, '' + (msg || '')]); };
      l.onError = function (code, msg) { push(c, [7, code, '' + (msg || '')]); };
      c.nick = nick || ''; try { l.myActor().setName(c.nick); l.myActor().setCustomProperties(c.props); } catch (e) {}
      return !!l.connectToRegionMaster(region);
    },
    disconnect: function (id) { var c = cl[id]; if (c && c.lbc) { try { c.lbc.disconnect(); } catch (e) {} } },
    setNick: function (id, n) { var c = cl[id]; if (!c) return; c.nick = n; try { if (c.lbc) c.lbc.myActor().setName(n); } catch (e) {} },
    setProp: function (id, k, v) { var c = cl[id]; if (!c) return; c.props[k] = v; try { if (c.lbc) { var o = {}; o[k] = v; c.lbc.myActor().setCustomProperties(o); } } catch (e) {} },
    // sıradaki mesaj: tür döner (yoksa 0), alanları get ile okunur
    poll: function (id) { var c = cl[id]; cur = c && c.q.length ? c.q.shift() : null; return cur ? cur[0] : 0; },
    a: function () { return cur ? (cur[1] | 0) : 0; },
    b: function () { return cur ? (cur[2] | 0) : 0; },
    s: function () { return cur && typeof cur[3] === 'string' ? cur[3] : (cur && typeof cur[2] === 'string' ? cur[2] : ''); },
    kind: function () { return cur && cur[0] === 5 ? cur[4] : 0; },
    len: function () { return cur && cur[0] === 5 && cur[3] ? cur[3].length : 0; },
    val: function (i) { return cur && cur[3] ? +cur[3][i] || 0 : 0; },
    inRoom: function (id) { var c = cl[id]; try { return !!(c && c.lbc && c.lbc.isJoinedToRoom()); } catch (e) { return false; } },
    rtt: function (id) { var c = cl[id]; try { return c && c.lbc ? c.lbc.getRtt() | 0 : 0; } catch (e) { return 0; } },
    myNr: function (id) { var c = cl[id]; try { return c && c.lbc ? c.lbc.myActor().actorNr | 0 : 0; } catch (e) { return 0; } },
    // oda görüntüsü: room() çağrısı anlık listeyi alır, ardından ra* ile okunur
    room: function (id) {
      var c = cl[id]; room = null; if (!c || !c.lbc) return 0;
      try {
        var r = c.lbc.myRoom(), ac = c.lbc.myRoomActorsArray();
        room = { name: (r && r.name) || '', master: c.lbc.myRoomMasterActorNr() | 0, open: r ? r.isOpen !== false : true, vis: r ? r.isVisible !== false : true, max: r ? r.maxPlayers | 0 : 0, list: ac || [] };
        return room.list.length;
      } catch (e) { return 0; }
    },
    rName: function () { return room ? room.name : ''; },
    rMaster: function () { return room ? room.master : 0; },
    rMax: function () { return room ? room.max : 0; },
    raNr: function (i) { var a = room && room.list[i]; return a ? a.actorNr | 0 : 0; },
    raName: function (i) { var a = room && room.list[i]; return a ? '' + (a.name || '') : ''; },
    // tamsayı bilgi; yoksa -2147483648
    raProp: function (i, k) { var a = room && room.list[i]; if (!a) return -2147483648; var v; try { v = a.getCustomProperty(k); } catch (e) { v = undefined; } return typeof v === 'number' ? v | 0 : -2147483648; },
    setOpen: function (id, open, vis) { var c = cl[id]; try { var r = c.lbc.myRoom(); r.setIsOpen(!!open); r.setIsVisible(!!vis); } catch (e) {} },
    joinRandomOrCreate: function (id, max, open, vis) { var c = cl[id]; try { return !!c.lbc.joinRandomOrCreateRoom({}, undefined, { maxPlayers: max, isOpen: !!open, isVisible: !!vis }); } catch (e) { return false; } },
    create: function (id, name, max, open, vis) { var c = cl[id]; try { return !!c.lbc.createRoom(name, { maxPlayers: max, isOpen: !!open, isVisible: !!vis }); } catch (e) { return false; } },
    join: function (id, name) { var c = cl[id]; try { return !!c.lbc.joinRoom(name); } catch (e) { return false; } },
    joinOrCreate: function (id, name, max, open, vis) { var c = cl[id]; try { return !!c.lbc.joinRoom(name, { createIfNotExists: true }, { maxPlayers: max, isOpen: !!open, isVisible: !!vis }); } catch (e) { return false; } },
    leave: function (id) { var c = cl[id]; try { if (c.lbc.isJoinedToRoom()) { c.lbc.leaveRoom(); return true; } } catch (e) {} return false; },
    // olay: kind 1 ondalık dizi, 2 tamsayı dizi. to: 0 ötekiler, 1 herkes, 2 oda yöneticisi
    send: function (id, code, kind, arr, to) {
      var c = cl[id]; if (!c || !c.lbc) return false;
      var v = Array.prototype.slice.call(arr || []), d = kind === 2 ? { i: v } : { f: v };
      try { c.lbc.raiseEvent(code, d, { receivers: to }); return true; } catch (e) { return false; }
    }
  };
  window.KPN.S = S;
})();
