import './style.css';
import {
  CELL_SIZE,
  COLS,
  HOME_COLUMNS,
  ROWS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createGame,
  laneOccupiesColumn,
  renderGameToText,
} from './game-core.js';
import { advanceWithPilot } from './autopilot.js';

const params = new URLSearchParams(window.location.search);
const manualClock = params.get('manual_clock') === '1';
const scriptedDemo = params.get('scripted_demo') === '1';
const game = createGame({ seed: 20260507 });

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="page-shell">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Daily Classic Game · 2026-05-07</p>
        <h1>Frogger: Wrap-around Lanes</h1>
        <p class="lede">
          A deterministic Frogger remix where traffic, rafts, and even your panic sidesteps loop cleanly
          from one edge of the board to the other.
        </p>
        <div class="pill-row">
          <span class="pill">Arrows / WASD to move</span>
          <span class="pill">P to pause</span>
          <span class="pill">R to reset</span>
        </div>
      </div>
      <div class="stage-panel">
        <canvas id="game-canvas" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}" aria-label="Frogger wrap-around lanes board"></canvas>
      </div>
    </section>

    <section class="meta-grid">
      <article class="panel">
        <h2>Scoreboard</h2>
        <dl class="stat-grid">
          <div>
            <dt>Mode</dt>
            <dd id="mode-value">title</dd>
          </div>
          <div>
            <dt>Score</dt>
            <dd id="score-value">0</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd id="best-value">0</dd>
          </div>
          <div>
            <dt>Round</dt>
            <dd id="round-value">1</dd>
          </div>
          <div>
            <dt>Wraps</dt>
            <dd id="wraps-value">0</dd>
          </div>
          <div>
            <dt>Homes</dt>
            <dd id="homes-value">0 / 4</dd>
          </div>
        </dl>
      </article>

      <article class="panel">
        <h2>Controls</h2>
        <div class="controls-grid">
          <button type="button" data-action="start">Start</button>
          <button type="button" data-action="pause">Pause</button>
          <button type="button" data-action="reset">Reset</button>
          <button type="button" data-action="up">Up</button>
          <button type="button" data-action="left">Left</button>
          <button type="button" data-action="down">Down</button>
          <button type="button" data-action="right">Right</button>
        </div>
        <p class="panel-note">
          Tunnel wraps award +25. New rows award +10. Banking a home awards 120 minus a small clock tax.
        </p>
      </article>

      <article class="panel">
        <h2>Deterministic Proof</h2>
        <pre id="proof-output"></pre>
      </article>

      <article class="panel panel-wide">
        <h2>Event Feed</h2>
        <ul id="event-feed" class="event-feed"></ul>
      </article>
    </section>
  </main>
