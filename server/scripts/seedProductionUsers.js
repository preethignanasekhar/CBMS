/**
 * CBMS Production Seed Script
 * Creates 10 departments with proper user-role assignments
 * 
 * Total Users: 34
 * - 4 Institution-level (Admin, Office, Principal, Auditor)
 * - 30 Department-level (3 per department × 10)
 * 
 * RUN: node scripts/seedProductionUsers.js
 */

const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const User = require('../models/User');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');

// Institution email domain
const EMAIL_DOMAIN = 'bms.edu.in';

// Department definitions
const departments = [
    { code: 'AIDS', name: 'Artificial Intelligence and Data Science' },
    { code: 'AIML', name: 'AIML' },
    { code: 'AUTO', name: 'Automobile Engineering' },
    { code: 'CIVIL', name: 'Civil Engineering' },
    { code: 'CSE', name: 'Computer Science' },
    { code: 'CYBER', name: 'Cyber Security' },
    { code: 'EEE', name: 'Electrical and Electronics Engineering' },
    { code: 'ECE', name: 'Electronics and Communication Engineering' },
    { code: 'IT', name: 'Information Technology' },
    { code: 'MECH', name: 'Mechanical Engineering' }
];

// Budget heads (predefined) - mapped to existing categories
const budgetHeads = [
    { name: 'Software', code: 'SOFT', category: 'infrastructure', budgetType: 'recurring' },
    { name: 'Laboratory Consumables', code: 'LAB-CONS', category: 'lab_equipment', budgetType: 'recurring' },
    { name: 'Maintenance and Spares', code: 'MAINT-SP', category: 'maintenance', budgetType: 'recurring' },
    { name: 'R&D', code: 'RD', category: 'academic', budgetType: 'recurring' },
    { name: 'Placement & Training Expenses', code: 'PLACE-TRAIN', category: 'academic', budgetType: 'recurring' },
    { name: 'Faculty Development & Training', code: 'FAC-DEV', category: 'academic', budgetType: 'recurring' },
    { name: 'Seminar, Conference, Training', code: 'SEM-CONF', category: 'events', budgetType: 'recurring' },
    { name: 'Association and Co Curricular Expenses', code: 'ASSOC-COCURR', category: 'academic', budgetType: 'recurring' },
    { name: 'Staff Welfare Expenses', code: 'STAFF-WELF', category: 'operations', budgetType: 'recurring' },
    { name: 'Printing & Stationery', code: 'PRINT-STAT', category: 'operations', budgetType: 'recurring' },
    { name: 'Postage Expenses', code: 'POST', category: 'operations', budgetType: 'recurring' },
    { name: 'Refreshment Expenses', code: 'REFR', category: 'operations', budgetType: 'recurring' },
    { name: 'Functions', code: 'FUNC', category: 'events', budgetType: 'recurring' },
    { name: 'Travelling Expenses', code: 'TRAVEL', category: 'operations', budgetType: 'recurring' }
];

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
        return existingUser;
    } else {
        const user = new User(userData);
        await user.save();
        console.log(`   ✅ Created: ${userData.email}`);
        return user;
    }
}

async function seedProduction() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI or MONGO_URI not found in .env');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // ========== PHASE 1: INSTITUTION-LEVEL USERS ==========
        console.log('========== PHASE 1: INSTITUTION USERS ==========\n');

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

        let adminUser;
        for (const userData of institutionUsers) {
            const user = await createOrUpdateUser(userData);
            if (user.role === 'admin') adminUser = user;
        }

        // ========== PHASE 2: BUDGET HEADS ==========
        console.log('\n========== PHASE 2: BUDGET HEADS ==========\n');
        for (const head of budgetHeads) {
            const exists = await BudgetHead.findOne({ code: head.code });
            if (!exists) {
                await BudgetHead.create({ ...head, createdBy: adminUser._id });
                console.log(`✅ Created: ${head.name}`);
            } else {
                console.log(`⏭️  Exists: ${head.name}`);
            }
        }

        // ========== PHASE 3: DEPARTMENTS ==========
        console.log('\n========== PHASE 3: DEPARTMENTS ==========\n');
        const createdDepts = [];
        for (const dept of departments) {
            let existingDept = await Department.findOne({
                $or: [{ code: dept.code }, { name: dept.name }]
            });

            if (!existingDept) {
                existingDept = await Department.create({
                    name: dept.name,
                    code: dept.code,
                    description: `${dept.name} Department`,
                    isActive: true
                });
                console.log(`✅ Created: ${dept.name}`);
            } else {
                // Update existing one to match desired config
                existingDept.name = dept.name;
                existingDept.code = dept.code;
                await existingDept.save();
                console.log(`⏭️  Updated existing: ${dept.name} (${dept.code})`);
            }
            createdDepts.push(existingDept);
        }

        // ========== PHASE 4: DEPARTMENT-LEVEL USERS ==========
        console.log('\n========== PHASE 4: DEPARTMENT USERS ==========\n');

        for (const dept of createdDepts) {
            const deptCode = dept.code.toLowerCase();
            console.log(`\n--- ${dept.name} ---`);

            // 1. Department User
            const deptUser = {
                name: `${dept.code} Department User`,
                email: `${deptCode}.user@${EMAIL_DOMAIN}`,
                password: 'Dept@2024',
                role: 'department',
                department: dept._id,
                permissions: { canApprove: false }
            };
            await createOrUpdateUser(deptUser);

            // 2. Budget Coordinator
            const coordinator = {
                name: `${dept.code} Budget Coordinator`,
                email: `${deptCode}.coordinator@${EMAIL_DOMAIN}`,
                password: 'Coord@2024',
                role: 'department',
                department: dept._id,
                permissions: { canApprove: false }
            };
            await createOrUpdateUser(coordinator);

            // 3. HOD
            const hodData = {
                name: `Dr. HOD ${dept.code}`,
                email: `hod.${deptCode}@${EMAIL_DOMAIN}`,
                password: 'Hod@2024',
                role: 'hod',
                department: dept._id,
                permissions: { canApprove: true }
            };
            const hodUser = await createOrUpdateUser(hodData);

            // Link HOD to department
            await Department.findByIdAndUpdate(dept._id, { hod: hodUser._id });
            console.log(`   ✅ HOD linked to department`);
        }

        console.log('\n\n========================================');
        console.log('         SETUP COMPLETE                 ');
        console.log('========================================\n');

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

seedProduction();
