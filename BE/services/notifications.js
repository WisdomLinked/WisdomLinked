const sgMail = require("@sendgrid/mail");
const sgClient = require("@sendgrid/client");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
sgClient.setApiKey(process.env.SENDGRID_API_KEY);

const noReplyEmail = "noreply@wisdomlinked.com";
const website_url = "https://wisdomlinked.com";
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

scheduleEmailReminder = (targetEmail, userName, title,start, duration, timeZone) => {
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
    sendNotificationEmail(targetEmail, subject, html, scheduledTime);
}

sendEmailMeetingAcceptance = (targetEmail, userName, title,start, duration, timeZone) => {
    subject = "Meeting accepted :" + title;
    const options = { timeZone: timeZone || "UTC" };
    const date = new Date(start).toLocaleString("en-US", options);
    html = `
        <p>Dear ${userName},</p>
        <p>Your meeting ${title} has been accepted.</p>
        <p>Starts at: ${date.toString()}</p>
        <p>Duration: ${duration} min</p>
        <p>Please log in to your account to view the details.</p>
        <p>
            <a href="${website_url}">Visit Website</a>
        </p>
    `;
    sendNotificationEmail(targetEmail, subject, html);
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
    sendEmailUserAccountApproved
};