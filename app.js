(function () {
  "use strict";

  var COLOURS = ["blue", "crimson", "green", "gold"];
  // Rough XP per charm at levels 66-73 with the pouches from the 64→75 plan
  // (Mithril minotaur, Stranger plant, Bunyip, Barker toad).
  var XP_PER_CHARM = { blue: 580.8, crimson: 281.6, green: 119.2, gold: 87 };
  var STORE_KEY = "charmCounter.v1";
  var READ_MS = 600;     // chat read interval while the chatbox is known
  var FIND_MS = 3000;    // retry interval while looking for the chatbox

  var $ = function (id) { return document.getElementById(id); };
  var parser = CharmParser.createParser();
  var state = load();
  var reader = null;
  var paused = false;
  var loopTimer = null;

  // ---- Storage ---------------------------------------------------------
  function blank() {
    var z = function () { return { blue: 0, crimson: 0, green: 0, gold: 0 }; };
    return { total: z(), trip: z(), tripStart: Date.now() };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (s && s.total && s.trip) return s;
    } catch (e) {}
    return blank();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---- UI --------------------------------------------------------------
  function render() {
    COLOURS.forEach(function (c) {
      var tile = document.querySelector('.tile[data-colour="' + c + '"]');
      tile.querySelector('[data-field="total"]').textContent = state.total[c].toLocaleString();
      tile.querySelector('[data-field="trip"]').textContent = state.trip[c].toLocaleString();
    });
    var mins = Math.max(0, (Date.now() - state.tripStart) / 60000);
    var h = Math.floor(mins / 60), m = Math.floor(mins % 60);
    $("tripTime").textContent = h + ":" + (m < 10 ? "0" : "") + m;
    var tripCount = COLOURS.reduce(function (s, c) { return s + state.trip[c]; }, 0);
    $("rate").textContent = mins >= 2 && tripCount > 0 ? Math.round(tripCount / (mins / 60)).toLocaleString() : "–";
    var xp = COLOURS.reduce(function (s, c) { return s + state.total[c] * XP_PER_CHARM[c]; }, 0);
    $("xpBanked").textContent = Math.round(xp).toLocaleString();
  }
  function flash(c) {
    var tile = document.querySelector('.tile[data-colour="' + c + '"]');
    tile.classList.remove("flash"); void tile.offsetWidth; tile.classList.add("flash");
  }
  function setStatus(text, kind) {
    var el = $("status"); el.textContent = text; el.className = "status" + (kind ? " " + kind : "");
  }
  function logLine(text, hit) {
    if (!text) return;
    var ol = $("lines");
    var li = document.createElement("li");
    li.textContent = text; if (hit) li.className = "hit";
    ol.insertBefore(li, ol.firstChild);
    while (ol.children.length > 30) ol.removeChild(ol.lastChild);
  }

  function addCounts(counts) {
    var any = false;
    COLOURS.forEach(function (c) {
      var n = counts[c] || 0;
      if (n) { state.total[c] += n; state.trip[c] += n; flash(c); any = true; }
    });
    if (any) { save(); render(); }
    return any;
  }

  function handleLines(lines) {
    for (var i = 0; i < lines.length; i++) {
      var text = lines[i] && lines[i].text;
      if (!text) continue;
      var r = parser.parseLine(text);
      var hit = r.matched && addCounts(r.counts);
      logLine(text, hit);
    }
  }

  // ---- Chat reading ----------------------------------------------------
  function canRead() {
    return window.alt1 && alt1.permissionPixel;
  }

  function tick() {
    loopTimer = null;
    if (paused) return;
    if (!canRead()) { schedule(FIND_MS); return; }
    if (!alt1.rsLinked) { setStatus("Waiting for the RuneScape window…", "warn"); schedule(FIND_MS); return; }

    try {
      if (!reader.pos) {
        var found = reader.find();
        if (!found) {
          setStatus("Looking for your chatbox… make sure it's open and visible.", "warn");
          schedule(FIND_MS);
          return;
        }
        var box = reader.pos.mainbox.rect;
        try { alt1.overLayRect(A1lib.mixColor(79, 179, 186), box.x, box.y, box.width, box.height, 1500, 2); } catch (e) {}
        setStatus("Reading chat" + (reader.pos.mainbox.timestamp ? "" : " (turn on chat timestamps for best results)"), "ok");
      }
      var lines = reader.read();
      if (lines === null) {
        // Lost the chatbox (moved or closed). Look for it again.
        reader.pos = null;
        setStatus("Lost the chatbox, looking again…", "warn");
        schedule(FIND_MS);
        return;
      }
      handleLines(lines);
    } catch (e) {
      setStatus("Read error: " + (e && e.message ? e.message : e), "bad");
      reader.pos = null;
      schedule(FIND_MS);
      return;
    }
    schedule(READ_MS);
  }
  function schedule(ms) {
    if (loopTimer) clearTimeout(loopTimer);
    loopTimer = setTimeout(tick, ms);
  }

  // Ctrl+V a screenshot of the chatbox to test reading outside the game.
  function readPastedImage(ref) {
    try {
      var testReader = new Chatbox.default();
      if (!testReader.find(ref)) { logLine("Pasted image: no chatbox found in it.", false); return; }
      testReader.diffRead = false;
      var lines = testReader.read(ref) || [];
      var testParser = CharmParser.createParser();
      lines.forEach(function (l) {
        var r = testParser.parseLine(l.text);
        logLine("[test] " + l.text, r.matched);
      });
      $("debug").open = true;
    } catch (e) {
      logLine("Pasted image could not be read: " + (e && e.message ? e.message : e), false);
    }
  }

  // ---- Wiring ----------------------------------------------------------
  function setup() {
    render();
    setInterval(render, 30000);

    document.getElementById("tiles").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-adj]");
      if (!btn) return;
      var c = btn.closest(".tile").dataset.colour;
      var d = Number(btn.dataset.adj);
      state.total[c] = Math.max(0, state.total[c] + d);
      state.trip[c] = Math.max(0, state.trip[c] + d);
      save(); render();
    });
    $("newTripBtn").addEventListener("click", function () {
      state.trip = { blue: 0, crimson: 0, green: 0, gold: 0 };
      state.tripStart = Date.now();
      save(); render();
    });
    $("resetBtn").addEventListener("click", function () { $("confirmReset").hidden = false; });
    $("confirmNo").addEventListener("click", function () { $("confirmReset").hidden = true; });
    $("confirmYes").addEventListener("click", function () {
      state = blank(); save(); render(); $("confirmReset").hidden = true;
    });
    $("copyBtn").addEventListener("click", function () {
      var text = "Blue " + state.total.blue + ", Crimson " + state.total.crimson +
        ", Green " + state.total.green + ", Gold " + state.total.gold;
      var done = function () { $("copyBtn").textContent = "Copied"; setTimeout(function () { $("copyBtn").textContent = "Copy totals"; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });
    $("pauseBtn").addEventListener("click", function () {
      paused = !paused;
      this.setAttribute("aria-pressed", String(paused));
      this.textContent = paused ? "Resume" : "Pause";
      if (paused) setStatus("Paused", "warn"); else { setStatus("Resuming…"); schedule(0); }
    });

    try { A1lib.PasteInput.listen(readPastedImage, function (err) { logLine("Paste failed: " + err, false); }); } catch (e) {}

    var configUrl = new URL("./appconfig.json", document.location.href).href;
    if (window.alt1) {
      A1lib.identifyApp(configUrl);
      if (!alt1.permissionPixel) {
        showBanner("Alt1 needs the <b>view screen</b> permission for this app. Open the app's settings in Alt1 (the wrench icon) and allow it.");
        setStatus("No screen permission", "bad");
      }
      reader = new Chatbox.default();
      schedule(0);
    } else {
      showBanner('Open this page in Alt1 to count charms automatically. <a href="alt1://addapp/' + configUrl + '">Add it to Alt1</a>.');
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

  if (typeof A1lib === "undefined" || typeof Chatbox === "undefined") {
    setStatus("Couldn't load the Alt1 libraries. Check your connection and reload.", "bad");
    return;
  }
  setup();
})();
