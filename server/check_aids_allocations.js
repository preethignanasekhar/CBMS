const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

// Fix for MongoDB Atlas ECONNREFUSED on querySrv
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

dotenv.config({ path: path.join(__dirname, '../.env') });

const Allocation = require('./models/Allocation');
const Department = require('./models/Department');
const BudgetHead = require('./models/BudgetHead');

const dbOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
    connectTimeoutMS: 30000,
    family: 4
};

async function checkAllocations() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri, dbOptions);
        console.log('Connected to MongoDB');

        const aidsDept = await Department.findOne({ code: 'AIDS' });
        if (!aidsDept) {
            console.log('AIDS department not found');
            return;
        }

        console.log(`Checking allocations for AIDS Department (${aidsDept._id})...`);

        const allocations = await Allocation.find({
            department: aidsDept._id
        }).populate('budgetHead', 'name');

        console.log(`Found ${allocations.length} allocations for AIDS department:`);
        allocations.forEach(alloc => {
            console.log(`- FY: ${alloc.financialYear}, Head: ${alloc.budgetHead?.name} (${alloc.budgetHead?._id}), Allocated: ${alloc.allocatedAmount}, Spent: ${alloc.spentAmount}, Remaining: ${alloc.allocatedAmount - alloc.spentAmount}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkAllocations();
