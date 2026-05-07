import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceWithPilot } from '../src/autopilot.js';
import { createGame, renderGameToText } from '../src/game-core.js';

test('pilot earns a wrap bonus and banks at least one home', () => {
  const game = createGame({ seed: 20260507 });
  let snapshot = game.getState();

  for (let index = 0; index < 120; index += 1) {
    snapshot = advanceWithPilot(game, 100);
    if (snapshot.wrapsUsed > 0 && snapshot.homesFilled.some(Boolean)) {
      break;
    }
  }

  assert.equal(snapshot.mode, 'running');
  assert(snapshot.wrapsUsed > 0, 'expected at least one wrap tunnel use');
  assert(snapshot.homesFilled.some(Boolean), 'expected at least one home banked');
  assert(snapshot.score >= 155, `expected score to reflect wrap + home, got ${snapshot.score}`);
});

test('pause freezes time and reset restores the title state', () => {
  const game = createGame({ seed: 20260507 });
  advanceWithPilot(game, 1600);

  const live = game.getState();
  assert.equal(live.mode, 'running');

  game.togglePause();
  const pausedBefore = game.getState();
  game.advance(2000);
  const pausedAfter = game.getState();

  assert.equal(pausedAfter.elapsedMs, pausedBefore.elapsedMs);
  assert.deepEqual(pausedAfter.frog, pausedBefore.frog);

  game.reset();
  const reset = game.getState();
  assert.equal(reset.mode, 'title');
  assert.equal(reset.score, 0);
  assert.equal(reset.frog.row, 9);
  assert.equal(reset.frog.col, 5);
  assert(reset.bestScore >= live.score);
});

test('render_game_to_text exposes the deterministic proof fields', () => {
  const game = createGame({ seed: 20260507 });
  advanceWithPilot(game, 2200);
  const payload = JSON.parse(renderGameToText(game.getState()));

  assert.equal(typeof payload.mode, 'string');
  assert.equal(typeof payload.score, 'number');
  assert.equal(typeof payload.targetHomeColumn, 'number');
  assert.equal(typeof payload.wrapsUsed, 'number');
  assert(Array.isArray(payload.recentEvents));
});

