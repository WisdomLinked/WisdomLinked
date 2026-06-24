const sgMail = require("@sendgrid/mail");

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
    await sgMail.send(msg);
  } catch (error) {
    console.error("Error sending password reset OTP via SendGrid:", error.message);
  }
};

exports.sendEmailChangeVerification = async (targetEmail, confirmCode) => {
  const link = `${process.env.FE_URL}/verify-email-change/${confirmCode}`;
  const html = `<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #234C6A 0%, #456882 100%); padding: 32px 24px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 2px;">WISDOMLINKED</h1>
            </div>
            <div style="padding: 32px 24px;">
                <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 12px 0;">Confirm your email address</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">You asked to set this email as the address for your WisdomLinked account. Click the button below to confirm it's really you.</p>
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #234C6A 0%, #456882 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">Confirm Email</a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">This link expires in 24 hours. If you didn't request this, you can safely ignore this email — your account is unchanged.</p>
            </div>
            <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} WisdomLinked. All rights reserved.</p>
            </div>
        </div>`;
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