const sgMail = require("@sendgrid/mail");
const sgClient = require("@sendgrid/client");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
sgClient.setApiKey(process.env.SENDGRID_API_KEY);

const { resolveAppBaseUrl, appAssetUrl, appDashboardUrl } = require("../utils/appBaseUrl");
const {
    BRAND,
    renderEmail,
    emailAttachments,
    money: emailMoney,
    moneyFromCents: emailMoneyFromCents,
    formatWhen: emailWhen,
    paragraph: emailParagraph,
    facts: emailFacts,
    bullets: emailBullets,
    button: emailButton,
    callout: emailCallout,
    expertNote: emailExpertNote,
    studentNote: emailStudentNote,
    escapeHtml: emailEscape,
} = require("./emailTemplate");

const noReplyEmail = "noreply@wisdomlinked.com";
const website_url = resolveAppBaseUrl();
const logo_url = appAssetUrl("wisdomlinked-logo.png");
const adminEmail = "admin@wisdomlinked.com";
const adminEmail2 = "xbwang@tamu.edu";

sendEmailNewUserAccountApproval = (userName) => {
    subject = "New user account awaiting approval";
    html = renderEmail({
        heading: 'A new account is waiting for approval',
        blocks: [
            emailParagraph('Dear Admin,'),
            emailFacts([['User name', userName]]),
            emailParagraph('Please review and approve the new user from your admin dashboard.'),
            emailButton('Review the account'),
        ],
    });
    return deliver([adminEmail,adminEmail2], subject, html);
}

sendEmailUserAccountApproved = (targetEmail, userName) => {
    subject = "Your WisdomLinked account has been approved";
    html = renderEmail({
        heading: 'Your account has been approved',
        blocks: [
            emailParagraph(`Dear ${emailEscape(userName)},`),
            emailParagraph('Your account has been approved. You can now sign in and start using WisdomLinked.'),
            emailButton('Sign in'),
        ],
    });
    return deliver(targetEmail, subject, html);
}

/**
 * A session reminder, sent at the moment it is due.
 *
 * Replaces `scheduleEmailReminder`, which handed the mail to SendGrid with a
 * `sendAt` up to months ahead. SendGrid refuses anything beyond 72 hours, the
 * error was swallowed, and most reminders therefore never sent at all. The
 * reminder sweep decides *when* (see utils/sessionReminders.ts); this only
 * decides what the mail says.
 *
 * `kind` is '24h' or '15m'. Subjects differ between the two on purpose: the same
 * session sends both, and identical subject lines read as a duplicate in an inbox.
 */
sendSessionReminderEmail = async ({
    kind,
    targetEmail,
    userName,
    title,
    start,
    duration,
    timeZone,
    role,
}: any) => {
    const isDayBefore = kind === '24h';
    const subject = isDayBefore
        ? `Tomorrow: ${title}`
        : `Starting in 15 minutes: ${title}`;
    const html = renderEmail({
        heading: isDayBefore ? `Tomorrow: ${title}` : `Starting soon: ${title}`,
        previewText: isDayBefore
            ? 'Your session is tomorrow.'
            : 'Your session starts in about 15 minutes.',
        blocks: [
            emailParagraph(
                isDayBefore
                    ? `Dear ${emailEscape(userName)}, this is a reminder that your session is scheduled for tomorrow.`
                    : `Dear ${emailEscape(userName)}, this is a reminder that your session begins shortly.`,
            ),
            emailFacts([
                ['Session', title],
                ['Date & time', emailWhen(start, timeZone)],
                ['Duration', duration ? `${duration} minutes` : ''],
            ]),
            emailParagraph(
                isDayBefore
                    ? 'You can use the session chat beforehand to ask questions or share material. Video and audio become available at the scheduled start time.'
                    : 'Video and audio become available at the scheduled start time.',
                { muted: true },
            ),
            emailButton(
                isDayBefore ? 'View the session' : 'Join from your dashboard',
                appDashboardUrl(role),
            ),
        ],
    });
    return sendNotificationEmail(targetEmail, subject, html);
}

