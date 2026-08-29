/**
 * Render the payment emails to HTML files so the wording and layout can be
 * reviewed without sending anything.
 *
 *   npx tsx scripts/previewEmails.ts [outDir]
 *
 * Messages built inside notifications.ts are captured for real: the sender is
 * swapped for a recorder, so what lands on disk is exactly what SendGrid would
 * receive. The rest of the catalogue lives inline in the controllers and is
 * represented here by the same helpers those call sites use.
 */

import fs from 'fs';
import path from 'path';

const notifications = require('../services/notifications');
const {
    renderEmail,
    money,
    moneyFromCents,
    formatWhen,
    paragraph,
    facts,
    bullets,
    button,
    callout,
    expertNote,
    escapeHtml,
} = require('../services/emailTemplate');

type Captured = { id: string; subject: string; html: string };
const captured: Captured[] = [];
let currentId = '';

const recorder = async (_to: any, subject: string, html: string) => {
    captured.push({ id: currentId, subject, html });
};
// notifications.ts assigns its senders as implicit globals, so the internal
// calls resolve through globalThis rather than the exports object.
notifications.sendNotificationEmail = recorder;
(globalThis as any).sendNotificationEmail = recorder;

const record = (id: string, fn: () => any) => {
    currentId = id;
    return Promise.resolve(fn()).catch((err: any) => {
        console.error(`[${id}]`, err?.message || err);
    });
};

const push = (id: string, subject: string, spec: any) => {
    captured.push({ id, subject, html: renderEmail(spec) });
};

const IN_2_DAYS = new Date(Date.now() + 48 * 3600_000);
const IN_1_DAY = new Date(Date.now() + 24 * 3600_000);
const EXPERT = 'Dr Bruce Wang';
const STUDENT = 'Mei Chen';
const SEMINAR = 'Applying to US Graduate Programs';
const SESSION = 'PhD application strategy';
const INTENT = 'pi_3U7IOaFzkCxWETvY1sQBz9Kd';
const BALANCE_TXN = 'txn_3U7IOaFzkCxWETvY1LmPq4Rn';

