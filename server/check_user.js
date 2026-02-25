const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config(); // Load from .env in current directory (root)

// Check if .env loaded
if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
}

const User = require('./models/User');

async function checkUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ email: 'principal@bms.com' });
        if (user) {
            console.log('User found:');
            console.log('Name:', user.name);
            console.log('Role:', user.role);
            console.log('Hashed Password:', user.password);
        } else {
            console.log('User principal@bms.com NOT found in database.');
        }

        const count = await User.countDocuments();
        console.log('Total users in DB:', count);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkUser();
