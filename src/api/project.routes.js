const express = require('express');
const router = express.Router();
const { 
    getProjects, 
    getProject, 
    updateProjectStatus, 
    uploadAsset, 
    getAssets,
    getProjectVault,
    addNote,   // <-- Import this
    getNotes   // <-- Import this
} = require('../controllers/project.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Routes
router.get('/', protect, getProjects);
router.get('/:id', protect, getProject);
router.get('/:id/vault', protect, getProjectVault);
router.patch('/:id', protect, updateProjectStatus);

// Asset Routes
router.post('/:id/assets', protect, upload.single('file'), uploadAsset);
router.get('/:id/assets', protect, getAssets);

// --- NEW NOTE ROUTES ---
router.get('/:id/notes', protect, getNotes);
router.post('/:id/notes', protect, addNote);

module.exports = router;