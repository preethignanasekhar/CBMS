const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Expenditure = require('./models/Expenditure');
const Allocation = require('./models/Allocation');
const AuditLog = require('./models/AuditLog');

async function checkRecentData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cbms');
        console.log('Connected to DB');

        const latestExpenditure = await Expenditure.findOne().sort({ createdAt: -1 });
        const latestAllocation = await Allocation.findOne().sort({ createdAt: -1 });
        const latestAudit = await AuditLog.findOne().sort({ timestamp: -1 });

        console.log('\n--- Latest Record Timestamps ---');
        console.log('Latest Expenditure:', latestExpenditure ? latestExpenditure.createdAt : 'None');
        console.log('Latest Allocation:', latestAllocation ? latestAllocation.createdAt : 'None');
        console.log('Latest Audit Log:', latestAudit ? latestAudit.timestamp : 'None');
        console.log('-------------------------------\n');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

checkRecentData();
