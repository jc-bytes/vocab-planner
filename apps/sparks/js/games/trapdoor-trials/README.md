# Trapdoor Trials

Trapdoor Trials is a locally hosted surprise-trap platformer adapted for the
Vocabulary Master student arcade. It contains 30 levels, keyboard and touch
controls, local progress, and arcade leaderboard reporting.

## Play

Open `index.html` in a browser, or serve the folder locally:

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Controls

| Key | Action |
|-----|--------|
| ← → / A D | Move |
| ↑ / W / Space | Jump |
| R | Restart level |
| M | Mute |
| T | Toggle dark/light theme |
| F | Toggle fullscreen |

On mobile the game goes fullscreen with floating, translucent touch controls: move arrows on the left, jump + restart on the right. Theme, sound, and fullscreen toggles live in the top-right corner.

## Features

- **30 handcrafted levels** with a smooth difficulty curve and a fresh mechanic introduced every few stages
- **13 trap types:** collapsing floors, pop spikes, falling blocks, crushers, crumbling platforms, homing floor gaps, fake doors, inverted controls, plus newer concepts — **moving platforms, conveyor belts, springs, spinning saws, telegraphed lasers, teleporters, buttons + gates, blinking platforms, pendulums, and turrets**
- **Dark & light themes** with a one-tap toggle (remembers your choice, respects system preference)
- **Mobile-first fullscreen** layout that scales to any screen with safe-area-aware floating controls
- School-appropriate reset particles, screen shake, and scene transitions
- Procedural Web Audio sound effects
- Attempt counter and level unlock progress saved in `localStorage`
- Level, completion, attempt, and score reporting to the parent arcade

## Tech

Pure HTML, CSS, and JavaScript on a 2D `<canvas>`. It has no build step,
framework, analytics, remote fonts, or other network dependency.

## License

The upstream project was created by Leonxlnx and released under the MIT
License. This adapted version retains the original copyright and permission
notice in [LICENSE](LICENSE). Vocabulary Master modifications include the
Trapdoor Trials identity, offline cleanup, school-appropriate effects, isolated
storage keys, and arcade progress reporting.
