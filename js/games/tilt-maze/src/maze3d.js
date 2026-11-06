// 3D maze on an occupancy grid via recursive backtracker.
// `n` rooms per axis → an odd grid of side D = 2n+1, where odd indices are
// rooms and even indices are the walls between them. Carving guarantees a path
// between any two rooms — in particular start (1,1,1) → goal (D-2,D-2,D-2).

export function generateMaze3D(n) {
  const D = 2 * n + 1;
  const occ = new Uint8Array(D * D * D).fill(1); // 1 = wall, 0 = open
  const at = (x, y, z) => (z * D + y) * D + x;

  const visited = new Set();
  const startCell = [0, 0, 0];
  visited.add(startCell.join(","));
  occ[at(1, 1, 1)] = 0;
  const stack = [startCell];

  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  while (stack.length) {
    const [cx, cy, cz] = stack[stack.length - 1];
    const dirs = shuffle(DIRS.slice());
    let advanced = false;
    for (const [dx, dy, dz] of dirs) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= n || ny >= n || nz >= n) continue;
      const k = nx + "," + ny + "," + nz;
      if (visited.has(k)) continue;
      // carve the wall between the two rooms, and the room itself
      occ[at(cx * 2 + 1 + dx, cy * 2 + 1 + dy, cz * 2 + 1 + dz)] = 0;
      occ[at(nx * 2 + 1, ny * 2 + 1, nz * 2 + 1)] = 0;
      visited.add(k);
      stack.push([nx, ny, nz]);
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }

  return {
    occ, D, at,
    isWall: (x, y, z) => {
      const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= D || iy >= D || iz >= D) return true;
      return occ[at(ix, iy, iz)] === 1;
    },
    start: [1.5, 1.5, 1.5],
    goal: [D - 1.5, D - 1.5, D - 1.5],
  };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
