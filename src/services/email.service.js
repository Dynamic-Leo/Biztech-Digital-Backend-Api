const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

// Create Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "false", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generic Send Function
const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Email service failed");
  }
};

// 1. Account Approval Email
exports.sendAccountApproval = async (email, name) => {
  const subject = "Your BizTech Account is Approved!";
  const html = `
    <h3>Hello ${name},</h3>
    <p>Great news! Your account has been approved by our administrators.</p>
    <p>You can now login to your dashboard to view services and submit requests.</p>
    <br>
    <p>Regards,<br>BizTech Team</p>
  `;
  return sendEmail(email, subject, html);
};

// 2. Send Proposal PDF
exports.sendProposalEmail = async (clientEmail, clientName, proposalId, pdfRelativePath) => {
  const subject = `Project Proposal #${proposalId} - Digitize Your Biz`;
  const html = `
    <h3>Hello ${clientName},</h3>
    <p>Please find attached the proposal for your requested services.</p>
    <p>You can review and accept this proposal directly from your dashboard.</p>
    <br>
    <p>Regards,<br>BizTech Team</p>
  `;

  // Resolve full path for attachment
  const fullPath = path.join(__dirname, "../../", pdfRelativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error("Proposal PDF file not found");
  }

  const attachments = [
    {
      filename: `Proposal-${proposalId}.pdf`,
      path: fullPath,
    },
  ];

  return sendEmail(clientEmail, subject, html, attachments);
};

// Export generic if needed elsewhere
exports.sendEmail = sendEmail;