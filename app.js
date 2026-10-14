(function () {
  "use strict";

  var COLOURS = ["blue", "crimson", "green", "gold"];
  // Rough XP per charm with the 64→75 plan's pouches at levels 66-73
  // (Mithril minotaur, Stranger plant, Bunyip, Barker toad).
  var XP_PER_CHARM = { blue: 580.8, crimson: 281.6, green: 119.2, gold: 87 };
  // A charm that reappears with more than this many is treated as the backpack
  // being reopened, not as a drop (one kill with a charming potion is at most a few).
  var MAX_SINGLE_DROP = 6;
  var STORE_KEY = "charmCounter.v2";
  var READ_MS = 1000;

  var $ = function (id) { return document.getElementById(id); };
  var T = CharmInventory.decodeTemplates(CHARM_TEMPLATES);
  var state = load();
  var paused = false, timer = null, lastRawKey = "", hiddenSince = 0;

  // ---- Storage ---------------------------------------------------------
  function zeros() { return { blue: 0, crimson: 0, green: 0, gold: 0 }; }
  function blank() { return { now: null, trip: zeros(), tripStart: Date.now() }; }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (s && s.trip) return s;
    } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

  // ---- UI --------------------------------------------------------------
  function render() {
    COLOURS.forEach(function (c) {
      var tile = document.querySelector('.tile[data-colour="' + c + '"]');
      tile.querySelector('[data-field="now"]').textContent = state.now ? state.now[c].toLocaleString() : "–";
      tile.querySelector('[data-field="trip"]').textContent = "+" + state.trip[c].toLocaleString();
    });
    var mins = Math.max(0, (Date.now() - state.tripStart) / 60000);
    var h = Math.floor(mins / 60), m = Math.floor(mins % 60);
    $("tripTime").textContent = h + ":" + (m < 10 ? "0" : "") + m;
    var gained = COLOURS.reduce(function (s, c) { return s + state.trip[c]; }, 0);
    $("rate").textContent = mins >= 2 && gained > 0 ? Math.round(gained / (mins / 60)).toLocaleString() : "–";
    var xp = state.now ? COLOURS.reduce(function (s, c) { return s + state.now[c] * XP_PER_CHARM[c]; }, 0) : 0;
    $("xpBanked").textContent = Math.round(xp).toLocaleString();
    var perKill = currentRates();
    perKill = COLOURS.reduce(function (s, c) { return s + perKill[c]; }, 0) * (goal.potions ? 2 : 1);
    var tripKills = perKill > 0 ? gained / perKill : 0;
    $("tripKills").textContent = Math.round(tripKills).toLocaleString();
    renderGoal(mins, tripKills);
  }

  // ---- Goal ------------------------------------------------------------
  var GOAL_KEY = "charmCounter.goal";
  var goal = loadGoal();
  function loadGoal() {
    var d = { xp: 0, goalLevel: 75, monster: "exiled", boost: 0, potions: false,
              custom: { blue: 25, crimson: 20, green: 10, gold: 10 } };
    try {
      var s = JSON.parse(localStorage.getItem(GOAL_KEY) || "null");
      if (s) for (var k in d) if (s[k] !== undefined) d[k] = s[k];
    } catch (e) {}
    return d;
  }
  function saveGoal() { try { localStorage.setItem(GOAL_KEY, JSON.stringify(goal)); } catch (e) {} }
  function currentRates() {
    if (goal.monster === "custom") {
      var r = {}; COLOURS.forEach(function (c) { r[c] = Math.max(0, Number(goal.custom[c]) || 0) / 100; }); return r;
    }
    return (CharmGoal.MONSTERS[goal.monster] || CharmGoal.MONSTERS.exiled).rates;
  }
  function fmtHours(h) {
    if (!isFinite(h)) return "–";
    if (h < 1) return Math.max(1, Math.round(h * 60)) + "m";
    return Math.floor(h) + "h " + Math.round((h % 1) * 60) + "m";
  }
  function renderGoal(mins, tripKills) {
    var T75 = CharmGoal.XP_TABLE;
    $("gGoalLabel").textContent = goal.goalLevel;
    if (!goal.xp) {
      $("gLevel").textContent = "Level –";
      $("gXpLine").textContent = "Enter your Summoning XP below.";
      ["gKills", "gEta"].forEach(function (id) { $(id).textContent = "–"; });
      document.querySelectorAll("[data-need]").forEach(function (b) { b.textContent = "–"; });
      $("gFill").style.width = "0%"; $("gGhost").style.width = "0%";
    } else {
      var p = CharmGoal.plan({ xp: goal.xp, goalLevel: goal.goalLevel, boost: goal.boost,
        charms: state.now || zeros(), rates: currentRates(), potions: goal.potions });
      var startLvl = Math.min(p.level, goal.goalLevel - 1);
      var lo = T75[startLvl] || 0, span = p.goalXp - lo;
      var pct = Math.max(0, Math.min(100, (goal.xp - lo) / span * 100));
      var gpct = Math.max(0, Math.min(100, (p.xpAfterInfuse - lo) / span * 100));
      $("gFill").style.width = pct.toFixed(1) + "%";
      $("gGhost").style.width = gpct.toFixed(1) + "%";
      $("gLevel").textContent = "Level " + p.level;
      $("gXpLine").textContent = p.xpLeft <= 0 ? "Goal reached."
        : p.xpLeft.toLocaleString() + " XP to go · level " + p.levelAfterInfuse + " after infusing your backpack";
      $("gKills").textContent = isFinite(p.kills) ? p.kills.toLocaleString() : "–";
      document.querySelectorAll("[data-need]").forEach(function (b) {
        var c = b.getAttribute("data-need");
        b.textContent = p.toCollect ? p.toCollect[c].toLocaleString() : "–";
      });
      var kph = mins >= 5 && tripKills > 0 ? tripKills / (mins / 60) : 0;
      $("gEta").textContent = kph > 0 && isFinite(p.kills) ? fmtHours(p.kills / kph) : "–";
    }
    var kphShow = mins >= 5 && tripKills > 0 ? Math.round(tripKills / (mins / 60)).toLocaleString() : "–";
    $("gKph").textContent = kphShow;
  }
  function setupGoal() {
    var gs = $("gGoal");
    for (var l = 52; l <= 99; l++) {
      var o = document.createElement("option"); o.value = l; o.textContent = l; gs.appendChild(o);
    }
    var ms = $("gMonster");
    Object.keys(CharmGoal.MONSTERS).forEach(function (k) {
      var o = document.createElement("option"); o.value = k; o.textContent = CharmGoal.MONSTERS[k].name; ms.appendChild(o);
    });
    function fill() {
      $("gXp").value = goal.xp ? String(goal.xp) : "";
      gs.value = String(goal.goalLevel);
      ms.value = goal.monster;
      $("gBoost").value = goal.boost ? String(goal.boost) : "";
      $("gPots").checked = !!goal.potions;
      $("gCustom").hidden = goal.monster !== "custom";
      document.querySelectorAll("[data-rate]").forEach(function (i) { i.value = String(goal.custom[i.getAttribute("data-rate")]); });
    }
    fill();
    $("goalForm").addEventListener("submit", function (e) { e.preventDefault(); });
    $("goalForm").addEventListener("input", function (e) {
      var t = e.target, num = function (v) { var n = Number(String(v).replace(/[, ]/g, "")); return isFinite(n) && n >= 0 ? n : 0; };
      if (t.id === "gXp") goal.xp = Math.floor(num(t.value));
      else if (t.id === "gGoal") goal.goalLevel = Number(t.value);
      else if (t.id === "gMonster") { goal.monster = t.value; $("gCustom").hidden = goal.monster !== "custom"; }
      else if (t.id === "gBoost") goal.boost = num(t.value);
      else if (t.id === "gPots") goal.potions = t.checked;
      else if (t.dataset && t.dataset.rate) goal.custom[t.dataset.rate] = num(t.value);
      saveGoal(); render();
    });
    function show(tab) {
      var goalOn = tab === "goal";
      $("charmsView").hidden = goalOn; $("goalView").hidden = !goalOn;
      $("tabCharms").setAttribute("aria-selected", String(!goalOn));
      $("tabGoal").setAttribute("aria-selected", String(goalOn));
      try { localStorage.setItem("charmCounter.tab", tab); } catch (e) {}
    }
    $("tabCharms").addEventListener("click", function () { show("charms"); });
    $("tabGoal").addEventListener("click", function () { show("goal"); });
    var saved = null; try { saved = localStorage.getItem("charmCounter.tab"); } catch (e) {}
    if (saved === "goal") show("goal");
  }
  function flash(c) {
    var tile = document.querySelector('.tile[data-colour="' + c + '"]');
    tile.classList.remove("flash"); void tile.offsetWidth; tile.classList.add("flash");
  }
  function setStatus(text, kind) { var el = $("status"); el.textContent = text; el.className = "status" + (kind ? " " + kind : ""); }
  function log(text, hit) {
    var ol = $("lines"), li = document.createElement("li");
    li.textContent = new Date().toLocaleTimeString() + "  " + text;
    if (hit) li.className = "hit";
    ol.insertBefore(li, ol.firstChild);
    while (ol.children.length > 30) ol.removeChild(ol.lastChild);
  }
  function describe(counts) {
    return COLOURS.map(function (c) {
      var v = counts[c];
      return c + " " + (v === undefined ? "not seen" : v === null ? "unreadable" : v);
    }).join(", ");
  }

  // ---- Tracking --------------------------------------------------------
  // counts: colour -> number | undefined (not on screen); null readings are filtered out before this.
  function applyReading(counts) {
    var visible = COLOURS.some(function (c) { return counts[c] !== undefined; });
    if (!visible) {
      // Backpack closed, covered, or no charms in it. Remember nothing so a
      // reopened backpack is taken as the new baseline.
      if (!hiddenSince) hiddenSince = Date.now();
      setStatus("No charms visible. Open your backpack.", "warn");
      if (state.now) { state.now = null; save(); render(); }
      return;
    }
    hiddenSince = 0;
    setStatus("Reading backpack", "ok");
    var next = {};
    COLOURS.forEach(function (c) { next[c] = counts[c] === undefined ? 0 : counts[c]; });
    var prev = state.now;
    var gainedAny = false;
    if (prev) {
      COLOURS.forEach(function (c) {
        var diff = next[c] - prev[c];
        if (diff <= 0) return; // used, banked or unchanged
        if (prev[c] === 0 && diff > MAX_SINGLE_DROP) return; // reappeared, not a drop
        state.trip[c] += diff; gainedAny = true; flash(c);
        log("+" + diff + " " + c + " (" + prev[c] + " → " + next[c] + ")", true);
      });
    }
    var changed = !prev || COLOURS.some(function (c) { return prev[c] !== next[c]; });
    state.now = next;
    if (changed || gainedAny) { save(); render(); }
  }

  function readOnce() {
    var img = A1lib.captureHoldFullRs();
    if (!img) { setStatus("Couldn't capture the game window", "bad"); return; }
    var r = CharmInventory.readCharms(img, T);
    var unreadable = COLOURS.filter(function (c) { return r.counts[c] === null; });
    if (unreadable.length) {
      // A hover tooltip or the mouse over a number can hide digits for a moment.
      setStatus("Can't read the " + unreadable.join(", ") + " stack right now", "warn");
      return;
    }
    // Only act on a reading seen twice in a row, so a half-drawn frame can't add charms.
    var key = JSON.stringify(r.counts);
    if (key !== lastRawKey) { lastRawKey = key; return; }
    applyReading(r.counts);
  }

  function tick() {
    timer = null;
    if (paused) return;
    if (!window.alt1 || !alt1.permissionPixel) { schedule(3000); return; }
    if (!alt1.rsLinked) { setStatus("Waiting for the RuneScape window…", "warn"); schedule(3000); return; }
    try { readOnce(); }
    catch (e) { setStatus("Read error: " + (e && e.message ? e.message : e), "bad"); }
    schedule(READ_MS);
  }
  function schedule(ms) { if (timer) clearTimeout(timer); timer = setTimeout(tick, ms); }

  // Paste a screenshot to check the reader outside the game.
  function readPasted(img) {
    try {
      var r = CharmInventory.readCharms(img, T);
      log("Pasted screenshot: " + (r.found ? describe(r.counts) : "no charms found"), r.found);
      $("debug").open = true;
    } catch (e) { log("Pasted screenshot could not be read: " + (e && e.message ? e.message : e)); }
  }

  // ---- Wiring ----------------------------------------------------------
  function setup() {
    setupGoal();
    render();
    setInterval(render, 30000);

    $("newTripBtn").addEventListener("click", function () {
      state.trip = zeros(); state.tripStart = Date.now(); save(); render();
    });
    $("resetBtn").addEventListener("click", function () { $("confirmReset").hidden = false; });
    $("confirmNo").addEventListener("click", function () { $("confirmReset").hidden = true; });
    $("confirmYes").addEventListener("click", function () {
      state = blank(); lastRawKey = ""; save(); render(); $("confirmReset").hidden = true;
    });
    $("copyBtn").addEventListener("click", function () {
      var n = state.now || zeros();
      var text = "Blue " + n.blue + ", Crimson " + n.crimson + ", Green " + n.green + ", Gold " + n.gold;
      var btn = this;
      var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy counts"; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      else { fallbackCopy(text); done(); }
    });
    $("pauseBtn").addEventListener("click", function () {
      paused = !paused;
      this.setAttribute("aria-pressed", String(paused));
      this.textContent = paused ? "Resume" : "Pause";
      if (paused) setStatus("Paused", "warn"); else { setStatus("Resuming…"); lastRawKey = ""; schedule(0); }
    });

    try { A1lib.PasteInput.listen(readPasted, function (err) { log("Paste failed: " + err); }); } catch (e) {}

    var configUrl = new URL("./appconfig.json", document.location.href).href;
    if (window.alt1) {
      A1lib.identifyApp(configUrl);
      if (!alt1.permissionPixel) {
        showBanner("Alt1 needs the <b>view screen</b> permission for this app. Open the app's settings in Alt1 and allow it.");
        setStatus("No screen permission", "bad");
      } else {
        setStatus("Looking for your backpack…");
      }
      schedule(0);
    } else {
      showBanner('Open this page in Alt1 to read your backpack automatically. <a href="alt1://addapp/' + configUrl + '">Add it to Alt1</a>.');
      setStatus("Not running in Alt1", "warn");
    }
  }
  function showBanner(html) { var b = $("install"); b.innerHTML = html; b.hidden = false; }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  if (typeof A1lib === "undefined") {
    setStatus("Couldn't load the Alt1 library. Check your connection and reload.", "bad");
    return;
  }
  setup();
})();