sendEmailMeetingAcceptance = async (targetEmail, userName, title,start, duration, timeZone, noteHtml = '', options: any = {}) => {
    subject = `Your session request was accepted — ${title}`;
    html = renderEmail({
        heading: 'Your session request was accepted',
        blocks: [
            emailParagraph(`Dear ${emailEscape(userName)}, your request for <strong>${emailEscape(title)}</strong> has been accepted.`),
            emailFacts([
                ['Session', title],
                ['Date & time', emailWhen(start, timeZone)],
                ['Duration', duration ? `${duration} minutes` : ''],
            ]),
            emailStudentNote(options.studentNote, 'Your note'),
            noteHtml || '',
            emailButton('View the session'),
        ],
    });
    return sendNotificationEmail(targetEmail, subject, html);
}

const deliver = (targetEmails, subject, html) =>
    Promise.resolve()
        .then(() => sendNotificationEmail(targetEmails, subject, html))
        .catch((err) => {
            console.error('[notifications] delivery failed:', subject, err?.message || err);
            return null;
        });

const decisionDeadlineText = (deadline, timeZone) => emailWhen(deadline, timeZone);

sendEmailMeetingRequestToExpert = (targetEmail, expertName, name, start, duration, price, newEvent, timeZone, paymentState, options: any = {}) => {
    const when = emailWhen(start, timeZone);
    const amount = emailMoney(price);
    const deadline = decisionDeadlineText(options.decisionDeadline, timeZone);
    const studentName = options.studentName || 'A student';
    subject = deadline
        ? `Action required: respond to a session request by ${deadline}`
        : (newEvent ? `Action required: new session request — ${name}` : `Session change request — ${name}`);

    const outcomes = paymentState === 'wallet'
        ? [
            `If you <strong>accept</strong>, ${emailEscape(studentName)} is invited to pay ${amount}. The session is confirmed once that payment completes.`,
            'If you <strong>decline</strong>, or take no action before the deadline, the request expires automatically and no charge is made.',
        ]
        : paymentState === 'hold'
            ? [
                `If you <strong>accept</strong>, the ${amount} authorization on the student's card is charged and the session is confirmed.`,
                'If you <strong>decline</strong>, or take no action before the deadline, the authorization is released automatically and no charge is made.',
            ]
            : [
                `If you <strong>accept</strong>, the session is confirmed at ${amount}.`,
                'If you <strong>decline</strong>, or take no action before the deadline, the request expires automatically and no charge is made.',
            ];

    const moneyLine = paymentState === 'paid'
        ? emailCallout(`${emailEscape(studentName)} has already paid ${amount}. This session is confirmed.`, 'good')
        : paymentState === 'wallet'
            ? emailCallout(`<strong>Nothing has been collected yet.</strong> Alipay and WeChat Pay are paid in full at the moment of payment, so we ask you first and only invite the student to pay ${amount} once you accept.`)
            : paymentState === 'hold'
                ? emailCallout(`<strong>The student has not been charged.</strong> A temporary authorization of ${amount} is held on their card and is only taken if you accept.`)
                : '';

    html = renderEmail({
        heading: newEvent
            ? `${studentName} has requested a 1:1 session with you`
            : `${studentName} has asked to change a 1:1 session`,
        previewText: paymentState === 'paid' ? 'Payment received.' : 'The student has not been charged.',
        blocks: [
            emailParagraph(`Dear ${emailEscape(expertName)},`),
            emailFacts([
                ['Session', name],
                ['Date & time', when],
                ['Duration', duration ? `${duration} minutes` : ''],
                ['Total charge', amount],
                ['Respond by', deadline],
            ]),
            emailStudentNote(options.studentNote),
            moneyLine,
            paymentState === 'paid'
                ? ''
                : emailParagraph(`Please accept or decline this request from your dashboard${deadline ? ` by <strong>${emailEscape(deadline)}</strong>` : ''}.`),
            paymentState === 'paid' ? '' : emailBullets(outcomes),
            emailButton(paymentState === 'paid' ? 'View the session' : 'Review the request'),
        ],
    });

    return deliver(targetEmail, subject, html);
}

sendEmailSessionPaidToExpert = (targetEmail, expertName, studentName, name, start, duration, price, timeZone, transactionId, balanceTransaction, options: any = {}) => {
    const who = studentName || 'The student';
    subject = `Your session offer was accepted — payment received`;
    html = renderEmail({
        heading: `${who} accepted your offer and completed payment`,
        previewText: 'Your session is confirmed.',
        blocks: [
            emailParagraph(`Dear ${emailEscape(expertName)}, your session is confirmed.`),
            emailFacts([
                ['Session', name],
                ['Date & time', emailWhen(start, timeZone)],
                ['Duration', duration ? `${duration} minutes` : ''],
                ['Student payment', emailMoney(price)],
                ['Transaction ID', transactionId],
                ['Balance transaction', balanceTransaction],
            ]),
            emailStudentNote(options.studentNote),
            emailParagraph('We will send you reminders before the session begins. You can open the session chat at any time beforehand to share preparation notes or documents.'),
            emailParagraph('The chat is a convenience only — neither side is required to read or reply before the session, and video and audio become available at the scheduled start time.', { muted: true }),
            emailButton('View the session'),
        ],
    });
    return deliver(targetEmail, subject, html);
}

