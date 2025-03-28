const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GOOGLE_EMAIL,
    pass: process.env.GOOGLE_PASSWORD,
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
    from: `"WisdomLinked Admin" <${process.env.GOOGLE_EMAIL}>`,
    to: targetEmail,
    subject: "Your One-Time Passcode (OTP)",
    html: `
      <p>Date: <strong>${todays_date_str}</strong></p>
      ${smurf_details_str}
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
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
    from: `"TOE Contact" <${process.env.GOOGLE_EMAIL}>`,
    to: targetEmail,
    subject: "New Contact Form Submission",
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Contact email sent:", info.messageId);
  } catch (error) {
    console.error(" Error sending contact email:", error.message);
    throw error;
  }
};
