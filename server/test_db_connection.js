const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const dns = require('dns');

// Fix for ECONNREFUSED on querySrv for MongoDB Atlas
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoUri = process.env.MONGODB_URI;

console.log('Testing MongoDB Connection...');
console.log('URI:', mongoUri ? mongoUri.replace(/:.*@/, ':****@') : 'UNDEFINED');

if (!mongoUri) {
    console.error('ERROR: MONGODB_URI is not defined in .env');
    process.exit(1);
}

mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000
})
    .then(() => {
        console.log('✅ Connection Successful!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Connection Failed:', err.message);
        process.exit(1);
    });
