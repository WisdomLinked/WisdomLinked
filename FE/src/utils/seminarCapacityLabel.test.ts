import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seminarCapacityLabel, seminarEnrollmentLabel } from './seminarCapacityLabel';

test('capped seminar shows filled and remaining seats', () => {
  assert.equal(seminarCapacityLabel(0, 10), '0 of 10 seats filled · 10 left');
  assert.equal(seminarCapacityLabel(3, 10), '3 of 10 seats filled · 7 left');
  assert.equal(seminarCapacityLabel(9, 10), '9 of 10 seats filled · 1 left');
});

test('a full seminar reads Full instead of a remaining count', () => {
  assert.equal(seminarCapacityLabel(10, 10), '10 of 10 seats filled · Full');
});

test('overflow past the cap still reads Full', () => {
  assert.equal(seminarCapacityLabel(11, 10), '11 of 10 seats filled · Full');
});

test('no cap set shows enrolled count with no limit', () => {
  assert.equal(seminarCapacityLabel(3, null), '3 enrolled · no limit');
  assert.equal(seminarCapacityLabel(0, 0), '0 enrolled · no limit');
  assert.equal(seminarCapacityLabel(5, undefined), '5 enrolled · no limit');
});

test('enrollment label shows enrolled/waiting/cap', () => {
  assert.equal(seminarEnrollmentLabel(18, 4, 15), 'Enrollments/waiting/Cap (18/4/15)');
  assert.equal(seminarEnrollmentLabel(8, 0, 15), 'Enrollments/waiting/Cap (8/0/15)');
});

test('enrollment label uses infinity when no cap is set', () => {
  assert.equal(seminarEnrollmentLabel(8, 0, null), 'Enrollments/waiting/Cap (8/0/∞)');
  assert.equal(seminarEnrollmentLabel(3, 2, undefined), 'Enrollments/waiting/Cap (3/2/∞)');
});
