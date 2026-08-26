const sgMail = require("@sendgrid/mail");
const {
  renderEmail: renderUtilEmail,
  emailAttachments: utilAttachments,
  paragraph: utilParagraph,
  button: utilButton,
} = require("./emailTemplate");

const adminEmail = "admin@wisdomlinked.com";
const noReplyEmail = "noreply@wisdomlinked.com";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getCurrentDateString = () => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

exports.sendOTP = async (targetEmail, todays_date_str, smurf_details_str) => {
  const msg = {
    to: targetEmail,
    from: {
      name: "WisdomLinked Support",
      email: noReplyEmail,
    },
    subject: "Login Verification - WisdomLinked",
    html: smurf_details_str,
  };
  try {
    const inlineHeader = utilAttachments();
    if (inlineHeader.length) (msg as any).attachments = inlineHeader;
    const response = await sgMail.send(msg);

  } catch (error) {
    console.error("Error sending OTP email via SendGrid:", error.message);
    console.error("Error details:", error.response ? error.response.body : error);
  }
};

exports.sendMagicLink = async (targetEmail, todays_date_str, smurf_details_str) => {
  const msg = {
    to: targetEmail,
    from: {
      name: "WisdomLinked Support",
      email: noReplyEmail,
    },
    subject: "Verify Your Email - WisdomLinked",
    html: smurf_details_str,
  };
  try {
    const inlineHeader = utilAttachments();
    if (inlineHeader.length) (msg as any).attachments = inlineHeader;
    await sgMail.send(msg);
  } catch (error) {
    console.error("Error sending Magic Link email via SendGrid:", error.message);
  }
};

exports.sendPasswordResetOTP = async (targetEmail, htmlContent) => {
  const msg = {
    to: targetEmail,
    from: {
      name: "WisdomLinked Support",
      email: noReplyEmail,
    },
    subject: "Password Reset - WisdomLinked",
    html: htmlContent,
  };
  try {
    const inlineHeader = utilAttachments();
    if (inlineHeader.length) (msg as any).attachments = inlineHeader;
    await sgMail.send(msg);
  } catch (error) {
    console.error("Error sending password reset OTP via SendGrid:", error.message);
  }
};

exports.sendEmailChangeVerification = async (targetEmail, confirmCode) => {
  const link = `${process.env.FE_URL}/verify-email-change/${confirmCode}`;
  const html = renderUtilEmail({
    heading: 'Confirm your email address',
    previewText: 'This link expires in 24 hours.',
    blocks: [
      utilParagraph("You asked to set this email as the address for your WisdomLinked account. Confirm below that it's really you."),
      utilButton('Confirm email', link),
      utilParagraph("This link expires in 24 hours. If you didn't request this, you can safely ignore this email — your account is unchanged.", { muted: true }),
    ],
  });
  const msg = {
    to: targetEmail,
    from: {
      name: "WisdomLinked Support",
      email: noReplyEmail,
    },
    subject: "Confirm Your Email - WisdomLinked",
    html,
  };
  try {
    const inlineHeader = utilAttachments();
    if (inlineHeader.length) (msg as any).attachments = inlineHeader;
    await sgMail.send(msg);
  } catch (error) {
    console.error("Error sending email-change verification via SendGrid:", error.message);
    throw error;
  }
};

exports.sendContactDetails = async (targetEmail, name, email, demand) => {
  const html = `
      <h3>New Contact Request</h3>
      <ul>
        <li><strong>Name:</strong> ${name || "N/A"}</li>
        <li><strong>Email:</strong> ${email || "N/A"}</li>
        <li><strong>Demand:</strong> ${demand || "N/A"}</li>
      </ul>
    `;

  const msg = {
    to: targetEmail,
    from: {
      name: "WisdomLinked Admin",
      email: adminEmail,
    },
    subject: "New Contact Form Submission",
    html,
    replyTo: email,
  };

  try {
    console.log(`[sendContactDetails] Attempting to send from ${adminEmail} to ${targetEmail}...`);
    const inlineHeader = utilAttachments();
    if (inlineHeader.length) (msg as any).attachments = inlineHeader;
    const response = await sgMail.send(msg);
    console.log("Contact email sent via SendGrid. Status:", response[0].statusCode);
  } catch (error) {
    console.error("Error sending contact email via SendGrid:", error.message);
    if (error.response) {
      console.error("SendGrid Error Details:", JSON.stringify(error.response.body, null, 2));
    }
    throw error;
  }
};