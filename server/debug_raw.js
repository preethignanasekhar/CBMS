const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/Admin/CBMS/.env' });

async function debugRaw() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collection = db.collection('budgetproposals');
    
    // Find the specific proposal for AIDS department with amount 2789500
    const proposal = await collection.findOne({ totalProposedAmount: 2789500 });
    
    if (proposal) {
      console.log('RAW DOCUMENT:');
      console.log(JSON.stringify(proposal, null, 2));
    } else {
      console.log('Proposal not found');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

debugRaw();
