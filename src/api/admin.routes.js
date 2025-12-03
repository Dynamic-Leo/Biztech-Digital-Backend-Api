const express = require('express');
const router = express.Router();
const { 
    getPendingUsers, 
    updateUserStatus, 
    createCategory, 
    getCategories, 
    updateCategory, // Added
    deleteCategory, // Added
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
router.put('/categories/:id', authorize('Admin'), updateCategory); // Added
router.delete('/categories/:id', authorize('Admin'), deleteCategory); // Added

// Agent Routes
router.post('/agents', authorize('Admin'), createAgent);
router.get('/agents', authorize('Admin'), getAgents);

module.exports = router;