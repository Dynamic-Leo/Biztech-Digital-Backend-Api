const nodemailer = require("nodemailer");
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

// 2. Send Proposal Email (THE FIX IS HERE)
exports.sendProposalEmail = async ({
  clientName,
  clientEmail,
  agentName,
  agentEmail,
  pdfPath,
  proposalId,
  totalAmount
}) => {
  const subject = `Your BizTech Proposal #${proposalId}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your Project Proposal is Ready</h2>
      <p>Hello ${clientName},</p>
      <p>Please find attached your project proposal <strong>#${proposalId}</strong> prepared by <strong>${agentName}</strong>.</p>
      ${totalAmount ? `<p><strong>Total Amount:</strong> $${totalAmount}</p>` : ''}
      <p>Review the proposal and feel free to reply to this email if you have any questions.</p>
      <br>
      <p>Best regards,<br>
      <strong>${agentName}</strong><br>
      BizTech Team</p>
    </div>
  `;

  // --- CRITICAL FIX START ---
  // Ensure we are looking for the file starting from the root of the project
  // regardless of where the script was called from.
  let fullPath = pdfPath;
  if (!path.isAbsolute(pdfPath)) {
      fullPath = path.join(process.cwd(), pdfPath);
  }

  // Check if file exists to prevent server crash
  if (!fs.existsSync(fullPath)) {
      console.error(`❌ CRITICAL ERROR: Proposal PDF missing at path: ${fullPath}`);
      throw new Error("Server Error: The generated PDF file could not be found on the server.");
  }
  // --- CRITICAL FIX END ---

  const attachments = [
    {
      filename: `Proposal-${proposalId}.pdf`,
      path: fullPath,
      contentType: "application/pdf",
    },
  ];

  return sendEmail({
    to: clientEmail,
    subject,
    html,
    replyTo: agentEmail,
    attachments,
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