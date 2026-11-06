const ASSETS = {
  seed: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fseed.png?alt=media&token=52fb5027-578c-40b6-85ac-b9dbd71626d0',
  seedling: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fseedling.png?alt=media&token=4c78b386-6299-4f10-a60c-d2955c257bfb',
  earthflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fearthflower.png?alt=media&token=8672315f-7e71-4c2b-9cc2-015e52e4e5ba',
  waterflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fwaterflower.png?alt=media&token=f57ded42-7a98-4688-b842-d1c4d065d8ae',
  fireflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Ffireflower.png?alt=media&token=21df8102-28c9-4e2d-86b3-141455fefc9b',
  windflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fwindflower.png?alt=media&token=a81d5058-48b2-4d55-b997-55a231478b66',
  stormflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fstormflower.png?alt=media&token=b4b265ea-5d2a-4296-9190-5e49f165bc08',
  mysticflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fmysticflower.png?alt=media&token=af76264c-9dac-46df-9add-c36c4b334496',
  iceflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Ficeflower_-_kopie.png?alt=media&token=69feeafc-46eb-4ac3-96c6-fd3b9e159298',
  magmaflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fmagmaflower_-_kopie.png?alt=media&token=1ebe8241-6020-4f65-9871-6ea6b862f90e',
  darkflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fdarkflower_-_kopie.png?alt=media&token=d54cc785-7935-4dc7-b961-8359feff9d1c',
  lightflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Flightflower.png?alt=media&token=8a8c8719-97e1-44c8-9fdf-3e9551f7bdb7',
  mountainflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fmountainflower1.png?alt=media&token=9aead628-5f01-47bf-840e-181f9d48b0e6',
  waterfallflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fwaterfallflower.png?alt=media&token=3e9d7735-7c98-4b65-bb3e-3c849e10df92',
  sunflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Fsunflower.png?alt=media&token=444f2e6c-d343-4d2c-ac12-ab5b5bb6959f',
  tornadoflower: 'https://firebasestorage.googleapis.com/v0/b/codedex-io.appspot.com/o/buildAssets%2Fgrj7Uul6QPOgcp6YSmLq%2Ftornadoflower.png?alt=media&token=c872ed78-01db-483b-94db-44779560d299'
};

const BASE_FLOWERS = ['earthflower', 'waterflower', 'fireflower', 'windflower'];
const FORMULAS = [
  { id: 'seedling', left: 'seed', right: 'seed', result: 'seedling' },
  { id: 'earthflower', left: 'seedling', right: 'seedling', result: 'earthflower' },
  { id: 'waterflower', left: 'seedling', right: 'seedling', result: 'waterflower' },
  { id: 'fireflower', left: 'seedling', right: 'seedling', result: 'fireflower' },
  { id: 'windflower', left: 'seedling', right: 'seedling', result: 'windflower' },
  { id: 'stormflower', left: 'windflower', right: 'fireflower', result: 'stormflower' },
  { id: 'mysticflower', left: 'earthflower', right: 'waterflower', result: 'mysticflower' },
  { id: 'iceflower', left: 'waterflower', right: 'windflower', result: 'iceflower' },
  { id: 'magmaflower', left: 'fireflower', right: 'earthflower', result: 'magmaflower' },
  { id: 'darkflower', left: 'fireflower', right: 'waterflower', result: 'darkflower' },
  { id: 'lightflower', left: 'earthflower', right: 'windflower', result: 'lightflower' },
  { id: 'mountainflower', left: 'earthflower', right: 'earthflower', result: 'mountainflower' },
  { id: 'waterfallflower', left: 'waterflower', right: 'waterflower', result: 'waterfallflower' },
  { id: 'sunflower', left: 'fireflower', right: 'fireflower', result: 'sunflower' },
  { id: 'tornadoflower', left: 'windflower', right: 'windflower', result: 'tornadoflower' }
];

