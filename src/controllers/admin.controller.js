const bcrypt = require("bcryptjs"); 
const db = require("../models");
const User = db.User;
const ServiceCategory = db.ServiceCategory;
const { sendAccountApproval } = require('../services/email.service');

exports.getPendingUsers = async (req, res, next) => {
    try {
        const users = await User.findAll({ where: { status: 'Pending Approval' } });
        res.json(users);
    } catch (error) { next(error); }
};

exports.updateUserStatus = async (req, res, next) => {
    try {
        const { status } = req.body; 
        const userId = req.params.id;

        const user = await User.findByPk(userId); 
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        await User.update({ status }, { where: { id: userId } });
        
        if (status === 'Active') {
            try {
                await sendAccountApproval(user.email, user.fullName);
            } catch (emailError) {
                console.warn(`⚠️ Warning: Failed to send approval email. Check SMTP settings.`);
            }
        }

        res.json({ message: `User status updated to ${status}` });
    } catch (error) { next(error); }
};

exports.createCategory = async (req, res, next) => {
    try {
        const category = await ServiceCategory.create(req.body);
        res.status(201).json(category);
    } catch (error) { next(error); }
};

exports.getCategories = async (req, res, next) => {
    try {
        const categories = await ServiceCategory.findAll();
        res.json(categories);
    } catch (error) { next(error); }
};

// --- NEW: Update Category ---
exports.updateCategory = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const category = await ServiceCategory.findByPk(req.params.id);
        
        if (!category) return res.status(404).json({ message: "Category not found" });

        await category.update({ name, description });
        res.json({ message: "Category updated successfully", category });
    } catch (error) { next(error); }
};

// --- NEW: Delete Category ---
exports.deleteCategory = async (req, res, next) => {
    try {
        const category = await ServiceCategory.findByPk(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });

        await category.destroy();
        res.json({ message: "Category deleted successfully" });
    } catch (error) { 
        // Handle Foreign Key constraint errors (if category is used in requests)
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({ message: "Cannot delete this service because it is currently assigned to existing client requests." });
        }
        next(error); 
    }
};

exports.getAgents = async (req, res, next) => {
    try {
        const agents = await User.findAll({ 
            where: { role: 'Agent' },
            attributes: { exclude: ['password'] } 
        });
        res.json(agents);
    } catch (error) { next(error); }
};

exports.createAgent = async (req, res, next) => {
    try {
        const { fullName, email, password, mobile } = req.body;

        const exists = await User.findOne({ where: { email } });
        if (exists) return res.status(400).json({ message: "Email already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const agent = await User.create({
            fullName,
            email,
            password: hashedPassword,
            role: 'Agent',
            mobile,
            status: 'Active'
        });

        res.status(201).json({ 
            message: "Agent created successfully.", 
            agent: { id: agent.id, email: agent.email, name: agent.fullName } 
        });
    } catch (error) { next(error); }
};