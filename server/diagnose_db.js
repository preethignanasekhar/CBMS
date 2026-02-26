const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./server/models/User');
const BudgetProposal = require('./server/models/BudgetProposal');
const Expenditure = require('./server/models/Expenditure');

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const proposalCount = await BudgetProposal.countDocuments({});
        console.log('Total Budget Proposals:', proposalCount);

        const expenditureCount = await Expenditure.countDocuments({});
        console.log('Total Expenditures:', expenditureCount);

        const proposals = await BudgetProposal.find({}).limit(5).populate('department', 'name');
        console.log('Sample Proposals:', JSON.stringify(proposals, null, 2));

        const expenditures = await Expenditure.find({}).limit(5).populate('department', 'name');
        console.log('Sample Expenditures:', JSON.stringify(expenditures, null, 2));

        mongoose.connection.close();
    } catch (err) {
        console.error('Diagnosis failed:', err);
    }
}

diagnose();