const DESCRIPTIONS = {
  seedling: 'This is a simple seedling. Maybe two seedlings could create something great together.',
  earthflower: 'This flower is often seen growing in the woods. It is fertile and full of possibilities.',
  waterflower: 'This flower often grows along streams or rivers. Small bubbles shimmer on its petals.',
  fireflower: 'This flower grows out of ashes like a phoenix. It glows warmly when discovered.',
  windflower: 'This flower grows in open meadows and magically shapes the wind.',
  stormflower: 'This flower is energetic and crackles with lightning.',
  mysticflower: 'This flower shines with a beauty that butterflies love.',
  iceflower: 'This flower sparkles as if its petals were frozen in morning light.',
  magmaflower: 'This fiery flower carries a restless heat inside its roots.',
  darkflower: 'This flower grows best under moonlight in hidden places.',
  lightflower: 'This mysterious flower drinks in sunlight and glows softly.',
  mountainflower: 'This flower grows tall and strong in high mountain places.',
  waterfallflower: 'This flower pours out water as clear as a mountain spring.',
  sunflower: 'This magical sunflower stores the energy of the sun.',
  tornadoflower: 'This flower twists the air around its petals.'
};

const state = {
  startedAt: null,
  spawnTimer: null,
  discovered: new Set(),
  counters: {
    seed: 0,
    seedling: 0,
    flower: 0,
    megaFlower: 0
  }
};

const soundbutton = document.getElementById('soundbutton');
const sound = document.getElementById('sound');
const startbutton = document.getElementById('startbutton');
const dropArea = document.getElementById('dropArea');
const box = document.getElementById('box');
const gardenpicture = document.getElementById('gardenpicture');
const closeButton = document.getElementById('closeButton');

let isMuted = true;

soundbutton.addEventListener('click', () => {
  if (isMuted) {
    sound.play().catch(() => {});
    soundbutton.style.filter = 'brightness(100%)';
  } else {
    sound.pause();
    soundbutton.style.filter = 'brightness(40%)';
  }
  isMuted = !isMuted;
});

startbutton.addEventListener('click', () => {
  document.getElementById('startscreen').hidden = true;
  document.getElementById('game').hidden = false;
  startGame();
});

closeButton.addEventListener('click', () => {
  box.hidden = true;
  gardenpicture.style.filter = 'blur(0) brightness(100%)';
});

dropArea.addEventListener('dragover', event => {
  event.preventDefault();
});

dropArea.addEventListener('drop', event => {
  event.preventDefault();
  const draggedItem = document.getElementById(event.dataTransfer.getData('id'));
  if (!draggedItem) return;

  const dropAreaRect = dropArea.getBoundingClientRect();
  const newX = event.clientX - dropAreaRect.left - draggedItem.offsetWidth / 2;
  const newY = event.clientY - dropAreaRect.top - draggedItem.offsetHeight / 2;

  draggedItem.style.left = `${clamp(newX, 0, dropArea.clientWidth - draggedItem.offsetWidth)}px`;
  draggedItem.style.top = `${clamp(newY, 0, dropArea.clientHeight - draggedItem.offsetHeight)}px`;

  checkForCombination(draggedItem);
});

function startGame() {
  if (state.startedAt) return;

  state.startedAt = Date.now();
  renderNotebook();
  renderFlowerbed();
  spawnSeed();
  spawnSeed();
  spawnSeed();
  state.spawnTimer = setInterval(spawnSeed, 5000);
}

function renderNotebook() {
  const list = document.getElementById('formula-list');
  list.innerHTML = '';

  FORMULAS.forEach(formula => {
    const row = document.createElement('div');
    row.className = 'formula-line';
    row.dataset.formula = formula.id;
    row.innerHTML = `
      <img src="${ASSETS[formula.left]}" alt="">
      <span>+</span>
      <img src="${ASSETS[formula.right]}" alt="">
      <span>=</span>
      <img src="${ASSETS[formula.result]}" alt="">
    `;
    list.appendChild(row);
  });
}

function renderFlowerbed() {
  const plantbox = document.getElementById('plantbox');
  plantbox.innerHTML = '';

  FORMULAS.filter(formula => formula.id !== 'seedling').forEach((formula, index) => {
    const slot = document.createElement('div');
    const flower = document.createElement('img');

    slot.className = `plant-slot slot-${index}`;
    flower.id = `bed-${formula.id}`;
    flower.className = `flowerbed-item ${formula.id}`;
    flower.src = ASSETS[formula.result];
    flower.alt = formula.id;

    slot.appendChild(flower);
    plantbox.appendChild(slot);
  });
}

function spawnSeed() {
  const seed = createPlant('seed', ASSETS.seed);
  seed.classList.add('seed');
  placeRandomly(seed);
  dropArea.appendChild(seed);
}

function spawnSeedling(x, y) {
  const seedling = createPlant('seedling', ASSETS.seedling);
  seedling.classList.add('seedling');
  placeAt(seedling, x, y);
  dropArea.appendChild(seedling);
  discover('seedling');
}

