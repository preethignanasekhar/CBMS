/**
 * CBMS Production Seed Script
 * Creates 10 departments with proper user-role assignments
 * 
 * Total Users: 34
 * - 4 Institution-level (Admin, Office, Principal, Auditor)
 * - 30 Department-level (3 per department × 10)
 * 
 * RUN: node scripts/seedProductionUsers.js
 * WARNING: Backup database before running
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');

// Institution email domain - CHANGE THIS
const EMAIL_DOMAIN = 'bms.edu.in';

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

// Budget heads (predefined)
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

// Helper to generate temp password
function generateTempPassword(role) {
    return `${role.charAt(0).toUpperCase() + role.slice(1)}@2024`;
}

async function seedProduction() {
    const createdUsers = [];
    const createdDepts = [];

    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in .env');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // ========== PHASE 1: CREATE BUDGET HEADS ==========
        console.log('========== PHASE 1: BUDGET HEADS ==========\n');
        for (const head of budgetHeads) {
            const exists = await BudgetHead.findOne({ code: head.code });
            if (!exists) {
                await BudgetHead.create(head);
                console.log(`✅ Created: ${head.name}`);
            } else {
                console.log(`⏭️  Exists: ${head.name}`);
            }
        }

        // ========== PHASE 2: CREATE DEPARTMENTS ==========
        console.log('\n========== PHASE 2: DEPARTMENTS ==========\n');
        for (const dept of departments) {
            let existingDept = await Department.findOne({ code: dept.code });
            if (!existingDept) {
                existingDept = await Department.create({
                    name: dept.name,
                    code: dept.code,
                    description: `${dept.name} Department`,
                    isActive: true
                });
                console.log(`✅ Created: ${dept.name}`);
            } else {
                console.log(`⏭️  Exists: ${dept.name}`);
            }
            createdDepts.push({ ...dept, _id: existingDept._id });
        }

        // ========== PHASE 3: INSTITUTION-LEVEL USERS ==========
        console.log('\n========== PHASE 3: INSTITUTION USERS ==========\n');

        const institutionUsers = [
            {
                name: 'System Administrator',
                email: `admin@${EMAIL_DOMAIN}`,
                password: 'Admin@2024',
                role: 'admin',
                permissions: { superAdmin: true, manageUsers: true, manageBudgets: true, exportReports: true, canApprove: true }
            },
            {
                name: 'Finance Office',
                email: `office@${EMAIL_DOMAIN}`,
                password: 'Office@2024',
                role: 'office',
                permissions: { manageBudgets: true, exportReports: true, canApprove: true }
            },
            {
                name: 'Dr. Principal',
                email: `principal@${EMAIL_DOMAIN}`,
                password: 'Principal@2024',
                role: 'principal',
                permissions: { canApprove: true, exportReports: true }
            },
            {
                name: 'External Auditor',
                email: `auditor@${EMAIL_DOMAIN}`,
                password: 'Auditor@2024',
                role: 'auditor',
                permissions: { exportReports: true }
            }
        ];

        for (const userData of institutionUsers) {
            await createOrUpdateUser(userData);
            createdUsers.push({ ...userData, department: 'Institution' });
        }

        // ========== PHASE 4: DEPARTMENT-LEVEL USERS ==========
        console.log('\n========== PHASE 4: DEPARTMENT USERS ==========\n');

        for (const dept of createdDepts) {
            const deptCode = dept.code.toLowerCase();
            console.log(`\n--- ${dept.name} ---`);

            // 1. Department User (no approval rights)
            const deptUser = {
                name: `${dept.code} Department User`,
                email: `${deptCode}.user@${EMAIL_DOMAIN}`,
                password: 'Dept@2024',
                role: 'department',
                department: dept._id,
                permissions: { canApprove: false }
            };
            await createOrUpdateUser(deptUser);
            createdUsers.push({ ...deptUser, department: dept.name });

            // 2. Budget Coordinator (no approval rights, prepares/submits)
            const coordinator = {
                name: `${dept.code} Budget Coordinator`,
                email: `${deptCode}.coordinator@${EMAIL_DOMAIN}`,
                password: 'Coord@2024',
                role: 'department',
                department: dept._id,
                permissions: { canApprove: false }
            };
            await createOrUpdateUser(coordinator);
            createdUsers.push({ ...coordinator, department: dept.name });

            // 3. HOD (verification rights)
            const hod = {
                name: `Dr. HOD ${dept.code}`,
                email: `hod.${deptCode}@${EMAIL_DOMAIN}`,
                password: 'Hod@2024',
                role: 'hod',
                department: dept._id,
                permissions: { canApprove: true }
            };
            await createOrUpdateUser(hod);
            createdUsers.push({ ...hod, department: dept.name });

            // Link HOD to department
            const hodUser = await User.findOne({ email: hod.email });
            await Department.findByIdAndUpdate(dept._id, { hod: hodUser._id });
            console.log(`   ✅ HOD linked to department`);
        }

        // ========== FINAL REPORT ==========
        console.log('\n\n========================================');
        console.log('         SETUP COMPLETE                 ');
        console.log('========================================\n');

        console.log('INSTITUTION-LEVEL USERS (4):');
        console.log('┌────────────────────────────────────────────────────────────┐');
        console.log('│ Role            │ Email                    │ Password     │');
        console.log('├────────────────────────────────────────────────────────────┤');
        console.log(`│ Admin           │ admin@${EMAIL_DOMAIN.padEnd(16)} │ Admin@2024   │`);
        console.log(`│ Office          │ office@${EMAIL_DOMAIN.padEnd(15)} │ Office@2024  │`);
        console.log(`│ Principal       │ principal@${EMAIL_DOMAIN.padEnd(12)} │ Principal@2024│`);
        console.log(`│ Auditor         │ auditor@${EMAIL_DOMAIN.padEnd(14)} │ Auditor@2024 │`);
        console.log('└────────────────────────────────────────────────────────────┘');

        console.log('\nDEPARTMENT-LEVEL USERS (30):');
        console.log('┌──────────────────────────────────────────────────────────────────────────┐');
        console.log('│ Dept  │ Dept User              │ Coordinator              │ HOD                │');
        console.log('├──────────────────────────────────────────────────────────────────────────┤');
        for (const dept of departments) {
            const code = dept.code.toLowerCase();
            console.log(`│ ${dept.code.padEnd(5)} │ ${code}.user@...         │ ${code}.coordinator@... │ hod.${code}@...     │`);
        }
        console.log('└──────────────────────────────────────────────────────────────────────────┘');

        console.log('\nPASSWORDS:');
        console.log('  - Dept Users:    Dept@2024');
        console.log('  - Coordinators:  Coord@2024');
        console.log('  - HODs:          Hod@2024');

        console.log('\n✅ Total Users Created/Updated:', createdUsers.length);
        console.log('✅ Total Departments:', createdDepts.length);
        console.log('✅ Total Budget Heads:', budgetHeads.length);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            console.log('\nMongoDB connection closed');
        }
        process.exit();
    }
}

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
        console.log(`   ⏭️  Updated: ${userData.email}`);
    } else {
        const user = new User(userData);
        await user.save();
        console.log(`   ✅ Created: ${userData.email}`);
    }
}

// Run the script
seedProduction();
