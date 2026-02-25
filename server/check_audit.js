const mongoose = require('mongoose');
const AuditLog = require('./models/AuditLog');
require('dotenv').config();

async function checkAudit() {
    await mongoose.connect(process.env.MONGODB_URI);
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(10);
    console.log(JSON.stringify(logs, null, 2));
    await mongoose.connection.close();
}

checkAudit();
