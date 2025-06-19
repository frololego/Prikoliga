// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const { wrapAsync } = require('controllers/baseController');
const authController = require('controllers/authController');

// === Роуты ===
router.post('/register', wrapAsync(authController.register));
router.post('/login', wrapAsync(authController.login));
router.post('/verify-email', wrapAsync(authController.verifyEmail));

// === Экспорт ===
module.exports = {
    router,
    authenticateToken: authController.authenticateToken
};