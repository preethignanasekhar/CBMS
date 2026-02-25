const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config();

const User = require('./models/User');

async function listUsers() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected');

        const users = await User.find({}, 'email role isActive');
        console.log('\n--- Users in Database ---');
        users.forEach(u => {
            console.log(`Email: ${u.email} | Role: ${u.role} | Active: ${u.isActive}`);
        });
        console.log('-------------------------\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

listUsers();
