const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
require('./models/Department');
require('./models/BudgetHead');
require('./models/Allocation');
require('./models/Expenditure');
require('./models/AllocationHistory');
require('./models/BudgetProposal');
require('./models/AllocationAmendment');

const allocationController = require('./controllers/allocationController');

const dbOptions = {
    serverSelectionTimeoutMS: 30000,
    family: 4
};

async function debugAllocations() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri, dbOptions);

        const user = await User.findOne({ name: 'AIDS Budget Coordinator' });

        // Mock req, res
        const req = {
            query: { financialYear: '2025-2026' },
            user: user
        };

        const res = {
            json: (data) => {
                console.log('Response Success:', data.success);
                console.log('Allocations count:', data.data.allocations.length);
                if (data.data.allocations.length > 0) {
                    const alloc = data.data.allocations[0];
                    console.log('Sample Allocation:');
                    console.log('- _id:', alloc._id);
                    console.log('- financialYear:', alloc.financialYear);
                    console.log('- budgetHead:', typeof alloc.budgetHead);
                    console.log('- budgetHeadId:', alloc.budgetHeadId);
                    console.log('- remainingAmount:', alloc.remainingAmount);
                    console.log('- allocatedAmount:', alloc.allocatedAmount);
                    console.log('- spentAmount:', alloc.spentAmount);
                }
            },
            status: (code) => ({
                json: (data) => console.log(`Status ${code}:`, data)
            })
        };

        await allocationController.getAllocations(req, res);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugAllocations();
