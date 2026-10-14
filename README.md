# Charm Counter (Alt1)

An [Alt1 Toolkit](https://runeapps.org/alt1) app that reads your RuneScape 3 backpack and tracks your Summoning charm stacks (blue, crimson, green, gold) as they grow.

## Install

Open this link in your browser while Alt1 is running:

`alt1://addapp/https://zwigoose.github.io/rs3-charm-counter/appconfig.json`

Alt1 asks for the **view screen** permission. The app needs it to see your backpack.

## How it works

Once a second the app looks for each charm's icon on screen and reads the yellow stack number above it. A charm with no number is a stack of one.

- **Big number:** how many of that charm are in your backpack right now.
- **+N this trip:** charms gained since you pressed **New trip**. Drops in your stack count as gains; using or banking charms does not.
- **XP in backpack:** a rough figure using the 64 to 75 plan's pouches.
- **Copy counts** copies something like `Blue 452, Crimson 491, Green 154, Gold 207`.

A reading has to come out the same twice in a row before it counts, so a half-drawn frame can't add charms. If you close the backpack, the next reading after you reopen it becomes the new starting point.

## Calibration

The charm icons and number font were taken from a 2560x1369 client screenshot at 100% interface scaling. If you change interface scaling or the backpack's look, the app may stop finding the icons and would need new samples.

To check the reader without the game, open **Reader details** and paste (Ctrl+V) a PNG screenshot that shows your backpack.

Built on Skillbert's [alt1](https://github.com/skillbert/alt1) base library, loaded from jsDelivr.