sendEmailSessionOfferSentToExpert = (targetEmail, expertName, studentName, name, start, duration, price, timeZone, payBy) => {
    const who = studentName || 'the student';
    const deadline = emailWhen(payBy, timeZone);
    subject = `Your session offer was sent to ${who}`;
    html = renderEmail({
        heading: `Your session offer was sent to ${who}`,
        previewText: 'We will let you know as soon as they respond.',
        blocks: [
            emailParagraph(`Dear ${emailEscape(expertName)}, we have sent your session offer to ${emailEscape(who)}.`),
            emailFacts([
                ['Session', name],
                ['Date & time', emailWhen(start, timeZone)],
                ['Duration', duration ? `${duration} minutes` : ''],
                ['Price', emailMoney(price)],
                ['They must respond by', deadline],
            ]),
            emailBullets([
                'If they <strong>accept and pay</strong>, the session appears on your dashboard and calendar automatically, and you will get reminders before it starts.',
                `If they <strong>decline</strong>, or do not respond${deadline ? ' before the deadline' : ''}, no charge is made and the pending session is removed automatically.`,
            ]),
            emailParagraph('We will email you as soon as they respond.', { muted: true }),
            emailButton('View your pending offers'),
        ],
    });
    return deliver(targetEmail, subject, html);
}

sendEmailMeetingRequestToCustomer = (targetEmail, name, customerName, start, duration, price, timeZone, payBy, options: any = {}) => {
    const expertLabel = options.expertName || 'An expert';
    const deadline = emailWhen(payBy, timeZone);
    subject = `${expertLabel} has invited you to a 1:1 session`;
    html = renderEmail({
        heading: `${expertLabel} would like to meet with you`,
        previewText: 'Nothing has been charged.',
        blocks: [
            emailParagraph(`Dear ${emailEscape(customerName)},`),
            emailFacts([
                ['Session', name],
                ['Expert', options.expertName],
                ['Date & time', emailWhen(start, timeZone)],
                ['Duration', duration ? `${duration} minutes` : ''],
                ['Total charge if you accept', emailMoney(price)],
                ['Respond by', deadline],
            ]),
            emailExpertNote(options.note),
            emailCallout('<strong>Nothing has been charged.</strong> You are only charged when you accept this offer and complete payment.'),
            emailParagraph('To reserve this session, accept the offer and complete payment from your dashboard.'),
            emailBullets([
                `If you <strong>accept and pay</strong>${deadline ? ` by ${emailEscape(deadline)}` : ''}, the session is confirmed.`,
                'If you <strong>decline</strong>, or the deadline passes, the offer expires automatically and no charge is made.',
            ]),
            emailButton('Review the offer'),
        ],
    });
    return deliver(targetEmail, subject, html);
}

sendExpertResumeFormatReminderEmail = async (expertEmail, expertName, studentName) => {
    subject = "Action needed: upload your resume as Word or PDF";
    html = renderEmail({
        heading: 'Please re-upload your resume in a supported format',
        blocks: [
            emailParagraph(`Dear ${emailEscape(expertName)},`),
            emailParagraph(`Students are interested in your resume. ${emailEscape(studentName)} recently tried to open it, but the file is not in a format we can display in the browser.`),
            emailParagraph('Please replace it with a <strong>Microsoft Word (.doc or .docx) or PDF</strong> file. Students will be able to view it as soon as you do.'),
            emailButton('Update your profile'),
        ],
    });
    await sendNotificationEmail(expertEmail, subject, html);
}

shareMeetingId = (targetEmail, name, meetingId, title) =>{
    subject = `You are invited to join ${title}`;
    html = renderEmail({
        heading: `You are invited to join ${title}`,
        blocks: [
            emailParagraph(`Dear ${emailEscape(name)}, you have been invited to a WisdomLinked meeting.`),
            emailFacts([['Session', title], ['Meeting ID', meetingId]]),
            emailButton('Join from WisdomLinked'),
        ],
    });
    return deliver(targetEmail, subject, html);
}

