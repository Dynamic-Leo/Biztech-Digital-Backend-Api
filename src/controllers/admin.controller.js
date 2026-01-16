const bcrypt = require("bcryptjs"); 
const db = require("../models");
const User = db.User;
const ServiceCategory = db.ServiceCategory;
const Client = db.Client;
const { sendAccountApproval } = require('../services/email.service');

exports.getSystemHealth = async (req, res, next) => {
    try {
        await db.sequelize.authenticate();
        res.json({ server: 'Online', database: 'Connected', timestamp: new Date() });
    } catch (error) {
        res.status(500).json({ server: 'Online', database: 'Disconnected', error: error.message });
    }
};

exports.getPendingUsers = async (req, res, next) => {
    try {
        const users = await User.findAll({ where: { status: 'Pending Approval' } });
        res.json(users);
    } catch (error) { next(error); }
};

// --- GET ALL CLIENTS (Robust Version) ---
exports.getAllClients = async (req, res, next) => {
    try {
        const clients = await Client.findAll({
            where: { User: { role: 'Client' } },
            include: [
                { 
                    model: User, 
                    as: 'User',
                    attributes: ['id', 'fullName', 'email', 'mobile', 'status', 'createdAt'] 
                },
                {
                    model: db.Project,
                    as: 'Projects',
                    attributes: ['id', 'globalStatus'],
                    required: false // Left Join
                },
                {
                    model: db.ServiceRequest,
                    as: 'Requests',
                    attributes: ['id'],
                    required: false // Left Join
                }
            ]   
        });

        // Map data safely
        const data = clients.map(c => ({
            id: c.User ? c.User.id : null,
            clientId: c.id,
            name: c.User ? c.User.fullName : "Unknown User",
            email: c.User ? c.User.email : "No Email",
            company: c.companyName || "No Company",
            phone: c.User ? c.User.mobile : "",
            status: c.User ? c.User.status : "Inactive",
            joinedDate: c.User ? c.User.createdAt : new Date(),
            totalProjects: c.Projects ? c.Projects.length : 0,
            activeProjects: c.Projects ? c.Projects.filter(p => p.globalStatus === 'In Progress').length : 0,
            totalRequests: c.Requests ? c.Requests.length : 0
        }));

        res.json(data);
    } catch (error) { 
        console.error("Error getting clients:", error);
        next(error); 
    }
};

exports.updateUserStatus = async (req, res, next) => {
    try {
        const { status } = req.body; 
        const userId = req.params.id;
        const user = await User.findByPk(userId); 
        
        if (!user) return res.status(404).json({ message: "User not found" });
        
        await User.update({ status }, { where: { id: userId } });
        
        if (status === 'Active') {
            try { await sendAccountApproval(user.email, user.fullName); } 
            catch (e) { console.warn("Email failed"); }
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

exports.updateCategory = async (req, res, next) => {
    try {
        const category = await ServiceCategory.findByPk(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });
        await category.update(req.body);
        res.json({ message: "Category updated", category });
    } catch (error) { next(error); }
};

exports.deleteCategory = async (req, res, next) => {
    try {
        const category = await ServiceCategory.findByPk(req.params.id);
        if (!category) return res.status(404).json({ message: "Category not found" });
        await category.destroy();
        res.json({ message: "Category deleted" });
    } catch (error) { next(error); }
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
            fullName, email, password: hashedPassword, role: 'Agent', mobile, status: 'Active', isEmailVerified: true
        });
        res.status(201).json({ message: "Agent created", agent: { id: agent.id, email: agent.email } });
    } catch (error) { next(error); }
};

exports.toggleAgentStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        await User.update({ status }, { where: { id: req.params.id, role: 'Agent' } });
        res.json({ message: `Agent status updated to ${status}` });
    } catch (error) { next(error); }
};

exports.deleteAgent = async (req, res, next) => {
    try {
        const agent = await User.findOne({ where: { id: req.params.id, role: 'Agent' } });
        if (!agent) return res.status(404).json({ message: "Agent not found" });
        await agent.destroy();
        res.json({ message: "Agent deleted" });
    } catch (error) { next(error); }
};