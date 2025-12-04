const db = require("../models");
const { generateProposalPDF } = require("../services/pdf.service"); 
const { sendProposalEmail } = require("../services/email.service"); 
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

exports.sendProposal = async (req, res, next) => {
    try {
        const proposalId = req.params.id;

        // Fetch proposal with Client info
        const proposal = await db.Proposal.findByPk(proposalId, {
            include: [
                { 
                    model: db.ServiceRequest, 
                    as: 'Request',
                    include: [{ model: db.Client, as: 'Client', include: ['User'] }] 
                }
            ]
        });

        if (!proposal) return res.status(404).json({ message: "Proposal not found" });
        if (!proposal.pdfPath) return res.status(400).json({ message: "PDF not generated yet" });

        const clientUser = proposal.Request.Client.User;
        const clientName = clientUser.fullName;
        const clientEmail = clientUser.email;

        // Send Email
        await sendProposalEmail(clientEmail, clientName, proposal.id, proposal.pdfPath);

        const t = await db.sequelize.transaction();
        try {
            // 1. Update Proposal Status
            await proposal.update({ status: 'Sent' }, { transaction: t });

            // 2. Update Request Status to 'Quoted' (This triggers the Client Dashboard view)
            await ServiceRequest.update(
                { status: 'Quoted' }, 
                { where: { id: proposal.requestId }, transaction: t }
            );

            await t.commit();
            res.json({ message: `Proposal sent to ${clientEmail} and Dashboard updated.` });
        } catch (err) { await t.rollback(); throw err; }

    } catch (error) { next(error); }
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