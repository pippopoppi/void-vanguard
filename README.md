# Void Vanguard

A tiny vertical space shooter for phones and browsers. Drag anywhere to fly, your cannons fire by themselves, and waves of alien ships and asteroids come down the screen. Every fifth level ends with the Dreadnought.

**Play it:** https://pippopoppi.github.io/void-vanguard/

No install, no build step, no dependencies. One HTML page plus one JavaScript file on an HTML5 canvas. All art is drawn in code.

## How to play

- **Drag** anywhere to move the ship. It follows your finger with an offset so it is never hidden. Arrow keys or WASD on desktop.
- The ship **fires automatically**. Dodge red bullets and ramming ships. Lose all hull points and the ship is gone.
- Enemies drop **power-ups**: S spread shot, R rapid fire, L piercing laser, D shield, B bomb, + repair.
- Chain kills for a **combo multiplier** on score.
- Score becomes coins for the **hangar**: three ships (Dart, Bulwark, Phoenix) and four upgrade tracks.

## Enemies

Drones (weave), Fighters (dive and shoot), Tanks (armoured, triple shot), Kamikazes (home in), Asteroids (split into shards), and the Dreadnought boss, which changes attack patterns at two thirds and one third health.

## Running locally

```
python3 -m http.server 8000
```

then open http://localhost:8000/.

## Regenerating the share image

```
python3 tools/make_og.py
```

needs Pillow and writes `og.png` and `icon-180.png`.

## Licence

MIT
