const canvas = document.getElementById("game-canvas");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("start-button");
const settingsButton = document.getElementById("settings-button");
const calmModeInput = document.getElementById("calm-mode");
const minimalModeInput = document.getElementById("minimal-mode");
const steadySpeedInput = document.getElementById("steady-speed");
const centeredGapsInput = document.getElementById("centered-gaps");
const fixedGapInput = document.getElementById("fixed-gap");
const gridSnapInput = document.getElementById("grid-snap");
const reducedMotionInput = document.getElementById("reduced-motion");
const soundOnInput = document.getElementById("sound-on");

const ctx = canvas.getContext("2d");

const gameState = {
  running: false,
  lastTime: 0,
  delta: 0,
  score: 0,
  best: Number(localStorage.getItem("flappy-breeze-best")) || 0,
  speed: 180,
  gravity: 980,
  jump: -320,
};

const bird = {
  x: 0,
  y: 0,
  radius: 18,
  velocity: 0,
};

const pipes = {
  list: [],
  width: 70,
  gap: 170,
  spacing: 260,
  offset: 0,
};

const colors = {
  skyTop: "#7cc7ff",
  skyBottom: "#b2e6ff",
  pipe: "#3cba54",
  pipeShadow: "#2d8d3f",
  ground: "#3b2e21",
  groundHighlight: "#4a3a2a",
  bird: "#ffda57",
  birdAccent: "#f58f3c",
};

const settings = {
  calmMode: true,
  minimalMode: false,
  steadySpeed: true,
  centeredGaps: false,
  fixedGap: true,
  gridSnap: true,
  reducedMotion: false,
  soundOn: true,
};

const particles = [];
let audioContext;
let resumeRequested = false;

function loadSettings() {
  Object.keys(settings).forEach((key) => {
    const stored = localStorage.getItem(`flappy-breeze-${key}`);
    if (stored !== null) {
      settings[key] = stored === "true";
    }
  });
}

function syncSettingsUI() {
  calmModeInput.checked = settings.calmMode;
  minimalModeInput.checked = settings.minimalMode;
  steadySpeedInput.checked = settings.steadySpeed;
  centeredGapsInput.checked = settings.centeredGaps;
  fixedGapInput.checked = settings.fixedGap;
  gridSnapInput.checked = settings.gridSnap;
  reducedMotionInput.checked = settings.reducedMotion;
  soundOnInput.checked = settings.soundOn;
}

function saveSetting(key, value) {
  settings[key] = value;
  localStorage.setItem(`flappy-breeze-${key}`, String(value));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;
  ctx.scale(scale, scale);

  bird.x = rect.width * 0.35;
  bird.y = rect.height * 0.5;
  pipes.spacing = rect.width * (settings.calmMode ? 0.75 : 0.6);
  pipes.gap = Math.max(140, rect.height * 0.22);
  pipes.width = Math.max(60, rect.width * 0.16);
  pipes.offset = rect.width + 100;
}

function resetGame() {
  gameState.score = 0;
  gameState.speed = settings.calmMode ? 150 : 180;
  bird.y = canvas.getBoundingClientRect().height * 0.5;
  bird.velocity = 0;
  pipes.list = [];
  particles.length = 0;
  for (let i = 0; i < 4; i += 1) {
    pipes.list.push(createPipe(i));
  }
  updateScore();
}

function createPipe(index) {
  const rect = canvas.getBoundingClientRect();
  const gapSize = settings.fixedGap ? pipes.gap : Math.max(140, rect.height * (0.18 + Math.random() * 0.12));
  const minTop = rect.height * 0.18;
  const maxTop = rect.height * 0.62;
  let topHeight = minTop + Math.random() * (maxTop - minTop);
  if (settings.centeredGaps) {
    topHeight = (rect.height - gapSize) / 2;
  }
  if (settings.gridSnap) {
    const gridSize = Math.max(12, Math.floor(rect.height / 22));
    topHeight = Math.round(topHeight / gridSize) * gridSize;
  }
  return {
    x: rect.width + index * pipes.spacing,
    top: topHeight,
    gap: gapSize,
    passed: false,
  };
}

function updateScore() {
  scoreEl.textContent = gameState.score;
  bestScoreEl.textContent = gameState.best;
}

function startGame() {
  overlay.classList.add("overlay--hidden");
  gameState.running = true;
  gameState.lastTime = performance.now();
  resetGame();
  requestAnimationFrame(loop);
}

