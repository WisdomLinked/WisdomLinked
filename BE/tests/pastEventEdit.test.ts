import test from "node:test";
import assert from "node:assert/strict";

import {
  PAST_SEMINAR_EDIT_MESSAGE,
  PAST_SESSION_EDIT_MESSAGE,
  bookingHasEnded,
  describePastEditRejection,
} from "../utils/pastEventEdit";

const NOW = Date.parse("2026-08-10T12:00:00Z");
const past = (type: string) => ({
  type,
  start: "2026-08-01T10:00:00Z",
  end: "2026-08-01T11:00:00Z",
});
const future = (type: string) => ({
  type,
  start: "2026-09-01T10:00:00Z",
  end: "2026-09-01T11:00:00Z",
});

test("a booking is finished once its end time passes", () => {
  assert.equal(bookingHasEnded(past("seminar"), NOW), true);
  assert.equal(bookingHasEnded(future("seminar"), NOW), false);
});

test("a booking still running is not finished", () => {
  const ongoing = { type: "seminar", start: "2026-08-10T11:30:00Z", end: "2026-08-10T12:30:00Z" };
  assert.equal(bookingHasEnded(ongoing, NOW), false);
});

test("a booking with no end falls back to its start", () => {
  assert.equal(bookingHasEnded({ type: "individual", start: "2026-08-01T10:00:00Z" }, NOW), true);
  assert.equal(bookingHasEnded({ type: "individual", start: "2026-09-01T10:00:00Z" }, NOW), false);
});

test("a booking with no schedule at all is never treated as past", () => {
  assert.equal(bookingHasEnded({ type: "individual" }, NOW), false);
});

test("editing a finished seminar's details is rejected", () => {
  assert.equal(
    describePastEditRejection(past("seminar"), { price: 40 }, NOW),
    PAST_SEMINAR_EDIT_MESSAGE,
  );
});

test("a finished 1:1 gets the session wording, not the seminar wording", () => {
  assert.equal(
    describePastEditRejection(past("individual"), { start: "2026-08-02T10:00:00Z" }, NOW),
    PAST_SESSION_EDIT_MESSAGE,
  );
});

test("upcoming bookings stay editable", () => {
  assert.equal(describePastEditRejection(future("seminar"), { price: 40 }, NOW), null);
});

test("community rooms have no schedule, so they are never frozen", () => {
  assert.equal(
    describePastEditRejection({ ...past("community") }, { name: "renamed" }, NOW),
    null,
  );
});

test("the post-meeting time tally may still be written to a finished booking", () => {
  assert.equal(describePastEditRejection(past("seminar"), { totalTimeSpent: 30 }, NOW), null);
});

test("a time tally bundled with a real edit is still rejected", () => {
  assert.equal(
    describePastEditRejection(past("seminar"), { totalTimeSpent: 30, price: 40 }, NOW),
    PAST_SEMINAR_EDIT_MESSAGE,
  );
});

test("an empty update on a finished booking is a no-op, not an error", () => {
  assert.equal(describePastEditRejection(past("seminar"), {}, NOW), null);
});

test("every schedule and money field is covered, not just price", () => {
  for (const field of ["start", "end", "duration", "maxAttendees", "status", "name"]) {
    assert.equal(
      describePastEditRejection(past("seminar"), { [field]: 1 }, NOW),
      PAST_SEMINAR_EDIT_MESSAGE,
      `${field} should be frozen on a finished seminar`,
    );
  }
});
