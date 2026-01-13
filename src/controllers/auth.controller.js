const db = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const axios = require("axios");
const { Op } = require('sequelize');
const User = db.User;
const Client = db.Client;

exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password, role, companyName, mobile } = req.body;

     // Prevent Agents/Admins from self-registering publicly
    if (role === 'Agent' || role === 'Admin') {
        return res.status(403).json({ 
            message: "Restricted role. Agents must be added by an Administrator." 
        });
    }
    
    // Check existing
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const t = await db.sequelize.transaction();
    try {

        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await User.create({
            fullName, email, password: hashedPassword, role, mobile,
            status: 'Pending Approval', // Gated Access
            emailVerificationToken,
            emailVerificationTokenExpiry,
            isEmailVerified: false,
        }, { transaction: t });

        if (role === 'Client') {
            await Client.create({ 
                userId: user.id, 
                companyName,
                emailVerificationToken,
                emailVerificationTokenExpiry,
                isEmailVerified: false,
            }, { transaction: t });
        }

        await t.commit();

        // calling email micro-service to send verification email
        axios.post(`${process.env.EMAIL_SERVICE_URL}/api/send/verification-email`, {
            email: user.email,
            emailVerificationToken: emailVerificationToken,
            domainName: process.env.FRONTEND_URL
        }).catch(err => {
            console.error("Failed to call email micro-service", err);
        });

        res.status(201).json({ message: "Registration successful. Please check your email to verify your account." });
    } catch (err) {
        await t.rollback();
        throw err;
    }
  } catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isEmailVerified) {
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        user.emailVerificationToken = emailVerificationToken;
        user.emailVerificationTokenExpiry = emailVerificationTokenExpiry;
        await user.save();

        // calling email micro-service to send verification email
        axios.post(`${process.env.EMAIL_SERVICE_URL}/api/send/verification-email`, {
            email: user.email,
            emailVerificationToken: emailVerificationToken,
            domainName: process.env.FRONTEND_URL
        }).catch(err => {
            console.error("Failed to call email micro-service");
        });
        return res.status(403).json({ message: "Email not verified. Please verify your email before logging in." });
    }

    // Gatekeeper Check
    if (user.status !== 'Active') {
        return res.status(403).json({ message: `Account is ${user.status}. Contact Admin.` });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name: user.fullName, role: user.role } });
  } catch (error) { next(error); }
};

// --- NEW: Get Current User Info ---
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) { next(error); }
};

// --- NEW: Update Current User Info ---
exports.updateMe = async (req, res, next) => {
    try {
        const { fullName, mobile, password } = req.body;
        const user = await User.findByPk(req.user.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        if (fullName) user.fullName = fullName;
        if (mobile) user.mobile = mobile;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        await user.save();
        
        res.json({ 
            message: "Profile updated successfully", 
            user: { id: user.id, name: user.fullName, email: user.email, role: user.role } 
        });
    } catch (error) { next(error); }
};

// ============================================================================================

exports.verifyEmail = async (req, res, next) => {
  const { token } = req.params;

  // Validate token format
  if (!token || token.length !== 64) {
    return res.status(400).json({ success: false, message: "Invalid token." });
  }

  try {
    // Find the user by the verification token
    const user = await User.findOne({ 
      where: { 
        emailVerificationToken: token,
        emailVerificationTokenExpiry: { [Op.gt]: new Date() } // Check if not expired
      } 
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification token." });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpiry = null;
    user.status = 'PENDING';

    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully! Your account is now in pending state awaiting admin approval.",
    });
  } catch (error) {
    console.error("Error during email verification:", error);
    res.status(500).json({ success: false, message: "Server error during email verification." });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  try {
    const user = await User.findOne({ where: { email } });

    if (user) {

        const resetToken = crypto.randomBytes(32).toString('hex');
            
        // Set fields matching model definition
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        
        try {
            await user.save();
        } catch (dbError) {
            user.rollback(); 
            console.error("DB Save Error (Forgot Password):", dbError);
            return res.status(500).json({ message: "Database Error: Unable to save reset token." });
        }

        axios.post(`${getEmailServiceUrl()}/api/send/password-reset-email`, {
            email: user.email,
            passwordResetToken: resetToken,
            domainName: process.env.FRONTEND_URL,
        }).catch(err => console.error("Email Service Error (Forgot Password):", err.message));
    }

    res.status(200).json({ 
      success: true,
      message: "If an account with that email exists, a password reset link has been sent." 
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error processing request." });
  }
};

// Validate Reset Token (for password reset)
exports.validateResetToken = async (req, res) => {
  try {
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.resettoken).digest("hex");

    const user = await User.findOne({
      where: {
        resetPasswordToken,
        resetPasswordExpire: { [Op.gt]: new Date() },
      },
      attributes: ["id", "email"],
    });

    if (!user) {
      return res.status(400).json({ valid: false, message: "Invalid or expired token" });
    }

    res.status(200).json({ valid: true, message: "Token is valid" });
  } catch (error) {
    console.error("Validate token error:", error);
    res.status(500).json({ valid: false, message: "Error validating token" });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required." });
  }

  try {
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.resettoken).digest("hex");

    const user = await User.findOne({
      where: {
        resetPasswordToken,
        resetPasswordExpire: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long, contain at least one lowercase letter, one uppercase letter, one digit, and one special character.'
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.status(200).json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Error resetting password" });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'New passwords do not match.' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long, contain at least one lowercase letter, one uppercase letter, one digit, and one special character.'
    });
  }

  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });

  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ success: false, message: 'Server error, please try again later.' });
  }
};