// Goal model: given current XP, charms in hand and what you're killing,
// how many more charms and kills it takes to reach a target level.
// Charms are infused blue → crimson → green → gold with the best pouch
// for your level at each moment (tradeable tertiaries only).
(function (root) {
  "use strict";

  var XP_TABLE = {
    50: 101333, 51: 111945, 52: 123660, 53: 136594, 54: 150872, 55: 166636, 56: 184040, 57: 203254,
    58: 224466, 59: 247886, 60: 273742, 61: 302288, 62: 333804, 63: 368599, 64: 407015, 65: 449428,
    66: 496254, 67: 547953, 68: 605032, 69: 668051, 70: 737627, 71: 814445, 72: 899257, 73: 992895,
    74: 1096278, 75: 1210421, 76: 1336443, 77: 1475581, 78: 1629200, 79: 1798808, 80: 1986068,
    81: 2192818, 82: 2421087, 83: 2673114, 84: 2951373, 85: 3258594, 86: 3597792, 87: 3972294,
    88: 4385776, 89: 4842295, 90: 5346332, 91: 5902831, 92: 6517253, 93: 7195629, 94: 7944614,
    95: 8771558, 96: 9684577, 97: 10692629, 98: 11805606, 99: 13034431
  };
  var ORDER = ["blue", "crimson", "green", "gold"];
  var POUCHES = {
    gold: [{ n: "Spirit terrorbird", req: 52, xp: 68.4 }, { n: "Barker toad", req: 66, xp: 87 }],
    green: [{ n: "Ibis", req: 56, xp: 98.8 }, { n: "Bunyip", req: 68, xp: 119.2 }, { n: "Unicorn stallion", req: 88, xp: 154.4 }],
    crimson: [{ n: "Bloated leech", req: 49, xp: 215.2 }, { n: "Stranger plant", req: 64, xp: 281.6 },
              { n: "Granite lobster", req: 74, xp: 325.6 }, { n: "Spirit dagannoth", req: 83, xp: 364.8 },
              { n: "Pack yak", req: 96, xp: 422.4 }],
    blue: [{ n: "Spirit jelly", req: 55, xp: 484 }, { n: "Karamthulhu overlord", req: 58, xp: 510.4 },
           { n: "Mithril minotaur", req: 66, xp: 580.8 }, { n: "Fire titan", req: 79, xp: 695.2 },
           { n: "Geyser titan", req: 89, xp: 783.2 }]
  };
  // Charm drop chance per kill, from the RuneScape Wiki drop tables.
  var MONSTERS = {
    exiled: { name: "Exiled kalphites", rates: { gold: 0.0937, green: 0.0937, crimson: 0.227, blue: 0.255 } },
    dustdevil: { name: "Dust devil", rates: { gold: 0.121, green: 0.0607, crimson: 0.243, blue: 0.00809 } },
    custom: { name: "Custom", rates: null }
  };

  function levelOf(xp) {
    var l = 1;
    for (var k in XP_TABLE) if (xp >= XP_TABLE[k]) l = Math.max(l, Number(k));
    return l;
  }
  function bestPouch(c, lvl) {
    var list = POUCHES[c], best = null;
    for (var i = 0; i < list.length; i++) if (list[i].req <= lvl) best = list[i];
    return best;
  }
  function infuse(startXp, charms, boostPct, goalXp) {
    var mult = 1 + (boostPct || 0) / 100, xp = startXp, used = {};
    for (var o = 0; o < ORDER.length; o++) {
      var c = ORDER[o], left = charms[c] || 0;
      used[c] = 0;
      while (left > 0 && xp < goalXp) {
        var p = bestPouch(c, levelOf(xp));
        if (!p) break;
        xp += p.xp * mult; left--; used[c]++;
      }
    }
    return { xp: xp, used: used };
  }
  function charmsForKills(k, rates, mult) {
    var o = {};
    ORDER.forEach(function (c) { o[c] = Math.round((rates[c] || 0) * mult * k); });
    return o;
  }
  function add(a, b) { var o = {}; ORDER.forEach(function (c) { o[c] = (a[c] || 0) + (b[c] || 0); }); return o; }

  // opts: { xp, goalLevel, boost, charms, rates, potions }
  function plan(opts) {
    var goalXp = XP_TABLE[opts.goalLevel] || XP_TABLE[75];
    var mult = opts.potions ? 2 : 1;
    var now = infuse(opts.xp, opts.charms, opts.boost, goalXp);
    var perKill = ORDER.reduce(function (s, c) { return s + (opts.rates[c] || 0); }, 0) * mult;
    var kills = 0;
    if (now.xp < goalXp) {
      if (perKill <= 0) kills = Infinity;
      else {
        var lo = 0, hi = 200000;
        while (lo < hi) {
          var mid = Math.floor((lo + hi) / 2);
          var r = infuse(opts.xp, add(opts.charms, charmsForKills(mid, opts.rates, mult)), opts.boost, goalXp);
          if (r.xp >= goalXp) hi = mid; else lo = mid + 1;
        }
        kills = lo >= 200000 ? Infinity : lo;
      }
    }
    var toCollect = isFinite(kills) ? charmsForKills(kills, opts.rates, mult) : null;
    return {
      level: levelOf(opts.xp),
      goalXp: goalXp,
      xpLeft: Math.max(0, goalXp - opts.xp),
      xpAfterInfuse: now.xp,
      levelAfterInfuse: levelOf(now.xp),
      kills: kills,
      toCollect: toCollect,
      charmsPerKill: perKill
    };
  }

  var api = { XP_TABLE: XP_TABLE, MONSTERS: MONSTERS, ORDER: ORDER, levelOf: levelOf, plan: plan };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CharmGoal = api;
})(typeof self !== "undefined" ? self : this);
