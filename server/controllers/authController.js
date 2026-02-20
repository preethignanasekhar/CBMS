const User = require('../models/User');
const Department = require('../models/Department');
const { recordAuditLog } = require('../utils/auditService');
const crypto = require('crypto');
const { generateToken } = require('../middleware/auth');

// @desc    Register a new user (Public for initial setup)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
    try {
        const { name, email, password, role, department } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate department if role requires it
        if (['department', 'hod'].includes(role) && department) {
            const deptExists = await Department.findById(department);
            if (!deptExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Department not found'
                });
            }
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role,
            department: ['department', 'hod'].includes(role) ? department : undefined
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department
                },
                token
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // [DEBUG] Trace logs
        console.log('[Login Attempt] Starting login for:', email);
        console.log('[Login Debug] Password length:', password ? password.length : 0);

        // Defensive check
        if (!email || !password) {
            console.warn('[Login Warning] Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password'
            });
        }

        // Find user and populate department
        console.log('[Login Debug] searching for user...');
        const user = await User.findOne({ email: email.toLowerCase() })
            .populate('department', 'name code')
            .select('+password');

        if (!user) {
            console.warn('[Login Warning] User not found with email:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        console.log('[Login Debug] User found:', user._id);
        console.log('[Login Debug] Stored password present:', !!user.password);

        if (!user.isActive) {
            console.warn('[Login Warning] User account is inactive:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        console.log('[Login Debug] Verifying password...');
        const isPasswordValid = await user.comparePassword(password);
        console.log('[Login Debug] Password valid:', isPasswordValid);
        if (!isPasswordValid) {
            console.warn('[Login Warning] Invalid password for:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        console.log('[Login Debug] Saving user lastLogin...');
        await user.save();
        console.log('[Login Debug] User saved successfully');

        // Generate token
        console.log('[Login Debug] Generating token...');
        const token = generateToken(user._id);
        console.log('[Login Debug] Token generated');

        // Log login event (simplified for now)
        try {
            await recordAuditLog({
                eventType: 'user_login',
                req,
                actor: user._id,
                actorRole: user.role,
                targetEntity: 'User',
                targetId: user._id,
                details: {
                    loginTime: new Date()
                }
            });
        } catch (auditError) {
            console.error('Audit log error (non-critical):', auditError);
        }

        console.log('[Login Success] Authenticated:', email);
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    lastLogin: user.lastLogin
                },
                token
            }
        });
    } catch (error) {
        console.error('Login CRITICAL Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('department', 'name code')
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: { user }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const userId = req.user._id;

        // Check if email is already taken by another user
        if (email) {
            const existingUser = await User.findOne({ email, _id: { $ne: userId } });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already taken by another user'
                });
            }
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;

        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).populate('department', 'name code');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user._id;

        // Get user with password
        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while changing password',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
    try {
        // Log logout event
        await recordAuditLog({
            eventType: 'user_logout',
            req,
            targetEntity: 'User',
            targetId: req.user._id,
            details: {
                logoutTime: new Date()
            }
        });

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal if user exists or not for security
            return res.json({
                success: true,
                message: 'If an account exists with that email, a password reset link has been sent.'
            });
        }

        if (!user.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Account is not active'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash token and set expiry (1 hour)
        const hashedToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // TODO: Send email with reset link
        // For now, we'll just return the token in development mode
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

        // Log the reset URL in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Password Reset URL:', resetUrl);
            console.log('Reset Token:', resetToken);
        }

        res.json({
            success: true,
            message: 'If an account exists with that email, a password reset link has been sent.',
            // Remove this in production:
            ...(process.env.NODE_ENV === 'development' && { resetToken, resetUrl })
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while processing password reset request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Hash the token to compare with stored hash
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Password reset token is invalid or has expired'
            });
        }

        // Set new password (will be hashed by pre-save hook)
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Log password reset event
        try {
            await recordAuditLog({
                eventType: 'password_reset',
                req,
                actor: user._id,
                actorRole: user.role,
                targetEntity: 'User',
                targetId: user._id,
                details: {
                    resetTime: new Date()
                }
            });
        } catch (auditError) {
            console.error('Audit log error (non-critical):', auditError);
        }

        res.json({
            success: true,
            message: 'Password has been reset successfully. You can now log in with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while resetting password',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Upload profile picture
// @route   PUT /api/auth/profile/picture
// @access  Private
const uploadProfilePicture = async (req, res) => {
    try {
        if (!req.uploadedFile) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const userId = req.user._id;
        const profilePictureUrl = req.uploadedFile.url;

        // Get current user to see if we need to delete old picture
        const user = await User.findById(userId);
        if (user.profilePicture) {
            // Logic to delete old file could go here if needed
        }

        user.profilePicture = profilePictureUrl;
        await user.save();

        res.json({
            success: true,
            message: 'Profile picture uploaded successfully',
            data: {
                profilePicture: profilePictureUrl
            }
        });
    } catch (error) {
        console.error('Upload profile picture error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while uploading profile picture',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    uploadProfilePicture,
    changePassword,
    logoutUser,
    forgotPassword,
    resetPassword
};
