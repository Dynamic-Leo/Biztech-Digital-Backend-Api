const express = require('express');
const router = express.Router();
const { 
    getPendingUsers, 
    updateUserStatus, 
    createCategory, 
    getCategories, 
    updateCategory,
    deleteCategory,
    createAgent, 
    getAgents,
    getSystemHealth,
    toggleAgentStatus,
    deleteAgent,
    getAllClients // <-- Ensure this is imported
} = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

// System
router.get('/health', authorize('Admin'), getSystemHealth);

// Users & Clients (Fixes the 404)
router.get('/users/pending', authorize('Admin'), getPendingUsers);
router.patch('/users/:id/status', authorize('Admin'), updateUserStatus);
router.get('/clients', authorize('Admin'), getAllClients); // <-- THIS LINE FIXES THE 404

// Categories
router.post('/categories', authorize('Admin'), createCategory);
router.get('/categories', getCategories);
router.put('/categories/:id', authorize('Admin'), updateCategory);
router.delete('/categories/:id', authorize('Admin'), deleteCategory);

// Agents
router.post('/agents', authorize('Admin'), createAgent);
router.get('/agents', authorize('Admin'), getAgents);
router.patch('/agents/:id/status', authorize('Admin'), toggleAgentStatus);
router.delete('/agents/:id', authorize('Admin'), deleteAgent);

module.exports = router;