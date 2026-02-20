const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function seedAdmin() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in .env');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        const adminData = {
            name: 'Office Admin',
            email: 'office@bms.com',
            password: 'office123',
            role: 'admin',
            permissions: {
                superAdmin: true,
                manageUsers: true,
                manageBudgets: true,
                exportReports: true,
                canApprove: true
            }
        };

        const existingUser = await User.findOne({ email: adminData.email });
        if (existingUser) {
            console.log(`User ${adminData.email} already exists. Updating password...`);
            existingUser.password = adminData.password;
            // We need to trigger the pre-save hook for password hashing
            await existingUser.save();
            console.log('✅ Admin user updated successfully');
        } else {
            console.log(`Creating new admin user: ${adminData.email}...`);
            const admin = new User(adminData);
            await admin.save();
            console.log('✅ Admin user created successfully');
        }

    } catch (error) {
        console.error('❌ Error seeding admin:', error.message);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
        }
        process.exit();
    }
}

seedAdmin();
