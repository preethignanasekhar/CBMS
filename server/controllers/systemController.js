const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');

// @desc    Get system concurrency status
// @route   GET /api/system/concurrency-status
// @access  Private
const getConcurrencyStatus = async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const userCount = await User.countDocuments();

        res.json({
            success: true,
            data: {
                status: 'healthy',
                database: dbStatus,
                activeUsers: userCount,
                serverTime: new Date()
            }
        });
    } catch (error) {
        console.error('Get system status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while checking system status'
        });
    }
};

// @desc    Bulk setup departments and users for production
// @route   POST /api/system/bulk-setup
// @access  Private (Admin only)
const bulkSetup = async (req, res) => {
    try {
        const { emailDomain = 'bms.edu.in' } = req.body;

        // Department definitions
        const departments = [
            { code: 'AIDS', name: 'Artificial Intelligence and Data Science' },
            { code: 'AIML', name: 'Artificial Intelligence and Machine Learning' },
            { code: 'AUTO', name: 'Automobile Engineering' },
            { code: 'CIVIL', name: 'Civil Engineering' },
            { code: 'CSE', name: 'Computer Science' },
            { code: 'CYBER', name: 'Cyber Security' },
            { code: 'EEE', name: 'Electrical and Electronics Engineering' },
            { code: 'ECE', name: 'Electronics and Communication Engineering' },
            { code: 'IT', name: 'Information Technology' },
            { code: 'MECH', name: 'Mechanical Engineering' }
        ];

        // Budget heads
        const budgetHeads = [
            { name: 'Lab Equipment', code: 'LAB-EQ', category: 'Capital', budgetType: 'recurring' },
            { name: 'Seminars & Conferences', code: 'SEM', category: 'Events', budgetType: 'recurring' },
            { name: 'Workshops', code: 'WS', category: 'Events', budgetType: 'recurring' },
            { name: 'Guest Lectures', code: 'GL', category: 'Events', budgetType: 'recurring' },
            { name: 'Industrial Visits', code: 'IV', category: 'Events', budgetType: 'recurring' },
            { name: 'Maintenance', code: 'MAINT', category: 'Operations', budgetType: 'recurring' },
            { name: 'Stationery & Consumables', code: 'STAT', category: 'Operations', budgetType: 'recurring' },
            { name: 'Library & Books', code: 'LIB', category: 'Academic', budgetType: 'recurring' },
            { name: 'Student Activities', code: 'STU', category: 'Events', budgetType: 'recurring' },
            { name: 'Miscellaneous', code: 'MISC', category: 'Others', budgetType: 'recurring' }
        ];

        const log = [];

        // 1. Budget Heads
        for (const head of budgetHeads) {
            const exists = await BudgetHead.findOne({ code: head.code });
            if (!exists) {
                await BudgetHead.create(head);
                log.push(`Created budget head: ${head.name}`);
            }
        }

        // 2. Departments
        const deptMap = {};
        for (const dept of departments) {
            let existingDept = await Department.findOne({ code: dept.code });
            if (!existingDept) {
                existingDept = await Department.create({
                    name: dept.name,
                    code: dept.code,
                    description: `${dept.name} Department`,
                    isActive: true
                });
                log.push(`Created department: ${dept.name}`);
            }
            deptMap[dept.code] = existingDept._id;
        }

        // 3. Institution Users
        const institutionUsers = [
            {
                name: 'System Administrator',
                email: `admin@${emailDomain}`,
                password: 'Admin@2024',
                role: 'admin',
                permissions: { superAdmin: true, manageUsers: true, manageBudgets: true, exportReports: true, canApprove: true }
            },
            {
                name: 'Finance Office',
                email: `office@${emailDomain}`,
                password: 'Office@2024',
                role: 'office',
                permissions: { manageBudgets: true, exportReports: true, canApprove: true }
            },
            {
                name: 'Dr. Principal',
                email: `principal@${emailDomain}`,
                password: 'Principal@2024',
                role: 'principal',
                permissions: { canApprove: true, exportReports: true }
            },
            {
                name: 'External Auditor',
                email: `auditor@${emailDomain}`,
                password: 'Auditor@2024',
                role: 'auditor',
                permissions: { exportReports: true }
            }
        ];

        for (const userData of institutionUsers) {
            await createOrUpdateUser(userData);
            log.push(`Setup institution user: ${userData.email}`);
        }

        // 4. Department Users
        for (const dept of departments) {
            const code = dept.code;
            const lowCode = code.toLowerCase();
            const deptId = deptMap[code];

            // User, Coordinator, HOD
            const deptUsers = [
                {
                    name: `${code} Department User`,
                    email: `${lowCode}.user@${emailDomain}`,
                    password: 'Dept@2024',
                    role: 'department',
                    department: deptId,
                    permissions: { canApprove: false }
                },
                {
                    name: `${code} Budget Coordinator`,
                    email: `${lowCode}.coordinator@${emailDomain}`,
                    password: 'Coord@2024',
                    role: 'department',
                    department: deptId,
                    permissions: { canApprove: false }
                },
                {
                    name: `Dr. HOD ${code}`,
                    email: `hod.${lowCode}@${emailDomain}`,
                    password: 'Hod@2024',
                    role: 'hod',
                    department: deptId,
                    permissions: { canApprove: true }
                }
            ];

            for (const u of deptUsers) {
                await createOrUpdateUser(u);
                log.push(`Setup dept user: ${u.email}`);
            }

            // Link HOD
            const hodUser = await User.findOne({ email: deptUsers[2].email });
            await Department.findByIdAndUpdate(deptId, { hod: hodUser._id });
        }

        res.json({
            success: true,
            message: 'Bulk setup completed successfully',
            log: log
        });

    } catch (error) {
        console.error('Bulk setup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during bulk setup',
            error: error.message
        });
    }
};

async function createOrUpdateUser(userData) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
        existingUser.password = userData.password;
        existingUser.name = userData.name;
        existingUser.role = userData.role;
        if (userData.department) existingUser.department = userData.department;
        existingUser.permissions = userData.permissions;
        existingUser.isActive = true;
        await existingUser.save();
    } else {
        const user = new User(userData);
        await user.save();
    }
}

module.exports = {
    getConcurrencyStatus,
    bulkSetup
};
