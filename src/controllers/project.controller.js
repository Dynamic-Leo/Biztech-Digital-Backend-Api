const db = require("../models");
const { decrypt } = require("../services/crypto.service");
const Project = db.Project;
const ProjectAsset = db.ProjectAsset;
const ProjectNote = db.ProjectNote; // Import Note Model
const Client = db.Client;
const User = db.User;

// List Projects (Filtered by Role)
exports.getProjects = async (req, res, next) => {
    try {
        let where = {};
        if (req.user.role === 'Client') {
            const client = await Client.findOne({ where: { userId: req.user.id } });
            if (client) where.clientId = client.id;
        } else if (req.user.role === 'Agent') {
            where.agentId = req.user.id;
        }
        
        const projects = await Project.findAll({ 
            where,
            include: ['Client', 'Request', 'Agent'] 
        });
        res.json(projects);
    } catch (error) { next(error); }
};

// Get Single Project Details
exports.getProject = async (req, res, next) => {
    try {
        const project = await Project.findByPk(req.params.id, {
            include: ['Client', 'Request', 'Agent', 'Assets']
        });

        if (!project) return res.status(404).json({ message: "Project not found" });

        // Security check: Agent
        if (req.user.role === 'Agent' && project.agentId !== req.user.id) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Security check: Client
        if (req.user.role === 'Client') {
            const client = await Client.findOne({ where: { userId: req.user.id } });
            if (!client || project.clientId !== client.id) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        res.json(project);
    } catch (error) { next(error); }
};

// Get Project Vault (Credentials)
exports.getProjectVault = async (req, res, next) => {
    try {
        const project = await Project.findByPk(req.params.id, {
            include: ['Client']
        });

        if (!project) return res.status(404).json({ message: "Project not found" });

        // Security checks
        if (req.user.role === 'Agent' && project.agentId !== req.user.id) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (req.user.role === 'Client') {
            const client = await Client.findOne({ where: { userId: req.user.id } });
            if (!client || project.clientId !== client.id) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        const vaultData = project.Client.technicalVault;
        const decryptedVault = vaultData ? decrypt(vaultData) : "No credentials stored.";

        res.json({ vault: decryptedVault });
    } catch (error) { next(error); }
};

// Update Project Status
exports.updateProjectStatus = async (req, res, next) => {
    try {
        await Project.update(req.body, { where: { id: req.params.id } });
        res.json({ message: "Project Updated" });
    } catch (error) { next(error); }
};

// Upload Asset
exports.uploadAsset = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const projectId = req.params.id;
        const type = req.query.type || 'ClientAsset'; 

        const asset = await ProjectAsset.create({
            projectId,
            filePath: req.file.path,
            fileName: req.file.originalname,
            type
        });

        res.status(201).json(asset);
    } catch (error) { next(error); }
};

// Get Assets
exports.getAssets = async (req, res, next) => {
    try {
        const assets = await ProjectAsset.findAll({ 
            where: { projectId: req.params.id } 
        });
        res.json(assets);
    } catch (error) { next(error); }
};

// --- NEW FUNCTIONS FOR NOTES ---

exports.addNote = async (req, res, next) => {
    try {
        const { content } = req.body;
        const projectId = req.params.id;

        if (!content) return res.status(400).json({ message: "Content is required" });

        const note = await ProjectNote.create({
            projectId,
            userId: req.user.id,
            content
        });

        const fullNote = await ProjectNote.findByPk(note.id, {
            include: [{ model: User, as: 'Author', attributes: ['fullName', 'role'] }]
        });

        res.status(201).json(fullNote);
    } catch (error) { next(error); }
};

exports.getNotes = async (req, res, next) => {
    try {
        const notes = await ProjectNote.findAll({
            where: { projectId: req.params.id },
            include: [{ model: User, as: 'Author', attributes: ['fullName', 'role'] }],
            order: [['createdAt', 'ASC']]
        });
        res.json(notes);
    } catch (error) { next(error); }
};