const mongoose = require('mongoose');
const User = require('./models/User');
require('./models/Department');
require('./models/BudgetHead');
const BudgetProposal = require('./models/BudgetProposal');
const AuditLog = require('./models/AuditLog');
require('dotenv').config();

async function debugProposal() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const proposals = await BudgetProposal.find({ status: 'verified_by_hod' })
            .populate('department', 'name')
            .populate('submittedBy', 'name email role');

        console.log('Proposals in verified_by_hod state:');
        proposals.forEach(p => {
            console.log(`ID: ${p._id} | Dept: ${p.department?.name} | Amount: ${p.totalProposedAmount} | ReadBy Count: ${p.readBy.length}`);
        });

        const auditCollection = mongoose.connection.collection('auditlogs');
        const recentLogs = await auditCollection.find({}).sort({ createdAt: -1 }).limit(10).toArray();

        console.log('\nRecent raw Audit Logs:');
        recentLogs.forEach(log => {
            console.log(`${log.createdAt.toISOString()} | ${log.eventType} | Actor: ${log.actor} | Role: ${log.actorRole}`);
        });

    } catch (err) {
        console.error('Debug script error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

debugProposal();
