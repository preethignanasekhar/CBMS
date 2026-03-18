const mongoose = require('mongoose');
require('dotenv').config();

const Allocation = require('./models/Allocation');
const AllocationAmendment = require('./models/AllocationAmendment');
const AllocationHistory = require('./models/AllocationHistory');
const AuditLog = require('./models/AuditLog');
const BudgetOverride = require('./models/BudgetOverride');
const BudgetProposal = require('./models/BudgetProposal');
const BulkUploadLog = require('./models/BulkUploadLog');
const Expenditure = require('./models/Expenditure');
const Income = require('./models/Income');
const Notification = require('./models/Notification');
const PushSubscription = require('./models/PushSubscription');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/CBMS', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to DB for total transactional cleanup...');
  
  await Allocation.deleteMany({});
  await AllocationAmendment.deleteMany({});
  await AllocationHistory.deleteMany({});
  await AuditLog.deleteMany({});
  await BudgetOverride.deleteMany({});
  await BudgetProposal.deleteMany({});
  await BulkUploadLog.deleteMany({});
  await Expenditure.deleteMany({});
  await Income.deleteMany({});
  await Notification.deleteMany({});
  await PushSubscription.deleteMany({});
  
  console.log('Deleted all transactional data (Proposals, Expenditures, Allocations, Audit Logs, Notifications, etc.)!');
  console.log('Core data (Users, Departments, Budget Heads, etc.) remains intact.');
  process.exit(0);
}).catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
