const sgMail = require("@sendgrid/mail");
const sgClient = require("@sendgrid/client");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
sgClient.setApiKey(process.env.SENDGRID_API_KEY);

const { resolveAppBaseUrl, appAssetUrl } = require("../utils/appBaseUrl");

const noReplyEmail = "noreply@wisdomlinked.com";
const website_url = resolveAppBaseUrl();
const logo_url = appAssetUrl("wisdomlinked-logo.png");
const adminEmail = "admin@wisdomlinked.com";
const adminEmail2 = "xbwang@tamu.edu";

sendEmailNewUserAccountApproval = (userName) => {
    subject = "New User Account to be approved";
    html = `
        <p>Dear Admin,</p>
        <p>A new user account has been created and is pending approval.</p>
        <p>User Name: ${userName}</p>
        <p>Please log in to your admin account to review and approve the new user.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    sendNotificationEmail([adminEmail,adminEmail2], subject, html);
}

sendEmailUserAccountApproved = (targetEmail, userName) => {
    subject = "Your account has been approved";
    html = `
        <p>Dear ${userName},</p>
        <p>Your account has been approved by the admin.</p>
        <p>You can now log in to your account and start using the platform.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    sendNotificationEmail(targetEmail, subject, html);
}

scheduleEmailReminder = async (targetEmail, userName, title,start, duration, timeZone) => {
    subject = "You have a meeting: " + title;
    // timezone is like "America/New_York" so we need to send the date as per time zone
    const options = { timeZone: timeZone || "UTC" };
    // Convert start time to local time based on the provided timezone
    const date = new Date(start);
    const scheduledTime = Math.floor(date.getTime() / 1000) - 900; // Convert to Unix timestamp
    const dateString = date.toLocaleString("en-US", options);
    html = `
        <p>Dear ${userName},</p>
        <p>You have a meeting: ${title}.</p>
        <p>Starts at: ${dateString.toString()}</p>
        <p>Duration: ${duration} min</p>
        <p>Please log in to your account to attend the meeting.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    try {
        return await sendNotificationEmail(targetEmail, subject, html, scheduledTime);
    } catch (error) {
        console.error("Failed to schedule reminder email:", error?.message || error);
        return null;
    }
}

sendEmailMeetingAcceptance = async (targetEmail, userName, title,start, duration, timeZone, noteHtml = '') => {
    subject = "Meeting accepted :" + title;
    const options = { timeZone: timeZone || "UTC" };
    const date = new Date(start).toLocaleString("en-US", options);
    html = `
        <p>Dear ${userName},</p>
        <p>Your meeting ${title} has been accepted.</p>
        <p>Starts at: ${date.toString()}</p>
        <p>Duration: ${duration} min</p>
        ${noteHtml || ''}
        <p>Please log in to your account to view the details.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    return sendNotificationEmail(targetEmail, subject, html);
}

sendEmailMeetingRequestToExpert = (targetEmail, expertName, name,start, duration,price, newEvent, timeZone) => {
    const options = { timeZone: timeZone || "UTC" };
    const date = new Date(start).toLocaleString("en-US", options);
    if(newEvent)
    {
        subject = "New meeting request: " + name;
        html = `
        <p>Dear ${expertName},</p>
        <p>You have a new meeting request: ${name}.</p>
        <p>Starts at: ${date.toString()}</p>
        <p>Duration: ${duration} min</p>
        <p>Price: ${price}$</p>
        <p>Please log in to your account to view the details and respond to the request.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    }
    else
    {
        subject = "Meeting update request: " + name;
        html = `
        <p>Dear ${expertName},</p>
        <p>You have a meeting update request: ${name}.</p>
        <p>Starts at: ${date.toString()}</p>
        <p>Duration: ${duration} min</p>
        <p>Price: ${price}$</p>
        <p>Please log in to your account to view the details and respond to the request.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    }
    
    
    sendNotificationEmail(targetEmail, subject, html);
}

