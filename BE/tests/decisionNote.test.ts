import test from "node:test";
import assert from "node:assert/strict";

import {
  DECISION_NOTE_MAX_LENGTH,
  decisionNoteEmailBlock,
  decisionNoteHtml,
  sanitizeDecisionNote,
} from "../utils/decisionNote";

test("a plain note survives untouched", () => {
  assert.equal(
    sanitizeDecisionNote("Would 2:30pm Aug 19 work?"),
    "Would 2:30pm Aug 19 work?",
  );
});

test("non-strings and blank input become an empty note", () => {
  assert.equal(sanitizeDecisionNote(undefined), "");
  assert.equal(sanitizeDecisionNote(null), "");
  assert.equal(sanitizeDecisionNote(42), "");
  assert.equal(sanitizeDecisionNote({ note: "hi" }), "");
  assert.equal(sanitizeDecisionNote("   \n\n  "), "");
});

test("markup is stripped rather than kept, so the email never carries a tag", () => {
  assert.equal(
    sanitizeDecisionNote('<script>alert(1)</script>Message me in Chat'),
    "alert(1) Message me in Chat",
  );
  assert.equal(sanitizeDecisionNote('<img src=x onerror=y>'), "");
});

test("a note longer than the limit is truncated, not rejected", () => {
  const long = "a".repeat(DECISION_NOTE_MAX_LENGTH + 50);
  assert.equal(sanitizeDecisionNote(long).length, DECISION_NOTE_MAX_LENGTH);
});

test("runs of spaces collapse but deliberate line breaks are kept", () => {
  assert.equal(
    sanitizeDecisionNote("Unavailable   that   week\n\nTry a week later"),
    "Unavailable that week\n\nTry a week later",
  );
});

test("control characters are dropped", () => {
  assert.equal(sanitizeDecisionNote("ok\u0000\u0007then"), "okthen");
});

test("the sanitized note is still entity-escaped before it reaches HTML", () => {
  assert.equal(
    decisionNoteHtml('Ben & Jo said "no" <yet>'),
    "Ben &amp; Jo said &quot;no&quot; &lt;yet&gt;",
  );
  assert.equal(decisionNoteHtml("line one\nline two"), "line one<br />line two");
});

test("an empty note produces no email block at all", () => {
  assert.equal(decisionNoteEmailBlock(""), "");
});

test("the email block carries the note and the chosen heading", () => {
  const block = decisionNoteEmailBlock("Try a week later", "Message from the host");
  assert.ok(block.includes("Message from the host"));
  assert.ok(block.includes("Try a week later"));
});
