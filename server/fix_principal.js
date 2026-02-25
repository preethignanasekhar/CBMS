const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config();

const User = require('./models/User');

async function fixPrincipal() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected');

        const principalData = {
            name: 'Dr. Principal',
            email: 'principal@bms.com',
            password: 'principal123',
            role: 'principal',
            isActive: true,
            permissions: {
                canApprove: true,
                exportReports: true
            }
        };

        const existingUser = await User.findOne({ email: principalData.email });
        if (existingUser) {
            console.log('Principal user exists. Updating details...');
            existingUser.password = principalData.password;
            existingUser.isActive = true;
            existingUser.role = 'principal';
            await existingUser.save();
            console.log('✅ Principal user updated successfully');
        } else {
            console.log('Creating new Principal user...');
            const principal = new User(principalData);
            await principal.save();
            console.log('✅ Principal user created successfully');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

fixPrincipal();