function stopGame() {
  gameState.running = false;
  gameState.best = Math.max(gameState.best, gameState.score);
  localStorage.setItem("flappy-breeze-best", String(gameState.best));
  updateScore();
  overlay.classList.remove("overlay--hidden");
  overlay.querySelector("h1").textContent = "Game Over";
  overlay.querySelector("p").textContent =
    "Tap or press space to try again.";
  startButton.textContent = "Restart";
}

function flap() {
  if (!gameState.running) {
    startGame();
    return;
  }
  bird.velocity = gameState.jump;
}

function handleInput(event) {
  if (event.type === "keydown" && event.code !== "Space") {
    return;
  }
  event.preventDefault();
  if (settings.soundOn) {
    ensureAudio();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  }
  flap();
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playChime() {
  if (!settings.soundOn) {
    return;
  }
  ensureAudio();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(640, audioContext.currentTime);
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.22);
}

function spawnParticles(x, y) {
  if (settings.minimalMode) {
    return;
  }
  for (let i = 0; i < 6; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 80,
      vy: -60 - Math.random() * 50,
      life: 0.6,
    });
  }
}

function popScore() {
  scoreEl.classList.remove("score-pop");
  void scoreEl.offsetWidth;
  scoreEl.classList.add("score-pop");
}

function update(delta) {
  const rect = canvas.getBoundingClientRect();
  bird.velocity += gameState.gravity * delta;
  bird.y += bird.velocity * delta;

  pipes.list.forEach((pipe) => {
    pipe.x -= gameState.speed * delta;
    if (!pipe.passed && pipe.x + pipes.width < bird.x) {
      pipe.passed = true;
      gameState.score += 1;
      if (!settings.steadySpeed) {
        gameState.speed += 4;
      }
      updateScore();
      popScore();
      playChime();
      spawnParticles(pipe.x + pipes.width / 2, pipe.top + pipe.gap / 2);
    }
  });

  const firstPipe = pipes.list[0];
  if (firstPipe && firstPipe.x + pipes.width < 0) {
    pipes.list.shift();
    pipes.list.push(createPipe(pipes.list.length));
  }

  const groundHeight = rect.height * 0.12;
  if (bird.y + bird.radius > rect.height - groundHeight) {
    stopGame();
  }

  if (bird.y - bird.radius < 0) {
    bird.y = bird.radius;
    bird.velocity = 0;
  }

  for (const pipe of pipes.list) {
    const inX = bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + pipes.width;
    const gapTop = pipe.top;
    const gapBottom = pipe.top + pipe.gap;
    const hitTop = bird.y - bird.radius < gapTop;
    const hitBottom = bird.y + bird.radius > gapBottom;
    if (inX && (hitTop || hitBottom)) {
      stopGame();
      break;
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 120 * delta;
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
  skyGradient.addColorStop(0, colors.skyTop);
  skyGradient.addColorStop(1, colors.skyBottom);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height);

  if (settings.minimalMode) {
    ctx.fillStyle = "#5b9fe2";
    pipes.list.forEach((pipe) => {
      ctx.fillRect(pipe.x, 0, pipes.width, pipe.top);
      ctx.fillRect(
        pipe.x,
        pipe.top + pipe.gap,
        pipes.width,
        height - pipe.top - pipe.gap
      );
    });
  } else {
    const brickSize = Math.max(10, Math.floor(pipes.width / 4));
    const brickColors = {
      base: "#b86b41",
      shade: "#a85c34",
      highlight: "#d98a5f",
    };

    const drawBrickColumn = (x, y, columnHeight) => {
      const rows = Math.ceil(columnHeight / brickSize);
      const cols = Math.ceil(pipes.width / brickSize);
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const brickX = x + col * brickSize;
          const brickY = y + row * brickSize;
          const brickWidth = Math.min(brickSize, x + pipes.width - brickX);
          const brickHeight = Math.min(brickSize, y + columnHeight - brickY);

          ctx.fillStyle = brickColors.base;
          ctx.fillRect(brickX, brickY, brickWidth, brickHeight);

          ctx.fillStyle = brickColors.highlight;
          ctx.fillRect(brickX + 1, brickY + 1, brickWidth - 2, Math.max(1, brickHeight / 4));

          ctx.fillStyle = brickColors.shade;
          ctx.fillRect(
            brickX + Math.max(1, brickWidth - 3),
            brickY + 2,
            Math.max(1, brickWidth / 6),
            Math.max(1, brickHeight - 4)
          );
        }
      }
    };

    pipes.list.forEach((pipe) => {
      drawBrickColumn(pipe.x, 0, pipe.top);
      drawBrickColumn(pipe.x, pipe.top + pipe.gap, height - pipe.top - pipe.gap);
    });
  }

  const groundHeight = height * 0.12;
  const groundY = height - groundHeight;
  if (settings.minimalMode) {
    ctx.fillStyle = "#4fb961";
    ctx.fillRect(0, groundY, width, groundHeight);
  } else {
    const grassPixel = Math.max(6, Math.floor(groundHeight / 6));
    const grassColors = ["#3fa34d", "#4fb961", "#2f8f3f"];

    for (let y = groundY; y < height; y += grassPixel) {
      for (let x = 0; x < width; x += grassPixel) {
        const color = grassColors[(x / grassPixel + y / grassPixel) % grassColors.length];
        ctx.fillStyle = color;
        ctx.fillRect(x, y, grassPixel, grassPixel);
      }
    }

    ctx.fillStyle = "#67d272";
    ctx.fillRect(0, groundY, width, Math.max(6, Math.floor(grassPixel / 2)));
  }

  ctx.fillStyle = settings.minimalMode ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.6)";
  particles.forEach((particle) => {
    ctx.fillRect(particle.x, particle.y, 4, 4);
  });

  ctx.save();
  ctx.translate(bird.x, bird.y);
  const rotation = settings.reducedMotion
    ? 0
    : Math.min(Math.max(bird.velocity / 600, -0.6), 0.6);
  ctx.rotate(rotation);

  const pixelSize = Math.max(2, Math.floor(bird.radius / 6));
  const pineapple = [
    [0, 0, 0, 2, 0, 0, 0],
    [0, 0, 2, 3, 2, 0, 0],
    [0, 2, 2, 3, 2, 2, 0],
    [0, 2, 1, 1, 1, 2, 0],
    [2, 1, 1, 4, 1, 1, 2],
    [2, 1, 4, 4, 4, 1, 2],
    [2, 1, 4, 4, 4, 1, 2],
    [2, 1, 1, 4, 1, 1, 2],
    [0, 2, 1, 1, 1, 2, 0],
    [0, 0, 2, 2, 2, 0, 0],
  ];

  const pineappleColors = {
    1: "#f4c542",
    2: "#d48a1b",
    3: "#2faa6c",
    4: "#f4e17a",
  };

  const offsetX = -(pineapple[0].length * pixelSize) / 2;
  const offsetY = -(pineapple.length * pixelSize) / 2;
  pineapple.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === 0) {
        return;
      }
      ctx.fillStyle = pineappleColors[cell];
      ctx.fillRect(
        offsetX + colIndex * pixelSize,
        offsetY + rowIndex * pixelSize,
        pixelSize,
        pixelSize
      );
    });
  });

  ctx.restore();
}

