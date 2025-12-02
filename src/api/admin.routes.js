const express = require('express');
const router = express.Router();
// IMPORTANT: Added getAgents to the import list
const { 
    getPendingUsers, 
    updateUserStatus, 
    createCategory, 
    getCategories, 
    createAgent, 
    getAgents 
} = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

// Approval Routes
router.get('/users/pending', authorize('Admin'), getPendingUsers);
router.patch('/users/:id/status', authorize('Admin'), updateUserStatus);

// Category Routes
router.post('/categories', authorize('Admin'), createCategory);
router.get('/categories', getCategories);

// Agent Routes
router.post('/agents', authorize('Admin'), createAgent);
router.get('/agents', authorize('Admin'), getAgents); // This fixes the 404 error

module.exports = router;