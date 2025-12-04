const db = require("../models");
const { encrypt, decrypt } = require("../services/crypto.service");
const Client = db.Client;
const Project = db.Project;
const User = db.User;

exports.getMyProfile = async (req, res, next) => {
    try {
        const profile = await Client.findOne({ where: { userId: req.user.id } });
        if (!profile) return res.status(404).json({ message: "Profile not found" });

        // Decrypt vault before sending
        if (profile.technicalVault) {
            profile.technicalVault = decrypt(profile.technicalVault);
        }
        res.json(profile);
    } catch (error) { next(error); }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const { industry, websiteUrl, technicalVault } = req.body;
        const updateData = { industry, websiteUrl };
        
        // Encrypt vault if provided
        if (technicalVault) {
            updateData.technicalVault = encrypt(technicalVault);
        }

        await Client.update(updateData, { where: { userId: req.user.id } });
        res.json({ message: "Profile Updated" });
    } catch (error) { next(error); }
};

// --- NEW: Get Clients assigned to an Agent ---
exports.getAgentClients = async (req, res, next) => {
    try {
        // Find clients that have projects assigned to this agent
        const clients = await Client.findAll({
            include: [
                { 
                    model: User, 
                    as: 'User',
                    attributes: ['fullName', 'email'] 
                },
                {
                    model: Project,
                    as: 'Projects',
                    where: { agentId: req.user.id }, // Filter by Agent
                    attributes: ['id', 'globalStatus']
                }
            ]
        });

        // Format data for frontend
        const formattedClients = clients.map(c => ({
            id: c.id,
            name: c.User.fullName,
            email: c.User.email,
            company: c.companyName,
            industry: c.industry,
            projectsCount: c.Projects.length,
            activeProjects: c.Projects.filter(p => p.globalStatus === 'In Progress').length,
            joinedDate: c.createdAt
        }));

        res.json(formattedClients);
    } catch (error) { next(error); }
};