import * as THREE from "../vendor/three.module.js";
import { generateMaze3D } from "./maze3d.js";

// Tilt Maze — tilt a transparent cube to roll a ball through the maze inside it.
// You never move the ball directly: you rotate the whole world, and gravity
// (always pointing down in *screen* space) does the rest. Rotations are applied
// as screen-relative quaternion deltas (premultiply), so dragging always feels
// the same no matter how the cube is currently oriented — and never gimbal-locks.

const canvas = document.getElementById("stage");
const loading = document.getElementById("loading");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x070512, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(0, 0, 1);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(1, 2, 3); scene.add(dir);

const cube = new THREE.Group();   // the rotatable world
scene.add(cube);

const state = {
  level: 1, n: 3, maze: null, D: 0, scale: 1,
  ball: { p: new THREE.Vector3(), v: new THREE.Vector3() },
  ballMesh: null, goalMesh: null, won: false, time: 0,
};
const BALL_R = 0.34;
const GRAVITY = 9.0;
const RESTITUTION = 0.25;

let cubeSize = 6; // world units the cube spans on screen

function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.geometry?.dispose(); c.material?.dispose(); } }

function buildLevel() {
  clearGroup(cube);
  cube.quaternion.identity();
  state.maze = generateMaze3D(state.n);
  state.D = state.maze.D;
  state.scale = cubeSize / state.D;
  state.won = false;

  // outer cube (transparent shell + edges)
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
    new THREE.MeshBasicMaterial({ color: 0x8a7bff, transparent: true, opacity: 0.06, depthWrite: false })
  );
  cube.add(shell);
  cube.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)),
    new THREE.LineBasicMaterial({ color: 0x9b8bff })
  ));

  // merge all wall cells into one geometry (one buffer, not hundreds)
  const wallGeos = [];
  const cs = state.scale;
  for (let z = 0; z < state.D; z++)
    for (let y = 0; y < state.D; y++)
      for (let x = 0; x < state.D; x++) {
        if (state.maze.occ[state.maze.at(x, y, z)] !== 1) continue;
        // skip the outer shell layer so the maze interior reads clearly
        if (x === 0 || y === 0 || z === 0 || x === state.D - 1 || y === state.D - 1 || z === state.D - 1) continue;
        const g = new THREE.BoxGeometry(cs * 0.96, cs * 0.96, cs * 0.96);
        g.translate(...local(x + 0.5, y + 0.5, z + 0.5));
        wallGeos.push(g);
      }
  if (wallGeos.length) {
    const merged = mergeGeometries(wallGeos);
    cube.add(new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0x3a2f66, transparent: true, opacity: 0.55 })));
    wallGeos.forEach((g) => g.dispose());
  }

  // goal marker
  state.goalMesh = new THREE.Mesh(
    new THREE.SphereGeometry(cs * 0.4, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x5aff96, transparent: true, opacity: 0.85, depthTest: false })
  );
  state.goalMesh.renderOrder = 10;
  state.goalMesh.position.set(...local(...state.maze.goal));
  cube.add(state.goalMesh);

  // ball
  state.ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(cs * BALL_R, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x6ad7ff, emissive: 0x123a4a, metalness: 0.3, roughness: 0.4 })
  );
  cube.add(state.ballMesh);

  state.ball.p.set(...state.maze.start);
  state.ball.v.set(0, 0, 0);
  placeBall();
  hud();
}

// grid cell coords (0..D) → centered local scene coords
function local(x, y, z) {
  const s = state.scale;
  return [(x - state.D / 2) * s, (y - state.D / 2) * s, (z - state.D / 2) * s];
}
function placeBall() {
  state.ballMesh.position.set(...local(state.ball.p.x, state.ball.p.y, state.ball.p.z));
}

// ---------- physics (in grid units, cube-local space) ----------
const worldGravity = new THREE.Vector3(0, -1, 0);
function physics(dt) {
  if (state.won) return;
  // gravity in screen-down, expressed in the cube's local frame
  const invQ = cube.quaternion.clone().invert();
  const g = worldGravity.clone().applyQuaternion(invQ).multiplyScalar(GRAVITY);

  const b = state.ball;
  b.v.addScaledVector(g, dt);
  b.v.multiplyScalar(0.992); // rolling friction / air drag

  // integrate per-axis with grid collision so we can resolve cleanly
  moveAxis("x", b.v.x * dt);
  moveAxis("y", b.v.y * dt);
  moveAxis("z", b.v.z * dt);

  placeBall();

  // win when the ball reaches the goal room
  if (b.p.distanceTo(new THREE.Vector3(...state.maze.goal)) < 0.7) win();
}

