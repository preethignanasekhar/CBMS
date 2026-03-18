const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Department = require('./models/Department');

async function listDepts() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        const depts = await Department.find({}, 'name code');
        console.log('Departments in DB:');
        depts.forEach(d => console.log(`- ${d.name} (${d.code})`));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}
listDepts();
