const nodemailer = require("nodemailer");

// Zoho Transport for OTPs
const noreplyTransporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHONOREPLY_USER,
    pass: process.env.ZOHONOREPLY_PASS,
  },
});

// Zoho Transport for Contact form emails
const adminTransporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHOADMIN_USER,
    pass: process.env.ZOHOADMIN_PASS,
  },
});

exports.getCurrentDateString = () => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

exports.sendOTP = async (targetEmail, todays_date_str, smurf_details_str) => {
  const mailOptions = {
    from: `"WisdomLinked Support" <${process.env.ZOHONOREPLY_USER}>`,
    to: targetEmail,
    subject: "Your One-Time Passcode (OTP)",
    html: `
      <p>Date: <strong>${todays_date_str}</strong></p>
      ${smurf_details_str}
    `,
  };
  try {
    const info = await noreplyTransporter.sendMail(mailOptions);
    console.log("OTP email sent:", info.messageId);
  } catch (error) {
    console.error("Error sending OTP email:", error.message);
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

  const mailOptions = {
    from: `"Wisdom Linked Admin" <${process.env.ZOHOADMIN_USER}>`,
    to: targetEmail,
    subject: "New Contact Form Submission",
    html,
  };

  try {
    const info = await adminTransporter.sendMail(mailOptions);
    console.log("Contact email sent:", info.messageId);
  } catch (error) {
    console.error("Error sending contact email:", error.message);
    throw error;
  }
};
