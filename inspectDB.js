
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const BudgetProposal = require('./server/models/BudgetProposal');

async function inspectProposals() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const proposals = await BudgetProposal.find({ status: 'verified' }).limit(5);
        console.log(`Found ${proposals.length} verified proposals.`);

        proposals.forEach((p, i) => {
            console.log(`\nProposal ${i + 1}: ${p._id}`);
            console.log(`Status: ${p.status}`);
            console.log(`Department: ${p.department}`);
            console.log('Approval Steps:', JSON.stringify(p.approvalSteps, null, 2));
        });

        // Test the query that Office uses
        const officeQuery = {
            status: 'verified',
            'approvalSteps.role': { $in: ['principal', 'vice_principal'] }
        };
        const officeResults = await BudgetProposal.find(officeQuery);
        console.log(`\nQuery test: Found ${officeResults.length} proposals for Office.`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

inspectProposals();
