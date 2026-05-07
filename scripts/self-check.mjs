import assert from 'node:assert/strict';
import { advanceWithPilot } from '../src/autopilot.js';
import { createGame, renderGameToText } from '../src/game-core.js';

const game = createGame({ seed: 20260507 });
let snapshot = game.getState();

for (let index = 0; index < 140; index += 1) {
  snapshot = advanceWithPilot(game, 100);
  if (snapshot.wrapsUsed > 0 && snapshot.homesFilled.some(Boolean)) {
    break;
  }
}

assert.equal(snapshot.mode, 'running');
assert(snapshot.wrapsUsed > 0, 'self-check expected one wrap bonus');
assert(snapshot.homesFilled.some(Boolean), 'self-check expected a banked home');

const payload = JSON.parse(renderGameToText(snapshot));
assert.equal(typeof payload.targetHomeColumn, 'number');

console.log(renderGameToText(snapshot));
console.log('self-check ok');

