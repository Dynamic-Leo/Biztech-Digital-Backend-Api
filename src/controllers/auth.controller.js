const db = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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
        const user = await User.create({
            fullName, email, password: hashedPassword, role, mobile,
            status: 'Pending Approval' // Gated Access
        }, { transaction: t });

        if (role === 'Client') {
            await Client.create({ userId: user.id, companyName }, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ message: "Registration successful. Please wait for Admin approval." });
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