sendPaymentConfirmationEmail = async ({ to, sessionType, sessionName, expertName, studentName, start, duration, amount, currency, receiptUrl, receiptNumber, timeZone, paymentMethod, transactionId, balanceTransaction, noteHtml = '', noteText = '', studentNote = '', receiptPageUrl = '' }) => {
    const isSeminar = String(sessionType || '').toLowerCase().includes('seminar');
    const amountStr = emailMoneyFromCents(amount, currency);
    const subjectLine = isSeminar
        ? `Booking successful — ${amountStr} charged for ${sessionName}`
        : `Your session with ${expertName || 'your expert'} is confirmed — ${amountStr} charged`;

    const beforeHeading = isSeminar ? 'Before the seminar' : 'Before your session';
    const chatWord = isSeminar ? 'seminar' : 'session';

    const html = renderEmail({
        heading: isSeminar
            ? `You are confirmed for ${sessionName}`
            : `Your 1:1 session with ${expertName || 'your expert'} is confirmed`,
        previewText: `${amountStr} charged. Your ${chatWord} is confirmed.`,
        blocks: [
            emailParagraph(`Thank you, ${emailEscape(studentName)}. Your payment of <strong>${amountStr}</strong> has been processed and your ${chatWord} is confirmed. No further action is needed.`),
            emailFacts([
                [isSeminar ? 'Seminar' : 'Session', sessionName],
                [isSeminar ? 'Hosted by' : 'Expert', expertName],
                ['Date & time', emailWhen(start, timeZone)],
                ['Duration', duration ? `${duration} minutes` : ''],
                ['Amount paid', amountStr],
                ['Payment method', paymentMethod],
                ['Receipt no.', receiptNumber],
                ['Transaction ID', transactionId],
                ['Balance transaction', balanceTransaction],
            ]),
            emailStudentNote(studentNote, 'Your note'),
            noteHtml || emailExpertNote(noteText),
            receiptPageUrl
                ? emailButton('View your receipt', receiptPageUrl)
                : receiptUrl
                    ? emailButton('View your receipt', receiptUrl)
                    : emailButton(`View the ${chatWord}`),
            receiptPageUrl && receiptUrl
                ? emailParagraph(`You can also open the <a href="${receiptUrl}" style="color:${BRAND.accent};">payment record from Stripe</a>, our payment processor.`, { muted: true })
                : '',
            emailParagraph(`<strong>${beforeHeading}</strong>`),
            emailParagraph(`You can open this ${chatWord} at any time from your calendar or dashboard. Before the start time you can use the ${chatWord} chat to ask questions, share information or upload documents.`),
            emailParagraph(`The chat is provided for convenience only — participants are not required to read or reply to messages before the ${chatWord} begins. Video and audio become available at the scheduled start time.`, { muted: true }),
        ],
    });
    await sendNotificationEmail(to, subjectLine, html);
}

/**
 * Send now. There is deliberately no scheduled-send path: SendGrid's `sendAt`
 * refuses anything more than 72h ahead and cannot be cancelled without a
 * batch_id, which silently broke every session reminder booked further out.
 * Reminders are timed by services/sessionReminderSweep.ts instead.
 */
sendNotificationEmail = async (targetEmails, subject, html) => {
    const msg: any = {
      to: Array.isArray(targetEmails) ? targetEmails : [targetEmails],
      from: {
        name: "WisdomLinked Support",
        email: noReplyEmail,
      },
      subject: subject,
      html: html,
    };
    const inlineHeader = emailAttachments();
    if (inlineHeader.length) msg.attachments = inlineHeader;

    try {
      const response = await sgMail.send(msg);
      console.log("Notification email sent via SendGrid:", response[0].statusCode);
    } catch (error) {
      console.error("Error sending notification email via SendGrid:", error.message);
      throw error;
    }
}

module.exports = {
    sendEmailMeetingRequestToExpert,
    sendEmailSessionPaidToExpert,
    sendEmailSessionOfferSentToExpert,
    sendEmailMeetingRequestToCustomer,
    sendSessionReminderEmail,
    sendEmailMeetingAcceptance,
    sendEmailNewUserAccountApproval,
    sendEmailUserAccountApproved,
    sendExpertResumeFormatReminderEmail,
    shareMeetingId,
    sendPaymentConfirmationEmail,
    sendNotificationEmail
};