const db = require("../models");
const ServiceRequest = db.ServiceRequest;
const Project = db.Project;
const Proposal = db.Proposal;
const Client = db.Client;
const User = db.User;

exports.createRequest = async (req, res, next) => {
    try {
        const client = await db.Client.findOne({ where: { userId: req.user.id } });
        if (!client) return res.status(404).json({ message: "Client profile missing" });

        const request = await ServiceRequest.create({
            clientId: client.id,
            categoryId: req.body.categoryId,
            details: req.body.details,
            priority: req.body.priority
        });
        res.status(201).json(request);
    } catch (error) { next(error); }
};

exports.getRequests = async (req, res, next) => {
    try {
        let where = {};
        
        // Role-based Filtering
        if (req.user.role === 'Client') {
            const client = await db.Client.findOne({ where: { userId: req.user.id } });
            where.clientId = client.id;
        } else if (req.user.role === 'Agent') {
            where.agentId = req.user.id;
        } else if (req.user.role === 'Admin' || req.user.role === 'admin') {
            // Admin sees all by default, but respects status filter if provided
            if (req.query.status) {
                where.status = req.query.status;
            }
        }

        const requests = await ServiceRequest.findAll({ 
            where, 
            include: ['Client', 'Category', 'AssignedAgent', 'Proposal'],
            order: [['createdAt', 'DESC']]
        });
        res.json(requests);
    } catch (error) { next(error); }
};

exports.assignRequest = async (req, res, next) => {
    try {
        const { agentId } = req.body;
        await ServiceRequest.update(
            { agentId, status: 'Assigned' },
            { where: { id: req.params.id } }
        );
        res.json({ message: "Agent Assigned" });
    } catch (error) { next(error); }
};

// ... (getClientTimeline remains unchanged) ...
exports.getClientTimeline = async (req, res, next) => {
    try {
        const clientId = req.params.clientId;

        const requests = await ServiceRequest.findAll({
            where: { clientId },
            include: [
                { 
                    model: Proposal, 
                    as: 'Proposal',
                    attributes: ['id', 'status', 'totalAmount', 'createdAt', 'pdfPath']
                },
                { 
                    model: db.ServiceCategory, 
                    as: 'Category',
                    attributes: ['name']
                },
                {
                    model: User,
                    as: 'AssignedAgent',
                    attributes: ['fullName']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const projects = await Project.findAll({
            where: { clientId },
            attributes: ['id', 'requestId', 'globalStatus', 'progressPercent', 'createdAt', 'ecd']
        });

        const timeline = requests.map(req => {
            const project = projects.find(p => p.requestId === req.id);
            return {
                requestId: req.id,
                category: req.Category ? req.Category.name : 'General',
                details: req.details,
                requestDate: req.createdAt,
                requestStatus: req.status,
                agentName: req.AssignedAgent ? req.AssignedAgent.fullName : null,
                proposal: req.Proposal ? {
                    id: req.Proposal.id,
                    status: req.Proposal.status,
                    amount: req.Proposal.totalAmount,
                    date: req.Proposal.createdAt,
                    pdf: req.Proposal.pdfPath
                } : null,
                project: project ? {
                    id: project.id,
                    status: project.globalStatus,
                    progress: project.progressPercent,
                    startDate: project.createdAt,
                    completionDate: project.ecd
                } : null
            };
        });

        res.json(timeline);
    } catch (error) { next(error); }
};