const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BudgetProposal = require('./models/BudgetProposal');
const User = require('./models/User');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const users = await User.find({}, 'email role');
    console.log('Users found:', users.length);
    
    const proposals = await BudgetProposal.find();
    console.log('Proposals found:', proposals.length);
    
    if (proposals.length > 0) {
      console.log('First proposal:', JSON.stringify(proposals[0], null, 2));
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();
