import test from "node:test";
import assert from "node:assert/strict";

const template = require("../services/emailTemplate");
const notifications = require("../services/notifications");

const sent: Array<{ to: any; subject: string; html: string }> = [];
const recorder = async (to: any, subject: string, html: string) => {
  sent.push({ to, subject, html });
};
notifications.sendNotificationEmail = recorder;
(globalThis as any).sendNotificationEmail = recorder;

const IN_2_DAYS = new Date(Date.now() + 48 * 3600_000);
const IN_1_DAY = new Date(Date.now() + 24 * 3600_000);

const reset = () => {
  sent.length = 0;
};
const last = () => sent[sent.length - 1];
const text = (html: string) =>
  html.replace(/<[^<>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

test("every email carries the same branded shell", () => {
  const html = template.renderEmail({
    heading: "A heading",
    blocks: [template.paragraph("Some body copy.")],
  });

  assert.match(html, /#12294A/i, "the header band is painted, so a blocked image still reads as brand");
  assert.match(html, /A heading/);
  assert.match(html, /Some body copy\./);
  assert.match(html, /do not reply/i, "the automated-message footer is present");
});

test("the header never depends on a remote URL", () => {
  const html = template.renderEmail({ heading: "A heading", blocks: [] });

  assert.doesNotMatch(
    html,
    /<img[^>]+src="https?:\/\//i,
    "a hot-linked logo breaks whenever the site does not serve the asset",
  );

  const attachments = template.emailAttachments();
  if (attachments.length) {
    assert.match(html, /src="cid:wisdomlinked-header"/, "the embedded image is referenced by content id");
    assert.equal(attachments[0].disposition, "inline");
    assert.equal(attachments[0].content_id, template.HEADER_CID);
    assert.equal(attachments[0].type, "image/png");
    assert.ok(attachments[0].content.length > 0, "the image is actually embedded");
  } else {
    assert.match(html, /Wisdom<span/, "with no asset present the banner degrades to a styled wordmark");
    assert.doesNotMatch(html, /<img/, "never emit an <img> that cannot resolve");
  }
});

test("the header asset ships inside the backend package", () => {
  const fs = require("fs");
  const path = require("path");
  const asset = path.join(__dirname, "..", "assets", "email-header.png");

  assert.ok(
    fs.existsSync(asset),
    "BE/assets/email-header.png must exist — the Docker build context is ./BE, so an asset under FE/ is absent from the running image",
  );

  const buffer = fs.readFileSync(asset);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", "the asset is a real PNG");
  assert.ok(buffer.length < 60 * 1024, "the header rides along in every email, so keep it small");

  const attachments = template.emailAttachments();
  assert.equal(attachments.length, 1, "the header resolves without EMAIL_HEADER_IMAGE being set");
});

test("a delivery failure is absorbed, never left as an unhandled rejection", async () => {
  const rejections: any[] = [];
  const onRejection = (err: any) => rejections.push(err);
  process.on("unhandledRejection", onRejection);

  const failing = async () => {
    throw new Error("SendGrid is down");
  };
  notifications.sendNotificationEmail = failing;
  (globalThis as any).sendNotificationEmail = failing;

  try {
    await notifications.sendEmailMeetingRequestToExpert(
      "e@x.com", "Dr Wang", "Strategy call", IN_2_DAYS, 60, 120, true, "UTC", "hold",
      { studentName: "Mei", decisionDeadline: IN_1_DAY },
    );
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(rejections, [], "a notification must never take the request down with it");
  } finally {
    process.off("unhandledRejection", onRejection);
    notifications.sendNotificationEmail = recorder;
    (globalThis as any).sendNotificationEmail = recorder;
  }
});

test("content from users is escaped, not injected into the markup", () => {
  const html = template.renderEmail({
    heading: '<script>alert(1)</script>',
    blocks: [template.facts([["Session", '<img onerror=x>']])],
  });

  const lowered = html.toLowerCase();
  assert.ok(!lowered.includes("<script"), "no script tag survives, in any casing");
  assert.ok(!lowered.includes("<img onerror"), "no event handler survives");
  assert.match(html, /&lt;script&gt;/);
});

test("money is always rendered as a plain, complete amount", () => {
  assert.equal(template.money(59), "$59.00");
  assert.equal(template.money(59, "usd"), "$59.00");
  assert.equal(template.moneyFromCents(12000), "$120.00");
  assert.equal(template.money(0), "$0.00");
  assert.equal(template.money(undefined), "$0.00");
});

test("empty fact rows are dropped rather than printed blank", () => {
  const html = template.facts([
    ["Session", "Strategy call"],
    ["Expert", ""],
    ["Duration", null],
  ]);
  assert.match(html, /Strategy call/);
  assert.doesNotMatch(html, /Expert/);
  assert.doesNotMatch(html, /Duration/);
});

test("a request that holds money never reads like a receipt", async () => {
  reset();
  await notifications.sendEmailMeetingRequestToExpert(
    "e@x.com", "Dr Wang", "Strategy call", IN_2_DAYS, 60, 120, true, "UTC", "hold",
    { studentName: "Mei", decisionDeadline: IN_1_DAY },
  );

  const body = text(last().html);
  assert.doesNotMatch(body, /receipt/i, "rule 1: no receipt language before money moves");
  assert.doesNotMatch(body, /\brefund/i, "rule 2: a hold is not a refund");
  assert.match(body, /has not been charged/i, "the money state is stated plainly");
});

test("a pending request names the other party and the automatic outcome", async () => {
  reset();
  await notifications.sendEmailMeetingRequestToExpert(
    "e@x.com", "Dr Wang", "Strategy call", IN_2_DAYS, 60, 120, true, "UTC", "wallet",
    { studentName: "Mei Chen", decisionDeadline: IN_1_DAY },
  );

  const body = text(last().html);
  assert.match(body, /Mei Chen/, "rule 3: the student is named");
  assert.match(body, /take no action before the deadline/i, "rule 4: the do-nothing outcome is stated");
  assert.match(body, /expires automatically/i);
  assert.match(last().subject, /respond to a session request by/i, "the deadline is in the subject");
});

test("a wallet request is explicit that nothing has been collected", async () => {
  reset();
  await notifications.sendEmailMeetingRequestToExpert(
    "e@x.com", "Dr Wang", "Strategy call", IN_2_DAYS, 60, 120, true, "UTC", "wallet",
    { studentName: "Mei", decisionDeadline: IN_1_DAY },
  );

  assert.match(text(last().html), /Nothing has been collected yet/i);
});

test("the offer to a student never presents the price as a charge already made", async () => {
  reset();
  await notifications.sendEmailMeetingRequestToCustomer(
    "s@x.com", "Strategy call", "Mei", IN_2_DAYS, 60, 120, "UTC", IN_1_DAY,
    { expertName: "Dr Wang" },
  );

  const body = text(last().html);
  assert.match(last().subject, /Dr Wang has invited you/i, "the expert is named in the subject");
  assert.match(body, /Nothing has been charged/i);
  assert.match(body, /Total charge if you accept/i, "the amount is conditional, not a total due");
  assert.doesNotMatch(body, /receipt/i);
});

test("the confirmation receipt is the one place an amount is stated as paid", async () => {
  reset();
  await notifications.sendPaymentConfirmationEmail({
    to: "s@x.com",
    sessionType: "1:1 Session",
    sessionName: "Strategy call",
    expertName: "Dr Wang",
    studentName: "Mei",
    start: IN_2_DAYS,
    duration: 60,
    amount: 12000,
    currency: "usd",
    receiptUrl: "https://example.com/r",
    receiptNumber: "123-456",
    paymentMethod: "WeChat Pay",
    timeZone: "UTC",
  });

  const body = text(last().html);
  assert.match(last().subject, /\$120\.00 charged/, "the subject names what was bought and for how much");
  assert.doesNotMatch(last().subject, /^Payment Confirmation - WisdomLinked$/);
  assert.match(body, /\$120\.00/);
  assert.match(body, /WeChat Pay/, "the method the student actually used is named");
  assert.match(body, /View your receipt/i);
});

test("a seminar receipt and a 1:1 receipt do not share one anonymous subject", async () => {
  reset();
  const base = {
    to: "s@x.com",
    expertName: "Dr Wang",
    studentName: "Mei",
    start: IN_2_DAYS,
    duration: 60,
    amount: 4900,
    currency: "usd",
    timeZone: "UTC",
  };
  await notifications.sendPaymentConfirmationEmail({ ...base, sessionType: "Seminar", sessionName: "Grad Apps" });
  const seminarSubject = last().subject;
  await notifications.sendPaymentConfirmationEmail({ ...base, sessionType: "1:1 Session", sessionName: "Strategy call" });
  const oneToOneSubject = last().subject;

  assert.notEqual(seminarSubject, oneToOneSubject);
  assert.match(seminarSubject, /Grad Apps/);
  assert.match(oneToOneSubject, /Dr Wang/);
});

test("an expert learns their offer was sent and what happens if it is ignored", async () => {
  reset();
  await notifications.sendEmailSessionOfferSentToExpert(
    "e@x.com", "Dr Wang", "Mei Chen", "Strategy call", IN_2_DAYS, 60, 120, "UTC", IN_1_DAY,
  );

  const body = text(last().html);
  assert.match(body, /Mei Chen/);
  assert.match(body, /do not respond/i, "rule 4 again: the silent outcome is spelled out");
  assert.match(body, /removed automatically/i);
  assert.doesNotMatch(body, /receipt/i);
});
