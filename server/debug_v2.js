const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/Admin/CBMS/.env' });

const budgetProposalSchema = new mongoose.Schema({
  totalProposedAmount: Number,
  proposalItems: [{
    budgetHead: mongoose.Schema.Types.ObjectId,
    proposedAmount: Number,
    monthlyBreakdown: {
      apr: Number, may: Number, jun: Number, jul: Number, aug: Number, sep: Number, 
      oct: Number, nov: Number, dec: Number, jan: Number, feb: Number, mar: Number
    }
  }]
}, { collection: 'budgetproposals' });

const BudgetProposal = mongoose.model('BudgetProposal', budgetProposalSchema);

async function debug() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected');

    const proposals = await BudgetProposal.find({}).limit(20);
    console.log(`Found ${proposals.length} proposals total.`);

    const target = proposals.find(p => p.totalProposedAmount === 2789500);
    
    if (target) {
      console.log('FOUND TARGET PROPOSAL:');
      console.log(JSON.stringify(target, null, 2));
    } else {
      console.log('Target proposal (₹27,89,500) not found in first 20. Listing all amounts:');
      proposals.forEach(p => console.log(`- ₹${p.totalProposedAmount}`));
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

debug();
