const sgMail = require("@sendgrid/mail");

const adminEmail = "admin@wisdomlinked.com";
const noReplyEmail = "noreply@wisdomlinked.com";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
    subject: "Your One-Time Passcode (OTP)",
    html: `
        <p>Date: <strong>${todays_date_str}</strong></p>
        ${smurf_details_str}
      `,
  };
  try {
    const response = await sgMail.send(msg);

  } catch (error) {
    console.error("Error sending OTP email via SendGrid:", error.message);
    console.error("Error details:", error.response ? error.response.body : error);
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