function spawnFlower(x, y) {
  const flowerType = BASE_FLOWERS[Math.floor(Math.random() * BASE_FLOWERS.length)];
  const flower = createPlant(flowerType, ASSETS[flowerType]);
  flower.classList.add('flower');
  placeAt(flower, x, y);
  dropArea.appendChild(flower);
  discover(flowerType);
}

function spawnMegaFlower(x, y, flowerType) {
  const megaFlower = createPlant(flowerType, ASSETS[flowerType]);
  megaFlower.classList.add('megaFlower');
  placeAt(megaFlower, x, y);
  dropArea.appendChild(megaFlower);
  discover(flowerType);
}

function createPlant(type, src) {
  const element = document.createElement('img');
  const counterKey = state.counters[type] === undefined ? 'megaFlower' : type;

  element.src = src;
  element.draggable = true;
  element.dataset.type = type;
  element.id = `${type}-${state.counters[counterKey]}`;
  state.counters[counterKey] += 1;

  element.addEventListener('dragstart', event => {
    event.dataTransfer.setData('id', event.target.id);
    event.target.style.opacity = '0.5';
  });

  element.addEventListener('dragend', event => {
    event.target.style.opacity = '1';
  });

  return element;
}

function placeRandomly(element) {
  const x = Math.random() * Math.max(0, dropArea.clientWidth - 30);
  const y = Math.random() * Math.max(0, dropArea.clientHeight - 30);
  placeAt(element, x, y);
}

function placeAt(element, x, y) {
  element.style.left = `${clamp(x, 0, dropArea.clientWidth - 30)}px`;
  element.style.top = `${clamp(y, 0, dropArea.clientHeight - 30)}px`;
}

function checkForCombination(movedPlant) {
  const candidates = [...dropArea.querySelectorAll('img')].filter(plant => {
    return plant !== movedPlant && isOverlapping(plant, movedPlant);
  });

  const match = candidates.find(plant => getCombination(plant.dataset.type, movedPlant.dataset.type));
  if (!match) return;

  const result = getCombination(match.dataset.type, movedPlant.dataset.type);
  const x = (parseFloat(match.style.left) + parseFloat(movedPlant.style.left)) / 2;
  const y = (parseFloat(match.style.top) + parseFloat(movedPlant.style.top)) / 2;

  match.remove();
  movedPlant.remove();

  if (result === 'seedling') {
    spawnSeedling(x, y);
  } else if (BASE_FLOWERS.includes(result)) {
    spawnFlower(x, y);
  } else {
    spawnMegaFlower(x, y, result);
  }
}

function getCombination(first, second) {
  if (first === 'seed' && second === 'seed') return 'seedling';
  if (first === 'seedling' && second === 'seedling') {
    return BASE_FLOWERS[Math.floor(Math.random() * BASE_FLOWERS.length)];
  }

  const formula = FORMULAS.find(item => {
    return (item.left === first && item.right === second) || (item.left === second && item.right === first);
  });

  return formula?.result || null;
}

function discover(flowerType) {
  if (state.discovered.has(flowerType)) return;

  state.discovered.add(flowerType);

  const formula = document.querySelector(`[data-formula="${flowerType}"]`);
  if (formula) formula.classList.add('unlocked');

  const flowerbedItem = document.getElementById(`bed-${flowerType}`);
  if (flowerbedItem) flowerbedItem.classList.add('visible');

  document.getElementById('flowerDiscovered').textContent = `You discovered a new flower: ${formatFlowerName(flowerType)}!`;
  document.getElementById('flowerImage').src = ASSETS[flowerType];
  document.getElementById('content').textContent = DESCRIPTIONS[flowerType] || 'A new magical flower has appeared in your garden.';
  box.hidden = false;
  gardenpicture.style.filter = 'blur(5px) brightness(50%)';

  reportProgress(false);

  if (state.discovered.size >= FORMULAS.length) {
    clearInterval(state.spawnTimer);
    reportProgress(true);
  }
}

function reportProgress(gameOver) {
  const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
  const score = state.discovered.size * 1000 + Math.max(0, 600 - elapsedSeconds);

  window.parent.postMessage({
    type: 'my-digital-garden-score',
    score,
    discoveries: state.discovered.size,
    gameOver
  }, '*');
}

function isOverlapping(first, second) {
  const a = first.getBoundingClientRect();
  const b = second.getBoundingClientRect();
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatFlowerName(value) {
  return value
    .replace(/flower$/, ' flower')
    .replace(/^\w/, char => char.toUpperCase());
}
