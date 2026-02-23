const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

// Fix for MongoDB Atlas ECONNREFUSED on querySrv
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const User = require('../models/User');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');

async function seedAllUsers() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in .env');
        }

        console.log('Connecting to MongoDB...');
        const dbOptions = {
            serverSelectionTimeoutMS: 30000,
            family: 4
        };
        await mongoose.connect(mongoUri, dbOptions);
        console.log('✅ Connected to MongoDB');

        // Create sample departments first
        const departments = [
            { name: 'Computer Science', code: 'CS', description: 'Computer Science Department' },
            { name: 'Electronics', code: 'ECE', description: 'Electronics & Communication Department' },
            { name: 'Mechanical', code: 'MECH', description: 'Mechanical Engineering Department' }
        ];

        const createdDepts = [];
        for (const dept of departments) {
            let existingDept = await Department.findOne({ code: dept.code });
            if (!existingDept) {
                existingDept = await Department.create(dept);
                console.log(`✅ Created department: ${dept.name}`);
            } else {
                console.log(`Department ${dept.name} already exists`);
            }
            createdDepts.push(existingDept);
        }

        // Define all test users
        const users = [
            // Admin
            {
                name: 'System Admin',
                email: 'admin@bms.com',
                password: 'admin123',
                role: 'admin',
                permissions: { superAdmin: true, manageUsers: true, manageBudgets: true, exportReports: true, canApprove: true }
            },
            // Office
            {
                name: 'Office Staff',
                email: 'office@bms.com',
                password: 'office123',
                role: 'office',
                permissions: { manageUsers: false, manageBudgets: true, exportReports: true, canApprove: true }
            },
            // Principal
            {
                name: 'Dr. Principal',
                email: 'principal@bms.com',
                password: 'principal123',
                role: 'principal',
                permissions: { canApprove: true, exportReports: true }
            },
            // Vice Principal
            {
                name: 'Dr. Vice Principal',
                email: 'vp@bms.com',
                password: 'vp123',
                role: 'vice_principal',
                permissions: { canApprove: true, exportReports: true }
            },
            // HODs (one per department)
            {
                name: 'Dr. CS HOD',
                email: 'hod.cs@bms.com',
                password: 'hod123',
                role: 'hod',
                department: createdDepts[0]._id,
                permissions: { canApprove: true }
            },
            {
                name: 'Dr. ECE HOD',
                email: 'hod.ece@bms.com',
                password: 'hod123',
                role: 'hod',
                department: createdDepts[1]._id,
                permissions: { canApprove: true }
            },
            {
                name: 'Dr. MECH HOD',
                email: 'hod.mech@bms.com',
                password: 'hod123',
                role: 'hod',
                department: createdDepts[2]._id,
                permissions: { canApprove: true }
            },
            // Department Users (Budget Coordinators)
            {
                name: 'CS Budget Coordinator',
                email: 'cs.user@bms.com',
                password: 'dept123',
                role: 'department',
                department: createdDepts[0]._id,
                permissions: {}
            },
            {
                name: 'ECE Budget Coordinator',
                email: 'ece.user@bms.com',
                password: 'dept123',
                role: 'department',
                department: createdDepts[1]._id,
                permissions: {}
            },
            {
                name: 'MECH Budget Coordinator',
                email: 'mech.user@bms.com',
                password: 'dept123',
                role: 'department',
                department: createdDepts[2]._id,
                permissions: {}
            },
            // Auditor
            {
                name: 'External Auditor',
                email: 'auditor@bms.com',
                password: 'auditor123',
                role: 'auditor',
                permissions: { exportReports: true }
            }
        ];

        console.log('\n--- Creating Users ---\n');

        let adminUser;
        for (const userData of users) {
            let user = await User.findOne({ email: userData.email });
            if (user) {
                console.log(`User ${userData.email} already exists, updating...`);
                user.password = userData.password;
                user.name = userData.name;
                user.role = userData.role;
                if (userData.department) user.department = userData.department;
                user.permissions = userData.permissions;
                await user.save();
                console.log(`✅ Updated: ${userData.email}`);
            } else {
                user = new User(userData);
                await user.save();
                console.log(`✅ Created: ${userData.email}`);
            }
            if (user.role === 'admin') adminUser = user;
        }

        // Create sample budget heads
        const budgetHeads = [
            { name: 'Lab Equipment', code: 'LAB-EQ', category: 'laboratory_equipment', budgetType: 'recurring', createdBy: adminUser._id },
            { name: 'Seminars', code: 'SEM', category: 'seminar_conference', budgetType: 'recurring', createdBy: adminUser._id },
            { name: 'Workshops', code: 'WS', category: 'seminar_conference', budgetType: 'recurring', createdBy: adminUser._id },
            { name: 'Guest Lectures', code: 'GL', category: 'other', budgetType: 'recurring', createdBy: adminUser._id },
            { name: 'Maintenance', code: 'MAINT', category: 'maintenance_spares', budgetType: 'recurring', createdBy: adminUser._id },
            { name: 'Stationery', code: 'STAT', category: 'printing_stationery', budgetType: 'recurring', createdBy: adminUser._id }
        ];

        for (const head of budgetHeads) {
            const exists = await BudgetHead.findOne({ code: head.code });
            if (!exists) {
                await BudgetHead.create(head);
                console.log(`✅ Created budget head: ${head.name}`);
            } else {
                console.log(`Budget head ${head.name} already exists`);
            }
        }

        // Update departments with HODs
        await Department.findByIdAndUpdate(createdDepts[0]._id, {
            hod: (await User.findOne({ email: 'hod.cs@bms.com' }))._id
        });
        await Department.findByIdAndUpdate(createdDepts[1]._id, {
            hod: (await User.findOne({ email: 'hod.ece@bms.com' }))._id
        });
        await Department.findByIdAndUpdate(createdDepts[2]._id, {
            hod: (await User.findOne({ email: 'hod.mech@bms.com' }))._id
        });
        console.log('\n✅ Departments updated with HODs');

        console.log('\n========================================');
        console.log('       ALL TEST USERS CREATED          ');
        console.log('========================================\n');

        console.log('| Role             | Email                | Password     |');
        console.log('|------------------|----------------------|--------------|');
        console.log('| Admin            | admin@bms.com        | admin123     |');
        console.log('| Office           | office@bms.com       | office123    |');
        console.log('| Principal        | principal@bms.com    | principal123 |');
        console.log('| Vice Principal   | vp@bms.com           | vp123        |');
        console.log('| HOD (CS)         | hod.cs@bms.com       | hod123       |');
        console.log('| HOD (ECE)        | hod.ece@bms.com      | hod123       |');
        console.log('| HOD (MECH)       | hod.mech@bms.com     | hod123       |');
        console.log('| Dept User (CS)   | cs.user@bms.com      | dept123      |');
        console.log('| Dept User (ECE)  | ece.user@bms.com     | dept123      |');
        console.log('| Dept User (MECH) | mech.user@bms.com    | dept123      |');
        console.log('| Auditor          | auditor@bms.com      | auditor123   |');
        console.log('');

    } catch (error) {
        console.error('❌ Error seeding users:', error.message);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
        }
        process.exit();
    }
}

seedAllUsers();