function moveAxis(axis, delta) {
  const b = state.ball;
  const p = b.p;
  let val = p[axis] + delta;
  const lo = 1 + BALL_R, hi = state.D - 1 - BALL_R; // stay inside the shell
  if (val < lo) { val = lo; b.v[axis] *= -RESTITUTION; }
  if (val > hi) { val = hi; b.v[axis] *= -RESTITUTION; }
  // wall collision: test the ball's leading face against the occupancy grid
  const probe = p.clone();
  probe[axis] = val + Math.sign(delta) * BALL_R;
  if (state.maze.isWall(probe.x, probe.y, probe.z)) {
    // snap to just outside the wall cell and bounce a little
    const cellEdge = Math.sign(delta) > 0 ? Math.floor(probe[axis]) - BALL_R : Math.ceil(probe[axis]) + BALL_R;
    val = cellEdge;
    b.v[axis] *= -RESTITUTION;
  }
  p[axis] = val;
}

function win() {
  state.won = true;
  window.parent?.postMessage({
    type: "tilt-maze-score",
    score: state.level * 1000,
    level: state.level,
    completedLevels: state.level,
    gameOver: false,
  }, "*");
  document.getElementById("flash").textContent = `Level ${state.level} cleared`;
  document.getElementById("flash").classList.add("show");
  setTimeout(() => {
    document.getElementById("flash").classList.remove("show");
    state.level++;
    state.n = Math.min(6, 3 + Math.floor(state.level / 2));
    buildLevel();
  }, 1200);
}

// ---------- camera fit ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  // pull camera back so the cube fits even when rotated (diagonal)
  const diag = cubeSize * Math.sqrt(3);
  const fovV = camera.fov * Math.PI / 180;
  const distV = (diag / 2) / Math.tan(fovV / 2);
  const distH = (diag / 2) / Math.tan(Math.atan(Math.tan(fovV / 2) * camera.aspect));
  camera.position.set(0, 0, Math.max(distV, distH) * 1.15);
  camera.lookAt(0, 0, 0);
}
window.addEventListener("resize", resize);

// ---------- loop ----------
let last = 0;
function frame(t) {
  const dt = Math.min(0.04, (t - (last || t)) / 1000);
  last = t;
  state.time += dt;
  physics(dt);
  if (state.goalMesh) state.goalMesh.material.opacity = 0.6 + 0.3 * Math.sin(state.time * 3);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- input: screen-relative cube rotation ----------
let drag = null;
function rotateBy(dxScreen, dyScreen) {
  const k = 0.008;
  const q = new THREE.Quaternion();
  // rotate about screen Y for horizontal drag, screen X for vertical drag
  q.setFromEuler(new THREE.Euler(dyScreen * k, dxScreen * k, 0, "XYZ"));
  cube.quaternion.premultiply(q); // premultiply → screen-relative, gimbal-safe
}
canvas.addEventListener("mousedown", (e) => (drag = { x: e.clientX, y: e.clientY }));
window.addEventListener("mouseup", () => (drag = null));
window.addEventListener("mousemove", (e) => {
  if (!drag) return;
  rotateBy(e.clientX - drag.x, e.clientY - drag.y);
  drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("touchstart", (e) => { if (e.touches[0]) drag = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
canvas.addEventListener("touchmove", (e) => {
  if (drag && e.touches[0]) { rotateBy(e.touches[0].clientX - drag.x, e.touches[0].clientY - drag.y); drag = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
  e.preventDefault();
}, { passive: false });

document.getElementById("reset").addEventListener("click", () => buildLevel());

function hud() { document.getElementById("level").textContent = state.level; }

// ---------- minimal mergeGeometries (avoids the addons import) ----------
function mergeGeometries(geos) {
  let total = 0;
  const sources = geos.map((g) => g.index ? g.toNonIndexed() : g);
  for (const g of sources) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of sources) {
    const gp = g.attributes.position.array, gn = g.attributes.normal.array;
    pos.set(gp, o); nor.set(gn, o); o += gp.length;
  }
  sources.forEach((g, index) => { if (g !== geos[index]) g.dispose(); });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return merged;
}

resize();
buildLevel();
loading.style.display = "none";
requestAnimationFrame(frame);

window.__gyro = {
  state, scene, cube, physics, buildLevel, renderer,
  renderOnce() { resize(); renderer.render(scene, camera); },
  tiltTo(x, y, z) { cube.quaternion.setFromEuler(new THREE.Euler(x, y, z)); },
  get ballPos() { return state.ball.p.clone(); },
  get level() { return state.level; },
  forceWin() { state.ball.p.set(...state.maze.goal); },
};
