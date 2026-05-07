export const COLS = 11;
export const ROWS = 10;
export const CELL_SIZE = 52;
export const WORLD_WIDTH = COLS * CELL_SIZE;
export const WORLD_HEIGHT = ROWS * CELL_SIZE;
export const FIXED_STEP_MS = 50;
export const PILOT_TICK_MS = 100;
export const START_ROW = 9;
export const START_COL = 5;
export const HOME_COLUMNS = [1, 4, 7, 9];
export const HOME_TARGET_ORDER = [2, 0, 3, 1];
export const ACTIONS = ['stay', 'up', 'left', 'right', 'down'];

const ROAD_ROWS = new Set([5, 6, 7]);
const RIVER_ROWS = new Set([1, 2, 3]);

const LANE_BLUEPRINTS = [
  {
    row: 1,
    type: 'river',
    label: 'Glider eels',
    dir: 1,
    intervalMs: 800,
    color: '#4cc9f0',
    segments: [
      { start: 1, length: 3, color: '#6fd6ff' },
      { start: 6, length: 3, color: '#93e7ff' },
    ],
  },
  {
    row: 2,
    type: 'river',
    label: 'Moss rafts',
    dir: -1,
    intervalMs: 650,
    color: '#4895ef',
    segments: [
      { start: 2, length: 3, color: '#8fd47c' },
      { start: 8, length: 2, color: '#9fe18b' },
    ],
  },
  {
    row: 3,
    type: 'river',
    label: 'Stone barges',
    dir: 1,
    intervalMs: 520,
    color: '#3a86ff',
    segments: [
      { start: 0, length: 4, color: '#e0c56e' },
      { start: 6, length: 3, color: '#f2d27a' },
    ],
  },
  {
    row: 5,
    type: 'road',
    label: 'Taxi lane',
    dir: -1,
    intervalMs: 540,
    color: '#6b2d5c',
    segments: [
      { start: 2, length: 2, color: '#ff6b6b' },
      { start: 7, length: 2, color: '#ffd166' },
    ],
  },
  {
    row: 6,
    type: 'road',
    label: 'Bus lane',
    dir: 1,
    intervalMs: 460,
    color: '#7b2f00',
    segments: [
      { start: 0, length: 2, color: '#ff9f1c' },
      { start: 4, length: 2, color: '#2ec4b6' },
      { start: 8, length: 2, color: '#e71d36' },
    ],
  },
  {
    row: 7,
    type: 'road',
    label: 'Scooter lane',
    dir: -1,
    intervalMs: 620,
    color: '#5f0f40',
    segments: [
      { start: 1, length: 2, color: '#9b5de5' },
      { start: 6, length: 2, color: '#f15bb5' },
    ],
  },
];

