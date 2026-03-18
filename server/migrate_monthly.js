const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/Admin/CBMS/.env' });

async function fixProposals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const BudgetProposal = mongoose.connection.collection('budgetproposals');
    
    // Find proposals where at least one item is missing monthlyBreakdown
    const proposals = await BudgetProposal.find({}).toArray();
    console.log(`Checking ${proposals.length} proposals...`);

    let updatedCount = 0;
    for (const proposal of proposals) {
      let changed = false;
      const updatedItems = proposal.proposalItems.map(item => {
        if (!item.monthlyBreakdown) {
          changed = true;
          return {
            ...item,
            monthlyBreakdown: {
              apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, 
              oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0
            }
          };
        }
        return item;
      });

      if (changed) {
        await BudgetProposal.updateOne(
          { _id: proposal._id },
          { $set: { proposalItems: updatedItems } }
        );
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} proposals with missing monthlyBreakdown.`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

fixProposals();