function loop(timestamp) {
  if (!gameState.running) {
    return;
  }
  gameState.delta = Math.min((timestamp - gameState.lastTime) / 1000, 0.02);
  gameState.lastTime = timestamp;

  update(gameState.delta);
  draw();

  requestAnimationFrame(loop);
}

function init() {
  loadSettings();
  syncSettingsUI();
  resizeCanvas();
  updateScore();
  resetGame();
  draw();
}

window.addEventListener("resize", () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  resizeCanvas();
  resetGame();
  draw();
});

canvas.addEventListener("pointerdown", handleInput);
window.addEventListener("keydown", handleInput);
startButton.addEventListener("click", () => {
  if (resumeRequested) {
    overlay.classList.add("overlay--hidden");
    gameState.running = true;
    gameState.lastTime = performance.now();
    resumeRequested = false;
    requestAnimationFrame(loop);
  } else {
    startGame();
  }
});
settingsButton.addEventListener("click", () => {
  overlay.classList.remove("overlay--hidden");
  overlay.querySelector("h1").textContent = "Settings";
  overlay.querySelector("p").textContent = "Adjust visuals and gameplay comfort.";
  resumeRequested = gameState.running;
  startButton.textContent = resumeRequested ? "Resume" : "Start";
  gameState.running = false;
});

[
  calmModeInput,
  minimalModeInput,
  steadySpeedInput,
  centeredGapsInput,
  fixedGapInput,
  gridSnapInput,
  reducedMotionInput,
  soundOnInput,
].forEach((input) => {
  input.addEventListener("change", (event) => {
    const { id, checked } = event.target;
    const keyMap = {
      "calm-mode": "calmMode",
      "minimal-mode": "minimalMode",
      "steady-speed": "steadySpeed",
      "centered-gaps": "centeredGaps",
      "fixed-gap": "fixedGap",
      "grid-snap": "gridSnap",
      "reduced-motion": "reducedMotion",
      "sound-on": "soundOn",
    };
    const settingKey = keyMap[id];
    if (settingKey) {
      saveSetting(settingKey, checked);
      resizeCanvas();
      resetGame();
      draw();
    }
  });
});

init();
