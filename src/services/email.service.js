const nodemailer = require("nodemailer");
const { wrapInTemplate } = require("../templates/utils");
const proposalEmailTemplate = require("../templates/proposalEmailTemplate");
const path = require("path");
const fs = require("fs");

// Create Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generic Send Function
const sendEmail = async ({ to, subject, html, replyTo, attachments = [] }) => {
  try {
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'BizTech Team'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    };

    if (replyTo) mailOptions.replyTo = replyTo;

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId, `to: ${to}`);
    return info;
  } catch (err) {
    console.error("❌ Email send failed:", err);
    throw err;
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
  return sendEmail({ to: email, subject, html });
};

// Helper function to create content for proposal email
const generateProposalEmailContent = (clientName, agentName) => {
  return proposalEmailTemplate(clientName, agentName);
};

// Send the proposal email
exports.sendProposalEmail = async ({
  clientName,
  clientEmail,
  agentName,
  agentEmail,
  pdfPath,
  domainName
}) => {
  const content = generateProposalEmailContent(clientName, agentName);

  return sendEmail({
    to: clientEmail,
    subject: `Your BizDigital Proposal from ${agentName}`,
    html: wrapInTemplate("Proposal from BizDigital", content),
    replyTo: agentEmail,
    attachments: [
      {
        filename: path.basename(pdfPath),
        path: pdfPath,
        contentType: "application/pdf",
      },
    ],
    domainName
  });
};

// 3. Password Reset Email
exports.sendPasswordResetEmail = async (userEmail, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const subject = "BizTech Password Reset Link";
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background: #4A6FA5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Reset Password
      </a>
      <p>This link will expire in 1 hour.</p>
      <br>
      <p>Regards,<br>BizTech Team</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

exports.sendEmail = sendEmail;