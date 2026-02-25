const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  changePassword,
  logoutUser,
  forgotPassword,
  resetPassword,
  uploadProfilePicture
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { handleProfilePictureUpload } = require('../middleware/fileUpload');

// Public routes
const { check, validationResult } = require('express-validator');

const validateLogin = [
  check('email').isEmail().withMessage('Please include a valid email'),
  check('password').exists().withMessage('Password is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Public routes
router.post('/login', validateLogin, loginUser);
router.post('/register', registerUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected routes
router.use(verifyToken); // All routes below require authentication

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/profile/picture', (req, res, next) => {
  console.log('Incoming profile picture upload request');
  next();
}, handleProfilePictureUpload, uploadProfilePicture);
router.put('/change-password', changePassword);
router.post('/logout', logoutUser);

module.exports = router;