`;

const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const modeValue = document.querySelector('#mode-value');
const scoreValue = document.querySelector('#score-value');
const bestValue = document.querySelector('#best-value');
const roundValue = document.querySelector('#round-value');
const wrapsValue = document.querySelector('#wraps-value');
const homesValue = document.querySelector('#homes-value');
const proofOutput = document.querySelector('#proof-output');
const eventFeed = document.querySelector('#event-feed');

function laneForRow(snapshot, row) {
  return snapshot.lanes.find((lane) => lane.row === row) ?? null;
}

function drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle = null) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawBoard(snapshot) {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const skyGradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  skyGradient.addColorStop(0, '#12312c');
  skyGradient.addColorStop(1, '#08120f');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let row = 0; row < ROWS; row += 1) {
    const y = row * CELL_SIZE;
    const lane = laneForRow(snapshot, row);
    let fill = '#22452f';

    if (row === 0) {
      fill = '#2d6a4f';
    } else if (lane?.type === 'river') {
      fill = lane.color;
    } else if (lane?.type === 'road') {
      fill = '#2a2329';
    } else if (row === 8 || row === 9) {
      fill = '#32593f';
    }

    ctx.fillStyle = fill;
    ctx.fillRect(0, y, WORLD_WIDTH, CELL_SIZE);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + CELL_SIZE);
    ctx.lineTo(WORLD_WIDTH, y + CELL_SIZE);
    ctx.stroke();

    if (lane?.type === 'road') {
      ctx.strokeStyle = 'rgba(255, 241, 118, 0.28)';
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.moveTo(0, y + CELL_SIZE / 2);
      ctx.lineTo(WORLD_WIDTH, y + CELL_SIZE / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  for (let index = 0; index < HOME_COLUMNS.length; index += 1) {
    const homeCol = HOME_COLUMNS[index];
    const x = homeCol * CELL_SIZE;
    const filled = snapshot.homesFilled[index];
    drawRoundedRect(
      x + 8,
      8,
      CELL_SIZE - 16,
      CELL_SIZE - 16,
      14,
      filled ? '#93e98a' : 'rgba(255,255,255,0.12)',
      filled ? '#d7ffbf' : 'rgba(255,255,255,0.12)'
    );
  }

  for (const lane of snapshot.lanes) {
    for (let col = 0; col < COLS; col += 1) {
      if (!laneOccupiesColumn(lane, col)) {
        continue;
      }

      const x = col * CELL_SIZE + 4;
      const y = lane.row * CELL_SIZE + 7;
      const width = CELL_SIZE - 8;
      const height = CELL_SIZE - 14;
      const color = lane.segments.find((segment) => {
        const cells = [];
        for (let offset = 0; offset < segment.length; offset += 1) {
          cells.push((segment.start + offset + COLS) % COLS);
        }
        return cells.includes(col);
      })?.color;

      drawRoundedRect(
        x,
        y,
        width,
        height,
        14,
        color ?? '#f4f1de',
        lane.type === 'river' ? 'rgba(8,24,34,0.6)' : 'rgba(255,255,255,0.12)'
      );
    }
  }

  const frogX = snapshot.frog.col * CELL_SIZE + CELL_SIZE / 2;
  const frogY = snapshot.frog.row * CELL_SIZE + CELL_SIZE / 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(frogX, frogY + 14, 17, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8ce99a';
  ctx.beginPath();
  ctx.ellipse(frogX, frogY + 2, 17, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d8ffdf';
  ctx.beginPath();
  ctx.arc(frogX - 7, frogY - 10, 4, 0, Math.PI * 2);
  ctx.arc(frogX + 7, frogY - 10, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#102118';
  ctx.beginPath();
  ctx.arc(frogX - 7, frogY - 10, 1.6, 0, Math.PI * 2);
  ctx.arc(frogX + 7, frogY - 10, 1.6, 0, Math.PI * 2);
  ctx.fill();

  if (snapshot.mode === 'title' || snapshot.mode === 'paused' || snapshot.mode === 'crashed') {
    ctx.fillStyle = 'rgba(4, 10, 8, 0.72)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f3df';
    ctx.font = '700 34px "Avenir Next Condensed", "Trebuchet MS", sans-serif';
    const title =
      snapshot.mode === 'title'
        ? 'Press Start'
        : snapshot.mode === 'paused'
          ? 'Paused'
          : 'Crash';
    ctx.fillText(title, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 16);
    ctx.font = '500 16px "Avenir Next", "Trebuchet MS", sans-serif';
    const body =
      snapshot.mode === 'crashed'
        ? snapshot.crashReason
        : 'Wrap off either edge to steal a shortcut and bonus score.';
    ctx.fillText(body, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 18);
  }
}

function updateDom(snapshot) {
  modeValue.textContent = snapshot.mode;
  scoreValue.textContent = String(snapshot.score);
  bestValue.textContent = String(snapshot.bestScore);
  roundValue.textContent = String(snapshot.round);
  wrapsValue.textContent = String(snapshot.wrapsUsed);
  homesValue.textContent = `${snapshot.homesFilled.filter(Boolean).length} / ${HOME_COLUMNS.length}`;
  proofOutput.textContent = renderGameToText(snapshot);
  eventFeed.innerHTML = snapshot.recentEvents
    .slice()
    .reverse()
    .map((item) => `<li>${item}</li>`)
    .join('');
}

function render() {
  const snapshot = game.getState();
  drawBoard(snapshot);
  updateDom(snapshot);
}

function performAction(action) {
  if (action === 'reset') {
    game.reset();
  } else if (action === 'pause') {
    game.togglePause();
  } else {
    game.input(action);
  }
  render();
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    performAction(button.dataset.action);
  });
});

window.addEventListener('keydown', (event) => {
  const actionMap = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    Space: 'start',
    Enter: 'start',
    KeyP: 'pause',
    KeyR: 'reset',
  };

  const action = actionMap[event.code];
  if (!action) {
    return;
  }

  event.preventDefault();
  performAction(action);
});

function advanceGame(ms) {
  if (scriptedDemo) {
    advanceWithPilot(game, ms);
  } else {
    game.advance(ms);
  }
  render();
}

window.advanceTime = (ms) => {
  advanceGame(ms);
};

window.render_game_to_text = () => renderGameToText(game.getState());

render();

if (!manualClock) {
  let previous = performance.now();

  function frame(now) {
    const delta = Math.min(now - previous, 180);
    previous = now;
    advanceGame(delta);
    window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);
}

