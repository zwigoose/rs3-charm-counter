// Turns chatbox lines into charm pickups.
// The charming imp posts:
//   "The charming imp finds the following charm and puts it in your backpack: 1x Blue charm."
//   "The charming imp finds the following charms and puts them in your backpack: 2x Crimson charms."
// Long messages can wrap onto a second chat line, so a pickup line with no
// "Nx ... charm" part marks the next line as its continuation.
// Lines where the imp "teaches you about summoning" are charms it turned
// into XP, so they are not counted.
(function (root) {
  "use strict";

  var COLOURS = ["gold", "green", "crimson", "blue"];
  var CHARM_RE = /(\d{1,3})\s*[xX×]\s*(gold|green|crimson|blue)\s*charm/gi;

  function createParser() {
    var waiting = false; // previous line was an imp pickup without the charm list

    // Returns { counts: {gold, green, crimson, blue}, matched: bool }
    function parseLine(text) {
      var counts = { gold: 0, green: 0, crimson: 0, blue: 0 };
      if (!text) return { counts: counts, matched: false };
      var t = String(text).replace(/\s+/g, " ").toLowerCase();

      var isImp = t.indexOf("charming imp") !== -1 || t.indexOf("following charm") !== -1;
      var isPickup = t.indexOf("backpack") !== -1 || t.indexOf("inventory") !== -1;
      var isTeach = t.indexOf("teaches you") !== -1 || t.indexOf("about summoning") !== -1;

      var counting;
      if (isImp && isTeach) { waiting = false; return { counts: counts, matched: false }; }
      if (isImp && isPickup) counting = true;
      else if (waiting) counting = true;
      else counting = false;

      if (!counting) return { counts: counts, matched: false };

      var found = false, m;
      CHARM_RE.lastIndex = 0;
      while ((m = CHARM_RE.exec(t)) !== null) {
        var n = parseInt(m[1], 10);
        if (n > 0 && n < 100) { counts[m[2]] += n; found = true; }
      }

      if (found) waiting = false;
      else waiting = isImp && isPickup; // the list wrapped onto the next line
      return { counts: counts, matched: found };
    }

    return { parseLine: parseLine, reset: function () { waiting = false; } };
  }

  var api = { createParser: createParser, COLOURS: COLOURS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CharmParser = api;
})(typeof self !== "undefined" ? self : this);
