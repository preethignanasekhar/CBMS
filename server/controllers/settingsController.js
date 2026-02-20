const Settings = require('../models/Settings');
const { recordAuditLog } = require('../utils/auditService');

// @desc    Get all settings
// @route   GET /api/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
    try {
        const settings = await Settings.find({}).sort({ category: 1, key: 1 });

        // Transform array to object for easier consumption by client
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });

        res.json({
            success: true,
            data: settingsObj
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching settings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    const session = await Settings.startSession();
    session.startTransaction();

    try {
        const updates = req.body;
        const updatedSettings = {};

        for (const [key, value] of Object.entries(updates)) {
            if (key === 'updatedBy') continue;

            const setting = await Settings.findOne({ key }).session(session);

            let previousValue = null;

            if (setting) {
                previousValue = setting.value;
                setting.value = value;
                setting.updatedBy = req.user._id;
                await setting.save({ session });
            } else {
                // Create if doesn't exist (seed on the fly)
                await Settings.create([{
                    key,
                    value,
                    updatedBy: req.user._id,
                    // infer category or default to general
                    category: 'general'
                }], { session });
            }

            updatedSettings[key] = value;

            // Log only if changed
            if (JSON.stringify(previousValue) !== JSON.stringify(value)) {
                await recordAuditLog({
                    eventType: 'settings_updated',
                    req,
                    targetEntity: 'System',
                    details: { key, value },
                    previousValues: { [key]: previousValue },
                    newValues: { [key]: value }
                });
            }
        }

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Settings updated successfully',
            data: updatedSettings
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating settings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

// @desc    Get system info
// @route   GET /api/settings/system-info
// @access  Private/Admin
const getSystemInfo = async (req, res) => {
    try {
        const os = require('os');

        res.json({
            success: true,
            data: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                uptime: os.uptime(),
                nodeVersion: process.version,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('Get system info error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching system info'
        });
    }
};

// @desc    Reset settings
// @route   POST /api/settings/reset
// @access  Private/Admin
const resetSettings = async (req, res) => {
    try {
        // For now, there are no "default" settings stored elsewhere. 
        // In a real app, this might load from a config file.
        // We will just return not implemented or clear non-essential ones.

        res.status(501).json({
            success: false,
            message: 'Reset settings not fully implemented yet'
        });
    } catch (error) {
        console.error('Reset settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get public settings
// @route   GET /api/settings/public
// @access  Private
const getPublicSettings = async (req, res) => {
    try {
        const publicKeys = ['budget_overspend_policy', 'system_name', 'fiscal_year_start_month'];
        const settings = await Settings.find({ key: { $in: publicKeys } });

        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });

        // Set defaults if not found
        if (!settingsObj.budget_overspend_policy) settingsObj.budget_overspend_policy = 'disallow';

        res.json({
            success: true,
            data: settingsObj
        });
    } catch (error) {
        console.error('Get public settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching public settings'
        });
    }
};

module.exports = {
    getSettings,
    getPublicSettings,
    updateSettings,
    getSystemInfo,
    resetSettings
};