sendEmailMeetingRequestToCustomer = (targetEmail, name, customerName,start,duration,price, timeZone) => {
    subject = "New meeting request: " + name;
    const options = { timeZone: timeZone || "UTC" };
    const date = new Date(start).toLocaleString("en-US", options);
    html = `
        <p>Dear ${customerName},</p>
        <p>You have a new meeting request: ${name}.</p>
        <p>Starts at: ${date.toString()}</p>
        <p>Duration: ${duration} min</p>
        <p>Price: ${price}$</p>
        <p>Please log in to your account to view the details and respond to the request.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    sendNotificationEmail(targetEmail, subject, html);
}

sendExpertResumeFormatReminderEmail = async (expertEmail, expertName, studentName) => {
    subject = "Action needed: upload your resume as Word or PDF";
    html = `
        <p>Dear ${expertName},</p>
        <p>Students are interested in viewing your resume on WisdomLinked. A student (${studentName}) recently tried to open your resume, but the file is not in a supported format for in-browser viewing.</p>
        <p>Please update your profile and replace your resume with a <strong>Microsoft Word (.doc or .docx) or PDF</strong> file. After you upload a supported file, students will be able to view it.</p>
        <p>
            <a href="${website_url}">Log in to update your profile</a>
        </p>
        <p>Thank you,<br/>WisdomLinked</p>
    `;
    await sendNotificationEmail(expertEmail, subject, html);
}

shareMeetingId = (targetEmail, name, meetingId, title) =>{
    subject = "WisdomLinked Meet invitation";
    html = `
        <p>Dear ${name},</p>
        <p>You are invited to join a WisdomLinked Meet session: ${title}.</p>
        <p>Use the meeting ID below to join the session.</p>
        <p>Meeting Id : ${meetingId}</p>
        <p>Please log in to the website to join the meeting.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    sendNotificationEmail(targetEmail, subject, html);
}

sendPaymentConfirmationEmail = async ({ to, sessionType, sessionName, expertName, studentName, start, duration, amount, currency, receiptUrl, timeZone }) => {
    const dateStr = new Date(start).toLocaleString("en-US", {
        timeZone: timeZone || "UTC",
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    });
    const amountStr = `$${(Number(amount) / 100).toFixed(2)} ${(currency || "usd").toUpperCase()}`;
    const row = (label, value) => `
        <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top; width: 140px;">${label}</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${value}</td>
        </tr>`;
    const receiptButton = receiptUrl
        ? `<div style="text-align: center; margin: 28px 0 8px 0;">
                <a href="${receiptUrl}" style="display: inline-block; background: linear-gradient(135deg, #234C6A 0%, #456882 100%); color: #ffffff; text-decoration: none; padding: 13px 36px; border-radius: 12px; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">View your receipt</a>
            </div>`
        : "";
    const html = `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #234C6A 0%, #456882 100%); padding: 28px 24px; text-align: center;">
                <img src="${logo_url}" alt="WisdomLinked" width="180" style="max-width: 180px; height: auto; margin: 0 auto;" />
            </div>
            <div style="padding: 32px 24px;">
                <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 8px 0;">Payment confirmed</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">Thank you, ${studentName}. Your payment has been received and your session is booked. Here are the details:</p>
                <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 12px; padding: 8px 16px;" cellpadding="0" cellspacing="0">
                    <tbody style="display: table-row-group;">
                        ${row("Session type", sessionType)}
                        ${row("Session", sessionName)}
                        ${row("Expert", expertName)}
                        ${row("Student", studentName)}
                        ${row("Date &amp; time", dateStr)}
                        ${row("Duration", `${duration} min`)}
                        ${row("Amount paid", amountStr)}
                    </tbody>
                </table>
                ${receiptButton}
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">You can view and manage this session anytime by logging in to WisdomLinked.</p>
            </div>
            <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} WisdomLinked. All rights reserved.</p>
            </div>
        </div>`;
    await sendNotificationEmail(to, "Payment Confirmation - WisdomLinked", html);
}

sendNotificationEmail = async (targetEmails, subject, html,scheduledTime = null) => {
    const msg = {
      to: Array.isArray(targetEmails) ? targetEmails : [targetEmails],
      from: {
        name: "WisdomLinked Support",
        email: noReplyEmail,
      },
      subject: subject,
      html: html,
    };

    if (scheduledTime) {
        // scheduleTime should be a Unix timestamp
        msg.sendAt = scheduledTime;
    }
    try {
      const response = await sgMail.send(msg);
      if (scheduledTime) {
        console.log("Scheduled email queued via SendGrid:", response[0].statusCode);
      } else {
        console.log("Notification email sent via SendGrid:", response[0].statusCode);
      }
    } catch (error) {
      console.error("Error sending notification email via SendGrid:", error.message);
      throw error;
    }
}

module.exports = {
    sendEmailMeetingRequestToExpert,
    sendEmailMeetingRequestToCustomer,
    scheduleEmailReminder,
    sendEmailMeetingAcceptance,
    sendEmailNewUserAccountApproval,
    sendEmailUserAccountApproved,
    sendExpertResumeFormatReminderEmail,
    shareMeetingId,
    sendPaymentConfirmationEmail,
    sendNotificationEmail
};