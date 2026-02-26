const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoUri = process.env.MONGODB_URI;

const BudgetProposal = require('./models/BudgetProposal');
const Expenditure = require('./models/Expenditure');

async function diagnose() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to DB');

        const proposals = await BudgetProposal.find({}).limit(5);
        const expenditures = await Expenditure.find({}).limit(5);

        console.log('Total Proposals:', await BudgetProposal.countDocuments({}));
        console.log('Proposals Sample Statuses:', proposals.map(p => p.status));

        console.log('Total Expenditures:', await Expenditure.countDocuments({}));
        console.log('Expenditures Sample:', expenditures.map(e => ({
            name: e.eventName,
            amount: e.totalAmount,
            status: e.status
        })));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

diagnose();
