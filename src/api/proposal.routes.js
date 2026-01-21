const express = require('express');
const router = express.Router();
// Update imports to include sendProposal
const { createProposal, acceptProposal, sendProposal } = require('../controllers/proposal.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.post('/', protect, authorize('Agent'), createProposal);

// NEW ROUTE
router.post('/:id/send', protect, authorize('Agent'), sendProposal);

router.patch('/:id/accept', protect, authorize('Client'), acceptProposal);

module.exports = router;