const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

require('./models/Department');
require('./models/BudgetHead');
const Allocation = require('./models/Allocation');

const dbOptions = {
    serverSelectionTimeoutMS: 30000,
    family: 4
};

async function checkAllAllocations() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri, dbOptions);

        const allocations = await Allocation.find({})
            .populate('department', 'name code')
            .populate('budgetHead', 'name');

        console.log(`Found ${allocations.length} total allocations in database:`);
        allocations.forEach(alloc => {
            console.log(`- FY: ${alloc.financialYear}, Dept: ${alloc.department?.code}, Head: ${alloc.budgetHead?.name}, Allocated: ${alloc.allocatedAmount}, Spent: ${alloc.spentAmount}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkAllAllocations();
