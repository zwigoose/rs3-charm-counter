# Charm Counter (Alt1)

An [Alt1 Toolkit](https://runeapps.org/alt1) app that counts RuneScape 3 Summoning charms as your charming imp picks them up.

It reads the chatbox for the imp's message, for example:

> The charming imp finds the following charms and puts them in your backpack: 2x Blue charms.

Charms the imp turns into XP ("teaches you about summoning") are not counted. Charms you pick up by hand don't post a message, so they aren't counted either.

## Install

Open this link in your browser while Alt1 is running:

`alt1://addapp/https://zwigoose.github.io/rs3-charm-counter/appconfig.json`

Alt1 asks for the **view screen** permission. The app needs it to read the chatbox.

## Use

- Keep your chatbox open. The app outlines it in teal for a moment when it finds it.
- Turning on chat timestamps in RuneScape's settings helps the reader avoid double-counting.
- **New trip** zeroes the trip counters; totals keep running.
- **Copy totals** copies something like `Blue 120, Crimson 98, Green 40, Gold 41`.
- Use the small − / + buttons on each tile to fix a count.
- **Recent chat lines** shows what the reader saw. You can paste a screenshot of your chatbox there (Ctrl+V) to test reading outside the game.

## Troubleshooting

If the status says it can't find the chatbox: make sure the chat window is showing (not minimised), turn off chat transparency, and try a larger chat font. Alt1's own "Capture" settings (OpenGL vs. DirectX) can also matter.

Built on Skillbert's [alt1](https://github.com/skillbert/alt1) libraries, loaded from jsDelivr.
