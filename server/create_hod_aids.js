const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config();

const User = require('./models/User');
const Department = require('./models/Department');

async function createHOD() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected');

        // 1. Find or create the AIDS department
        let dept = await Department.findOne({ code: 'AIDS' });
        if (!dept) {
            console.log('AIDS Department not found, creating it...');
            dept = await Department.create({
                name: 'Artificial Intelligence and Data Science',
                code: 'AIDS',
                description: 'Department of AI & DS'
            });
            console.log('✅ Created AIDS Department');
        }

        const hodData = {
            name: 'HOD AI & DS',
            email: 'hod.aids@bms.com',
            password: 'pass123',
            role: 'hod',
            department: dept._id,
            isActive: true,
            permissions: {
                canApprove: true
            }
        };

        const existingUser = await User.findOne({ email: hodData.email });
        if (existingUser) {
            console.log(`User ${hodData.email} already exists. Updating password...`);
            existingUser.password = hodData.password;
            existingUser.department = dept._id;
            existingUser.role = 'hod';
            existingUser.isActive = true;
            await existingUser.save();
            console.log('✅ HOD user updated successfully');
        } else {
            console.log(`Creating new HOD user: ${hodData.email}...`);
            const hod = new User(hodData);
            await hod.save();
            console.log('✅ HOD user created successfully');
        }

        // Link HOD to Department
        const hodUser = await User.findOne({ email: hodData.email });
        dept.hod = hodUser._id;
        await dept.save();
        console.log('✅ HOD linked to Department');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

createHOD();
