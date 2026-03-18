const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/Admin/CBMS/.env' });
const BudgetProposal = require('c:/Users/Admin/CBMS/server/models/BudgetProposal');

async function debugProposal() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const proposal = await BudgetProposal.findOne({ totalProposedAmount: 2789500 })
      .populate('department', 'name')
      .populate('proposalItems.budgetHead', 'name');

    if (!proposal) {
      console.log('Proposal not found');
      process.exit(1);
    }

    console.log('Proposal Found:');
    console.log('ID:', proposal._id);
    console.log('Department:', proposal.department?.name);
    console.log('Financial Year:', proposal.financialYear);
    console.log('Status:', proposal.status);
    
    proposal.proposalItems.forEach((item, idx) => {
      console.log(`\nItem ${idx + 1}:`);
      console.log('Budget Head:', item.budgetHead?.name);
      console.log('Proposed Amount:', item.proposedAmount);
      console.log('Monthly Breakdown:', JSON.stringify(item.monthlyBreakdown, null, 2));
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

debugProposal();
