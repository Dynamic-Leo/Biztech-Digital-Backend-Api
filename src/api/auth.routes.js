const express = require('express');
const router = express.Router();
const { register, login, getMe, updateMe, verifyEmail, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);

router.put('/verifyemail/:token', verifyEmail); 
router.post('/forgot-password', forgotPassword);  
router.put('/resetpassword/:token', resetPassword); 

// --- NEW ROUTES ---
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;