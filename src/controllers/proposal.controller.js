const db = require("../models");
const { generateProposalPDF } = require("../services/pdf.service"); 
const { sendProposalEmail, testSendEmail } = require("../services/email.service");
const axios = require("axios"); 
const Proposal = db.Proposal;
const ProposalLineItem = db.ProposalLineItem;
const ServiceRequest = db.ServiceRequest;
const Project = db.Project;
const Client = db.Client;

exports.createProposal = async (req, res, next) => {
    try {
        const { requestId, items } = req.body; 
        
        // Calculate Total
        const totalAmount = items.reduce((sum, item) => sum + Number(item.price), 0);

        const t = await db.sequelize.transaction();
        try {
            // Check if proposal exists and delete old one (to allow Re-create)
            await Proposal.destroy({ where: { requestId }, transaction: t });

            // 1. Create Proposal Record (Status: Draft)
            const proposal = await Proposal.create({
                requestId,
                agentId: req.user.id,
                totalAmount,
                status: 'Draft', // Explicitly Draft
                pdfPath: "pending..." 
            }, { transaction: t });

            // 2. Create Line Items
            const lineItems = items.map(i => ({ ...i, proposalId: proposal.id }));
            await ProposalLineItem.bulkCreate(lineItems, { transaction: t });

            // NOTE: We do NOT update ServiceRequest status to 'Quoted' yet. 
            // It remains 'Assigned' until the agent clicks "Send".

            // 3. Generate PDF
            const requestData = await ServiceRequest.findByPk(requestId, { include: ['Client'] });
            const clientName = requestData?.Client?.companyName || "Valued Client";

            const pdfPath = await generateProposalPDF(proposal.id, clientName, items, totalAmount);
            
            // Update PDF Path
            proposal.pdfPath = pdfPath;
            await proposal.save({ transaction: t });

            await t.commit();
            res.status(201).json(proposal);
        } catch (err) { await t.rollback(); throw err; }
    } catch (error) { next(error); }
};

exports.sendProposalEmail = async (req, res, next) => {
    let proposalId = req.params.id;

    const proposalInfo = await Proposal.findByPk(proposalId);
    if (!proposalInfo) {
        return res.status(404).json({ message: "Proposal not found." });
    }

    if (!proposalInfo.pdfPath) {
        return res.status(404).json({ message: "No PDF found for this proposal." });
    }

    const idInfo = await ServiceRequest.findByPk(proposalInfo.requestId);
    if (!idInfo) {
        return res.status(404).json({ message: "Service Request not found." });
    }

    const clientInfo = await Client.findByPk(idInfo.clientId, {
        include: [{ model: db.User, as: 'User', attributes: ['fullName', 'email'] }]
    });

    const agentInfo = await Client.findByPk(idInfo.agentId, {
        include: [{ model: db.User, as: 'User', attributes: ['fullName', 'email'] }]
    });

    try {
        // calling external proposal email microservice
        const response = await axios.post(`${process.env.EMAIL_SERVICE_URL}/api/send/proposal-email`, {
            clientName: clientInfo.User.fullName,
            clientEmail: clientInfo.User.email,
            agentName: agentInfo.User.fullName,
            agentEmail: agentInfo.User.email,
            pdfPath: proposalInfo.pdfPath,
            domainName: process.env.FRONTEND_URL,
        });

        if (response.status === 200) {
            res.status(200).json({ message: "Proposal email sent successfully." });
        } else {
            res.status(500).json({ message: "Failed to send proposal email via external service." });
        }

    } catch (error) {
        // Handle any errors during the request
        console.error("❌ Failed to send proposal email:", error);
        return res.status(500).json({ 
            message: "Failed to send proposal email.", 
            error: error.message
        });
    }
};

exports.acceptProposal = async (req, res, next) => {
    try {
        const proposal = await Proposal.findByPk(req.params.id, {
            include: [{ model: ServiceRequest, as: 'Request' }]
        });

        if (!proposal) return res.status(404).json({ message: "Proposal not found" });

        const t = await db.sequelize.transaction();
        try {
            // Update Proposal
            await proposal.update({ status: 'Accepted' }, { transaction: t });
            
            // Update Request
            await ServiceRequest.update({ status: 'Converted' }, { where: { id: proposal.requestId }, transaction: t });

            // CREATE PROJECT
            const project = await Project.create({
                requestId: proposal.requestId,
                clientId: proposal.Request.clientId,
                agentId: proposal.Request.agentId || req.user.id, 
                globalStatus: 'Pending'
            }, { transaction: t });

            await t.commit();
            res.json({ message: "Proposal Accepted & Project Started", projectId: project.id });
        } catch (err) { await t.rollback(); throw err; }
    } catch (error) { next(error); }
};