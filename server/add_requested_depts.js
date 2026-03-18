const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Department = require('./models/Department');

const newDepts = [
    { name: 'VLSI Design', code: 'VLSI' },
    { name: 'Master of Computer Applications', code: 'MCA' },
    { name: 'Science and Humanities', code: 'S&H' },
    { name: 'Library', code: 'LIB' },
    { name: 'Physical Education', code: 'PED' }
];

async function addDepts() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('Connected to DB');

        for (const dept of newDepts) {
            const exists = await Department.findOne({ code: dept.code });
            if (!exists) {
                await Department.create(dept);
                console.log(`Added: ${dept.name} (${dept.code})`);
            } else {
                console.log(`Already exists: ${dept.code}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

addDepts();