function mod(value, size) {
  return ((value % size) + size) % size;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function cloneSegment(segment) {
  return {
    start: segment.start,
    length: segment.length,
    color: segment.color,
  };
}

function cloneLane(lane) {
  return {
    row: lane.row,
    type: lane.type,
    label: lane.label,
    dir: lane.dir,
    intervalMs: lane.intervalMs,
    progressMs: lane.progressMs,
    color: lane.color,
    segments: lane.segments.map(cloneSegment),
  };
}

export function cloneState(state) {
  return {
    seed: state.seed,
    mode: state.mode,
    elapsedMs: state.elapsedMs,
    score: state.score,
    bestScore: state.bestScore,
    round: state.round,
    wrapsUsed: state.wrapsUsed,
    laneShiftCount: state.laneShiftCount,
    crashReason: state.crashReason,
    homesFilled: [...state.homesFilled],
    lastSavedHomeIndex: state.lastSavedHomeIndex,
    currentTripBestRow: state.currentTripBestRow,
    frog: {
      row: state.frog.row,
      col: state.frog.col,
    },
    recentEvents: [...state.recentEvents],
    lanes: state.lanes.map(cloneLane),
  };
}

function createFreshState(seed, sessionBestScore = 0) {
  return {
    seed,
    mode: 'title',
    elapsedMs: 0,
    score: 0,
    bestScore: sessionBestScore,
    round: 1,
    wrapsUsed: 0,
    laneShiftCount: 0,
    crashReason: null,
    homesFilled: Array.from({ length: HOME_COLUMNS.length }, () => false),
    lastSavedHomeIndex: null,
    currentTripBestRow: START_ROW,
    frog: {
      row: START_ROW,
      col: START_COL,
    },
    recentEvents: [
      'Press Space or Enter to start.',
      'Use arrows or WASD. P pauses. R resets.',
      'Wrap off the left or right edge for a tunnel bonus.',
    ],
    lanes: LANE_BLUEPRINTS.map((lane) => ({
      ...lane,
      progressMs: 0,
      segments: lane.segments.map(cloneSegment),
    })),
  };
}

function syncBestScore(state) {
  state.bestScore = Math.max(state.bestScore, state.score);
}

function pushEvent(state, message) {
  state.recentEvents.push(message);
  if (state.recentEvents.length > 7) {
    state.recentEvents.shift();
  }
}

function awardScore(state, points, message) {
  state.score += points;
  syncBestScore(state);
  if (message) {
    pushEvent(state, `${message} +${points}.`);
  }
}

function getLaneByRow(state, row) {
  return state.lanes.find((lane) => lane.row === row) ?? null;
}

function segmentCells(segment) {
  const cells = [];
  for (let offset = 0; offset < segment.length; offset += 1) {
    cells.push(mod(segment.start + offset, COLS));
  }
  return cells;
}

export function laneOccupiesColumn(lane, col) {
  return lane.segments.some((segment) => segmentCells(segment).includes(mod(col, COLS)));
}

function moveSegment(segment, dir) {
  segment.start = mod(segment.start + dir, COLS);
}

function moveFrogHorizontal(state, delta, contextLabel) {
  const next = state.frog.col + delta;
  const wrapped = mod(next, COLS);
  const didWrap = wrapped !== next;
  state.frog.col = wrapped;

  if (didWrap) {
    state.wrapsUsed += 1;
    awardScore(state, 25, `Wrap tunnel used via ${contextLabel}`);
  }
}

function resetFrogForNextTrip(state) {
  state.frog.row = START_ROW;
  state.frog.col = START_COL;
  state.currentTripBestRow = START_ROW;
}

function crash(state, reason) {
  if (state.mode === 'crashed') {
    return;
  }
  syncBestScore(state);
  state.mode = 'crashed';
  state.crashReason = reason;
  pushEvent(state, `Crash: ${reason}. Press R to reset.`);
}

function maybeAwardProgress(state) {
  if (state.frog.row < state.currentTripBestRow) {
    state.currentTripBestRow = state.frog.row;
    awardScore(state, 10, 'Forward progress');
  }
}

function resolveHomeRow(state) {
  const homeIndex = HOME_COLUMNS.indexOf(state.frog.col);
  if (homeIndex === -1) {
    crash(state, 'missed the lily home');
    return;
  }

  if (state.homesFilled[homeIndex]) {
    crash(state, 'landed on an occupied lily home');
    return;
  }

  state.homesFilled[homeIndex] = true;
  state.lastSavedHomeIndex = homeIndex;
  const timePenalty = Math.min(50, Math.floor(state.elapsedMs / 1000) * 4);
  awardScore(state, 120 - timePenalty, `Home ${HOME_COLUMNS[homeIndex]} secured`);
  pushEvent(state, `Frog banked at column ${HOME_COLUMNS[homeIndex]}.`);
  resetFrogForNextTrip(state);

  if (state.homesFilled.every(Boolean)) {
    state.round += 1;
    awardScore(state, 150, 'All homes banked');
    state.homesFilled = Array.from({ length: HOME_COLUMNS.length }, () => false);
    state.lastSavedHomeIndex = null;
    for (const lane of state.lanes) {
      lane.intervalMs = Math.max(280, lane.intervalMs - 18);
    }
    pushEvent(state, `Round ${state.round} begins with faster wrap lanes.`);
  }
}

function resolveCurrentTile(state) {
  if (state.mode !== 'running') {
    return;
  }

  if (state.frog.row === 0) {
    resolveHomeRow(state);
    return;
  }

  const lane = getLaneByRow(state, state.frog.row);
  if (!lane) {
    return;
  }

  if (ROAD_ROWS.has(state.frog.row) && laneOccupiesColumn(lane, state.frog.col)) {
    crash(state, `${lane.label.toLowerCase()} clipped the frog`);
    return;
  }

  if (RIVER_ROWS.has(state.frog.row) && !laneOccupiesColumn(lane, state.frog.col)) {
    crash(state, 'splashed into open river water');
  }
}

function beginRunIfNeeded(state) {
  if (state.mode === 'title') {
    state.mode = 'running';
    pushEvent(state, 'Run started. Use the wrap tunnels to steal time back.');
  }
}

export function applyActionInPlace(state, action) {
  if (action === 'pause') {
    if (state.mode === 'running') {
      state.mode = 'paused';
      pushEvent(state, 'Paused.');
    } else if (state.mode === 'paused') {
      state.mode = 'running';
      pushEvent(state, 'Resumed.');
    }
    return;
  }

  if (action === 'start') {
    beginRunIfNeeded(state);
    return;
  }

  if (action === 'stay') {
    beginRunIfNeeded(state);
    return;
  }

  beginRunIfNeeded(state);

  if (state.mode !== 'running') {
    return;
  }

  if (action === 'up') {
    state.frog.row = clamp(state.frog.row - 1, 0, ROWS - 1);
  } else if (action === 'down') {
    state.frog.row = clamp(state.frog.row + 1, 0, ROWS - 1);
  } else if (action === 'left') {
    moveFrogHorizontal(state, -1, 'manual hop');
  } else if (action === 'right') {
    moveFrogHorizontal(state, 1, 'manual hop');
  }

  maybeAwardProgress(state);
  resolveCurrentTile(state);
}

export function advanceStateInPlace(state, ms) {
  if (state.mode !== 'running') {
    return;
  }

  state.elapsedMs += ms;

  for (const lane of state.lanes) {
    lane.progressMs += ms;
    while (lane.progressMs >= lane.intervalMs) {
      lane.progressMs -= lane.intervalMs;

      if (lane.type === 'river' && state.frog.row === lane.row) {
        if (!laneOccupiesColumn(lane, state.frog.col)) {
          crash(state, 'river support drifted away');
          return;
        }
      }

      for (const segment of lane.segments) {
        moveSegment(segment, lane.dir);
      }

      state.laneShiftCount += 1;

      if (lane.type === 'river' && state.frog.row === lane.row) {
        moveFrogHorizontal(state, lane.dir, lane.label.toLowerCase());
      }

      resolveCurrentTile(state);
      if (state.mode !== 'running') {
        return;
      }
    }
  }
}

export function simulateActionTick(snapshot, action, ms = PILOT_TICK_MS) {
  const next = cloneState(snapshot);
  applyActionInPlace(next, action);

  let remaining = ms;
  while (remaining > 0 && next.mode === 'running') {
    const step = Math.min(FIXED_STEP_MS, remaining);
    advanceStateInPlace(next, step);
    remaining -= step;
  }

  return next;
}

export function countFilledHomes(snapshot) {
  return snapshot.homesFilled.filter(Boolean).length;
}

export function getNextTargetHomeIndex(snapshot) {
  return HOME_TARGET_ORDER.find((homeIndex) => !snapshot.homesFilled[homeIndex]) ?? HOME_TARGET_ORDER[0];
}

export function renderGameToText(snapshot) {
  const targetHomeIndex = getNextTargetHomeIndex(snapshot);

  return JSON.stringify(
    {
      mode: snapshot.mode,
      score: snapshot.score,
      bestScore: snapshot.bestScore,
      round: snapshot.round,
      wrapsUsed: snapshot.wrapsUsed,
      laneShiftCount: snapshot.laneShiftCount,
      elapsedMs: round(snapshot.elapsedMs),
      frog: snapshot.frog,
      filledHomes: HOME_COLUMNS.filter((_, index) => snapshot.homesFilled[index]),
      targetHomeColumn: HOME_COLUMNS[targetHomeIndex],
      crashReason: snapshot.crashReason,
      recentEvents: snapshot.recentEvents,
    },
    null,
    2
  );
}

export function createGame({ seed = 20260507 } = {}) {
  let state = createFreshState(seed);

  function snapshot() {
    return cloneState(state);
  }

  return {
    getState() {
      return snapshot();
    },
    input(action) {
      applyActionInPlace(state, action);
      return snapshot();
    },
    advance(ms) {
      let remaining = Math.max(0, Number(ms) || 0);
      while (remaining > 0 && state.mode === 'running') {
        const step = Math.min(FIXED_STEP_MS, remaining);
        advanceStateInPlace(state, step);
        remaining -= step;
      }
      return snapshot();
    },
    togglePause() {
      applyActionInPlace(state, 'pause');
      return snapshot();
    },
    reset() {
      const bestScore = Math.max(state.bestScore, state.score);
      state = createFreshState(seed, bestScore);
      return snapshot();
    },
  };
}

