// Reads charm stacks from the RS3 backpack.
//
// For each charm colour we look for a small opaque patch from the middle of its
// icon, then read the yellow stack number that sits above it in the same slot.
// A charm whose icon is visible but has no number is a stack of 1.
(function (root) {
  "use strict";

  var COLOURS = ["blue", "crimson", "green", "gold"];
  // Offset from the icon patch's top-left corner back to the top-left of the
  // slot's stack number, and the size of the box we scan for digits.
  var NUM_DX = -9, NUM_DY = -13, NUM_W = 42, NUM_H = 13;
  var GLYPH_H = 8;

  function decodeTemplates(T) {
    var icons = {};
    COLOURS.forEach(function (c) {
      var raw = atob(T.icons[c]);
      var data = new Uint8ClampedArray(T.w * T.h * 4);
      for (var i = 0, j = 0; i < raw.length; i += 3, j += 4) {
        data[j] = raw.charCodeAt(i);
        data[j + 1] = raw.charCodeAt(i + 1);
        data[j + 2] = raw.charCodeAt(i + 2);
        data[j + 3] = 255;
      }
      icons[c] = makeImageData(data, T.w, T.h);
    });
    var digits = Object.keys(T.digits).map(function (d) {
      return { ch: d, rows: T.digits[d], w: T.digits[d][0].length };
    });
    return { icons: icons, digits: digits };
  }

  function makeImageData(data, w, h) {
    if (typeof ImageData !== "undefined") return new ImageData(data, w, h);
    return { data: data, width: w, height: h };
  }

  function isYellow(d, i) { return d[i] >= 235 && d[i + 1] >= 235 && d[i + 2] <= 50; }

  // Reads the stack number from an ImageData cut around the top-left of a slot.
  // Returns a number, 1 when there is no number, or null when the digits can't be read.
  function readStack(buf, digits) {
    var w = buf.width, h = buf.height, d = buf.data;
    var top = -1;
    for (var y = 0; y < h && top < 0; y++) {
      for (var x = 0; x < w; x++) { if (isYellow(d, (y * w + x) * 4)) { top = y; break; } }
    }
    if (top < 0) return 1;
    // Columns that hold yellow within the 8-row glyph band, split into glyphs.
    var bandH = Math.min(GLYPH_H, h - top);
    var cols = [];
    for (var cx = 0; cx < w; cx++) {
      var has = false;
      for (var cy = top; cy < top + bandH; cy++) { if (isYellow(d, (cy * w + cx) * 4)) { has = true; break; } }
      cols.push(has);
    }
    var glyphs = [], start = -1;
    for (var c = 0; c <= w; c++) {
      if (c < w && cols[c]) { if (start < 0) start = c; }
      else if (start >= 0) { glyphs.push([start, c]); start = -1; }
    }
    // Only the first run of glyphs belongs to the number; stop at a gap wider than 3 px.
    var run = [];
    for (var g = 0; g < glyphs.length; g++) {
      if (run.length && glyphs[g][0] - run[run.length - 1][1] > 3) break;
      run.push(glyphs[g]);
    }
    var text = "";
    for (var k = 0; k < run.length; k++) {
      var gx0 = run[k][0], gw = run[k][1] - run[k][0];
      var best = null, bestScore = Infinity;
      for (var t = 0; t < digits.length; t++) {
        var tpl = digits[t];
        if (tpl.w !== gw) continue;
        var score = 0;
        for (var ry = 0; ry < GLYPH_H; ry++) {
          for (var rx = 0; rx < gw; rx++) {
            var on = ry < bandH && isYellow(d, ((top + ry) * w + gx0 + rx) * 4);
            if (on !== (tpl.rows[ry][rx] === "#")) score++;
          }
        }
        if (score < bestScore) { bestScore = score; best = tpl.ch; }
      }
      if (best === null || bestScore > 2) return null;
      text += best;
    }
    return text ? parseInt(text, 10) : 1;
  }

  // img: an alt1 ImgRef (live capture or pasted screenshot).
  // Returns { found: bool, counts: {colour: number|null|undefined}, positions }
  //   undefined = icon not on screen, null = icon found but number unreadable.
  function readCharms(img, T) {
    var counts = {}, positions = {}, found = false;
    COLOURS.forEach(function (c) {
      var locs;
      try { locs = img.findSubimage(T.icons[c]); } catch (e) { locs = []; }
      if (!locs || !locs.length) { counts[c] = undefined; return; }
      var loc = locs[0];
      found = true;
      positions[c] = loc;
      var x = loc.x + NUM_DX, y = loc.y + NUM_DY;
      var w = NUM_W, h = NUM_H;
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { h += y; y = 0; }
      w = Math.min(w, img.width - x); h = Math.min(h, img.height - y);
      var buf = img.toData(img.x + x, img.y + y, w, h);
      counts[c] = readStack(buf, T.digits);
    });
    return { found: found, counts: counts, positions: positions };
  }

  var api = { COLOURS: COLOURS, decodeTemplates: decodeTemplates, readStack: readStack, readCharms: readCharms };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CharmInventory = api;
})(typeof self !== "undefined" ? self : this);
