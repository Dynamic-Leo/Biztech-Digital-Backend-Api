const express = require('express');
const router = express.Router();
const { getMyProfile, updateProfile, getAgentClients } = require('../controllers/client.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/me', protect, authorize('Client'), getMyProfile);
router.put('/me', protect, authorize('Client'), updateProfile);

// --- NEW: Route for Agents to view their clients ---
router.get('/agent-list', protect, authorize('Agent'), getAgentClients);

module.exports = router;