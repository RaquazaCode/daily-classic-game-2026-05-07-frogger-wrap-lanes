import {
  ACTIONS,
  COLS,
  HOME_COLUMNS,
  PILOT_TICK_MS,
  cloneState,
  countFilledHomes,
  getNextTargetHomeIndex,
  simulateActionTick,
} from './game-core.js';

const SEARCH_HORIZON = 42;

function wrapDistance(from, to, dir) {
  if (dir === 'left') {
    return (from - to + COLS) % COLS;
  }
  return (to - from + COLS) % COLS;
}

function preferredHorizontalActions(from, to) {
  if (from === to) {
    return [];
  }

  const left = wrapDistance(from, to, 'left');
  const right = wrapDistance(from, to, 'right');

  return left <= right ? ['left', 'right'] : ['right', 'left'];
}

function chooseGoal(snapshot) {
  if (snapshot.wrapsUsed === 0) {
    return { type: 'wrap' };
  }

  return {
    type: 'home',
    homeIndex: getNextTargetHomeIndex(snapshot),
  };
}

function goalReached(snapshot, goal, baselineHomes) {
  if (goal.type === 'wrap') {
    return snapshot.wrapsUsed > 0;
  }

  return snapshot.homesFilled[goal.homeIndex] && countFilledHomes(snapshot) > baselineHomes;
}

function prioritizedActions(snapshot, goal) {
  if (goal.type === 'wrap') {
    if (snapshot.frog.col === 0) {
      return ['left', 'stay', 'up', 'right', 'down'];
    }
    return ['left', 'stay', 'up', 'right', 'down'];
  }

  const targetColumn = HOME_COLUMNS[goal.homeIndex];
  const order = [];

  if (snapshot.frog.row > 0) {
    order.push('up');
  }

  order.push(...preferredHorizontalActions(snapshot.frog.col, targetColumn));
  order.push('stay');

  if (snapshot.frog.row < 9) {
    order.push('down');
  }

  return [...new Set(order.concat(ACTIONS))];
}

function hashSnapshot(snapshot) {
  const laneKey = snapshot.lanes
    .map(
      (lane) =>
        `${lane.row}:${Math.round(lane.progressMs)}:${lane.segments
          .map((segment) => segment.start)
          .join(',')}`
    )
    .join('|');

  return [
    snapshot.mode,
    snapshot.frog.row,
    snapshot.frog.col,
    snapshot.wrapsUsed,
    snapshot.homesFilled.map((filled) => (filled ? '1' : '0')).join(''),
    laneKey,
  ].join('::');
}

function searchPlan(snapshot, goal) {
  const baselineHomes = countFilledHomes(snapshot);
  const initial = cloneState(snapshot);
  const queue = [{ state: initial, plan: [] }];
  const visited = new Set([hashSnapshot(initial)]);

  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index];

    if (goalReached(node.state, goal, baselineHomes)) {
      return node.plan;
    }

    if (node.plan.length >= SEARCH_HORIZON) {
      continue;
    }

    for (const action of prioritizedActions(node.state, goal)) {
      const next = simulateActionTick(node.state, action, PILOT_TICK_MS);
      if (next.mode === 'crashed') {
        continue;
      }

      const key = hashSnapshot(next);
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push({
        state: next,
        plan: [...node.plan, action],
      });
    }
  }

  return null;
}

export function findPilotAction(snapshot) {
  if (snapshot.mode === 'title') {
    return 'start';
  }

  if (snapshot.mode === 'paused') {
    return 'pause';
  }

  if (snapshot.mode === 'crashed') {
    return 'reset';
  }

  const goal = chooseGoal(snapshot);
  const plan = searchPlan(snapshot, goal);
  return plan?.[0] ?? 'stay';
}

export function advanceWithPilot(game, ms) {
  let remaining = Math.max(0, Number(ms) || 0);

  while (remaining > 0) {
    const tick = Math.min(PILOT_TICK_MS, remaining);
    const snapshot = game.getState();
    const action = findPilotAction(snapshot);

    if (action === 'reset') {
      game.reset();
    } else if (action && action !== 'stay') {
      game.input(action);
    } else if (snapshot.mode === 'title') {
      game.input('start');
    }

    game.advance(tick);
    remaining -= tick;
  }

  return game.getState();
}

