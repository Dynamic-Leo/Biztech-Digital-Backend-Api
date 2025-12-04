const db = require("../models");
const ServiceRequest = db.ServiceRequest;

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
        if (req.user.role === 'Client') {
            const client = await db.Client.findOne({ where: { userId: req.user.id } });
            where.clientId = client.id;
        } else if (req.user.role === 'Agent') {
            where.agentId = req.user.id;
        } else if (req.user.role === 'Admin') {
            where.status = 'Pending Triage'; // Admin triage view
        }

        const requests = await ServiceRequest.findAll({ 
            where, 
            include: ['Client', 'Category', 'AssignedAgent', 'Proposal'] // Added Proposal to include
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