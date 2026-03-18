const mongoose = require('mongoose');
require('dotenv').config();

const BudgetProposal = require('./models/BudgetProposal');
const Expenditure = require('./models/Expenditure');
const Allocation = require('./models/Allocation');
const AllocationHistory = require('./models/AllocationHistory');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/CBMS', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to DB for cleanup...');
  
  await BudgetProposal.deleteMany({});
  console.log('Deleted all BudgetProposals');
  
  await Expenditure.deleteMany({});
  console.log('Deleted all Expenditures');
  
  await Allocation.deleteMany({});
  console.log('Deleted all Allocations');
  
  await AllocationHistory.deleteMany({});
  console.log('Deleted all AllocationHistories');
  
  console.log('Cleanup complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
