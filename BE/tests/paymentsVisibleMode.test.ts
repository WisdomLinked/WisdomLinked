import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentsVisibleMode,
  resolveStripeModeFilter,
  stripeModeMatch,
} from '../utils/paymentsVisibleMode';

test('paymentsVisibleMode defaults to live when unset', () => {
  assert.equal(paymentsVisibleMode({} as NodeJS.ProcessEnv), 'live');
  assert.equal(paymentsVisibleMode({ PAYMENTS_VISIBLE_MODE: '' } as NodeJS.ProcessEnv), 'live');
  assert.equal(paymentsVisibleMode({ PAYMENTS_VISIBLE_MODE: 'nope' } as NodeJS.ProcessEnv), 'live');
});

test('paymentsVisibleMode accepts all', () => {
  assert.equal(paymentsVisibleMode({ PAYMENTS_VISIBLE_MODE: 'all' } as NodeJS.ProcessEnv), 'all');
  assert.equal(paymentsVisibleMode({ PAYMENTS_VISIBLE_MODE: 'ALL' } as NodeJS.ProcessEnv), 'all');
});

test('resolveStripeModeFilter forces live in production mode', () => {
  const env = { PAYMENTS_VISIBLE_MODE: 'live' } as NodeJS.ProcessEnv;
  assert.equal(resolveStripeModeFilter('test', env), 'live');
  assert.equal(resolveStripeModeFilter('', env), 'live');
  assert.equal(resolveStripeModeFilter('live', env), 'live');
});

test('resolveStripeModeFilter honors client filter when all is allowed', () => {
  const env = { PAYMENTS_VISIBLE_MODE: 'all' } as NodeJS.ProcessEnv;
  assert.equal(resolveStripeModeFilter('test', env), 'test');
  assert.equal(resolveStripeModeFilter('live', env), 'live');
  assert.equal(resolveStripeModeFilter('', env), undefined);
  assert.deepEqual(stripeModeMatch('', env), {});
  assert.deepEqual(stripeModeMatch('test', env), { stripeMode: 'test' });
});