const run = async () => {
    // --- built for real out of notifications.ts -------------------------------
    await record('C3 · new 1:1 request → expert (card hold)', () =>
        notifications.sendEmailMeetingRequestToExpert(
            'e@x.com', EXPERT, SESSION, IN_2_DAYS, 60, 120, true, 'UTC', 'hold',
            { studentName: STUDENT, decisionDeadline: IN_1_DAY },
        ));

    await record('C3 · new 1:1 request → expert (wallet)', () =>
        notifications.sendEmailMeetingRequestToExpert(
            'e@x.com', EXPERT, SESSION, IN_2_DAYS, 60, 120, true, 'UTC', 'wallet',
            { studentName: STUDENT, decisionDeadline: IN_1_DAY },
        ));

    await record('D1 · expert offers a session → student', () =>
        notifications.sendEmailMeetingRequestToCustomer(
            's@x.com', SESSION, STUDENT, IN_2_DAYS, 60, 120, 'UTC', IN_1_DAY,
            { expertName: EXPERT },
        ));

    await record('D2 · offer sent → expert', () =>
        notifications.sendEmailSessionOfferSentToExpert(
            'e@x.com', EXPERT, STUDENT, SESSION, IN_2_DAYS, 60, 120, 'UTC', IN_1_DAY,
        ));

    await record('D4 · student accepted and paid → expert', () =>
        notifications.sendEmailSessionPaidToExpert(
            'e@x.com', EXPERT, STUDENT, SESSION, IN_2_DAYS, 60, 120, 'UTC', INTENT, BALANCE_TXN,
        ));

    await record('A2 · enrolled, card charged → student (receipt)', () =>
        notifications.sendPaymentConfirmationEmail({
            to: 's@x.com', sessionType: 'Seminar', sessionName: SEMINAR,
            expertName: EXPERT, studentName: STUDENT, start: IN_2_DAYS, duration: 90,
            amount: 4900, currency: 'usd', receiptUrl: 'https://example.com/receipt',
            receiptNumber: '2381-4471', paymentMethod: 'Credit card', timeZone: 'UTC',
            transactionId: INTENT, balanceTransaction: BALANCE_TXN,
        }));

    await record('C4/D3 · 1:1 confirmed → student (receipt)', () =>
        notifications.sendPaymentConfirmationEmail({
            to: 's@x.com', sessionType: '1:1 Session', sessionName: SESSION,
            expertName: EXPERT, studentName: STUDENT, start: IN_2_DAYS, duration: 60,
            amount: 12000, currency: 'usd', receiptUrl: 'https://example.com/receipt',
            receiptNumber: '2381-4472', paymentMethod: 'WeChat Pay', timeZone: 'UTC',
            transactionId: INTENT, balanceTransaction: BALANCE_TXN,
        }));

    // --- representative of the controller-side messages ----------------------
    push('B1 · seat request sent, card held → student', 'Request submitted — no charge processed', {
        heading: `You are on the waiting list for ${SEMINAR}`,
        blocks: [
            paragraph('Your request to join this fully booked seminar has been received and is on the waiting list.'),
            facts([['Seminar', SEMINAR], ['Hosted by', EXPERT], ['Date & time', formatWhen(IN_2_DAYS, 'UTC')], ['Host responds by', formatWhen(IN_1_DAY, 'UTC')]]),
            callout(`<strong>No charge has been made.</strong> A temporary authorization of ${money(49)} is held on your card.`),
            bullets([
                `If ${escapeHtml(EXPERT)} <strong>approves</strong>, the ${money(49)} authorization is charged and your seat is confirmed.`,
                'If they <strong>decline</strong>, or do not respond before the deadline, the authorization is released automatically and no charge is made.',
            ]),
            button('View your requests'),
        ],
    });

    push('B5 · approved, wallet, pay by deadline → student', `Approved — pay by ${IN_1_DAY.toLocaleString()} to confirm your seat`, {
        heading: 'Your request has been approved',
        blocks: [
            paragraph(`${escapeHtml(EXPERT)} has approved your request to join <strong>${escapeHtml(SEMINAR)}</strong>.`),
            facts([['Seminar', SEMINAR], ['Hosted by', EXPERT], ['Payment due', `${money(49)} by Alipay or WeChat Pay`], ['Payment deadline', formatWhen(IN_1_DAY, 'UTC')]]),
            callout('Your seat is confirmed only once payment completes. If it is not received by the deadline, this approval expires automatically, the seat is released and no charge is made.', 'warn'),
            expertNote('Happy to make room for you — please come with your CV.', "Host's note"),
            button(`Pay ${money(49)}`),
        ],
    });

    push('B7 · declined by the host → student', 'Request declined — no charge processed', {
        heading: 'Your request was not approved',
        blocks: [
            paragraph(`${escapeHtml(EXPERT)} was unable to offer you a seat for <strong>${escapeHtml(SEMINAR)}</strong>.`),
            facts([['Seminar', SEMINAR], ['Date & time', formatWhen(IN_2_DAYS, 'UTC')]]),
            callout('Your payment hold has been released and you were not charged.'),
            expertNote('Sorry — the room is genuinely at capacity this time.', "Host's note"),
            button('Browse seminars'),
        ],
    });

    push('B10 · enrolment failed after the charge → student', `Not able to complete your booking — ${money(49)} refunded`, {
        heading: "We couldn't complete your registration",
        blocks: [
            paragraph(`Your request to join <strong>${escapeHtml(SEMINAR)}</strong> was approved by ${escapeHtml(EXPERT)}, but a system issue stopped us completing your registration. You have <strong>not</strong> been enrolled.`),
            facts([['Seminar', SEMINAR], ['Reference', 'a1b2c3d4e5f6'], ['Transaction ID', INTENT]]),
            callout(`Your refund of <strong>${money(49)}</strong> has been issued. It will be credited to your original payment method and may take 5–10 business days to appear, depending on your bank.`, 'bad'),
            paragraph('If you would still like to attend, please try again, or contact the administrator through WisdomLinked quoting the reference above.'),
        ],
    });

    push('E1 · the last seat was just taken → student', 'The last seat was just taken — no charge processed', {
        heading: 'The last seat was just taken',
        blocks: [
            paragraph(`Another participant secured the last available seat just before your reservation completed, so your reservation for <strong>${escapeHtml(SEMINAR)}</strong> was cancelled.`),
            facts([['Seminar', SEMINAR], ['Date & time', formatWhen(IN_2_DAYS, 'UTC')]]),
            callout('No charge has been made to your account. The temporary authorization on your card has been released.'),
            button('View the seminar'),
        ],
    });

    push('E6/E8 · paid session cancelled → student', `Session cancelled — ${money(120)} refunded`, {
        heading: 'Your session has been cancelled',
        blocks: [
            paragraph(`<strong>${escapeHtml(SESSION)}</strong> has been cancelled by the expert.`),
            facts([['Session', SESSION], ['Expert', EXPERT], ['Refunded', money(120)], ['Reference', 'a1b2c3d4e5f6'], ['Transaction ID', INTENT]]),
            callout(`Your payment of <strong>${money(120)}</strong> has been refunded in full. It will be credited to your original payment method and may take 5–10 business days to appear. No action is required from you.`, 'bad'),
        ],
    });

    push('E9 · admin sends a payment link → student', `Payment requested — ${money(75)} due`, {
        heading: 'Payment requested',
        blocks: [
            paragraph(`Hello ${escapeHtml(STUDENT)},`),
            facts([['Amount', money(75)], ['For', 'Additional consultation time']]),
            button(`Pay ${money(75)}`, 'https://example.com/pay'),
            paragraph('Payment is handled securely by Stripe. You will receive a confirmation email once it has been processed.', { muted: true }),
        ],
    });

    // --- write it all out -----------------------------------------------------
    const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'email-previews'));
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    // The real emails reference the header as a cid: attachment, which a browser
    // cannot resolve — swap in a data URI so the preview shows what recipients see.
    const attachment = require('../services/emailTemplate').emailAttachments()[0];
    const forBrowser = (html: string) =>
        attachment
            ? html.replace(/cid:wisdomlinked-header/g, `data:image/png;base64,${attachment.content}`)
            : html;

    const rows: string[] = [];
    captured.forEach((mail, i) => {
        const file = `${String(i + 1).padStart(2, '0')}-${mail.id.split('·')[0].trim().replace(/[^A-Za-z0-9]+/g, '-')}.html`;
        fs.writeFileSync(path.join(outDir, file), forBrowser(mail.html), 'utf8');
        rows.push(`<tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E5E2DB;"><a href="${file}" style="color:#234C6A;font-weight:bold;text-decoration:none;">${mail.id}</a></td>
            <td style="padding:10px 14px;border-bottom:1px solid #E5E2DB;color:#5B6B77;">${mail.subject}</td>
        </tr>`);
    });

    fs.writeFileSync(
        path.join(outDir, 'index.html'),
        `<!doctype html><meta charset="utf-8"><title>WisdomLinked email previews</title>
        <body style="font-family:Arial,sans-serif;background:#F1EFEA;margin:0;padding:40px;">
        <div style="max-width:900px;margin:0 auto;background:#fff;border:1px solid #E5E2DB;border-radius:14px;padding:28px;">
        <h1 style="font-family:Georgia,serif;font-weight:normal;color:#1A3A4A;">WisdomLinked email previews</h1>
        <p style="color:#5B6B77;">${captured.length} messages. Subject lines are shown as they arrive in the inbox.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows.join('')}</table>
        </div></body>`,
        'utf8',
    );

    console.log(`Wrote ${captured.length} previews to ${outDir}`);
    console.log(`Open ${path.join(outDir, 'index.html')}`);
};

run();
