# Tilt Maze

A 3D maze puzzle: drag to rotate a transparent cube, and gravity rolls the ball through the corridors inside it toward the green goal. You tilt the cube — not the ball.

**▶ Play:** https://andreaisabelmontana.github.io/tilt-maze-game/

> **Not an original idea.** This recreates the concept of an existing project — I didn't invent it. I rebuilt it from scratch, my own way, out of curiosity about how it actually works (and tried to make it a little better along the way).

## How it plays

- **Drag** to rotate the cube; gravity always points *down on your screen*, so tilting redirects which way the ball rolls
- Guide the ball through the interior corridors to the **green** goal sphere
- Each level generates a larger maze (3³ rooms up to 6³)

## How it works

- The maze is carved by a **3D recursive-backtracker** on an occupancy grid, guaranteeing a path from start to goal
- **Custom physics** — fixed gravity in screen space is transformed into the cube's local frame each frame, then integrated per-axis with grid collision and a little bounce
- **Screen-relative rotation** — drag deltas are applied as quaternion *premultiplications*, so the controls feel identical regardless of the cube's current orientation and never gimbal-lock
- **One merged geometry** — every wall cube is merged into a single buffer (instead of hundreds of draw calls) so loading a level doesn't hitch

## Tech

[Three.js](https://threejs.org) from a locally vendored module, with a hand-written ball integrator, maze generator, and geometry merge — no extra dependencies, no build step.

```
index.html       # import map for three
styles.css
src/maze3d.js     # 3D maze generation + wall test
src/main.js       # scene, gravity/quaternion physics, level flow, controls
```

## License

MIT — see [LICENSE](LICENSE).
