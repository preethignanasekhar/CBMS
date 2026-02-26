const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const Allocation = require('./models/Allocation');
require('./models/Department');
require('./models/BudgetHead');
require('./models/BudgetProposal');
require('./models/AllocationAmendment');
require('./models/FinancialYear');
require('./models/User');

const dbOptions = {
    serverSelectionTimeoutMS: 30000,
    family: 4
};

async function verifyIndexes() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri, dbOptions);

        console.log('--- Allocation Indexes ---');
        const indexes = await Allocation.collection.getIndexes();
        console.log(JSON.stringify(indexes, null, 2));

        const financialYearIndex = Object.keys(indexes).find(name => indexes[name].key && indexes[name].key.financialYear === 1 && Object.keys(indexes[name].key).length === 1);

        if (financialYearIndex) {
            console.log('⚠️  Redundant financialYear index STILL EXISTS:', financialYearIndex);
        } else {
            console.log('✅ Redundant financialYear index is GONE.');
        }

        const compoundIndex = Object.keys(indexes).find(name => {
            const keys = indexes[name].key;
            return keys.financialYear === 1 && keys.department === 1 && keys.budgetHead === 1;
        });

        if (compoundIndex) {
            console.log('✅ Compound index exists:', compoundIndex);
        } else {
            console.log('⚠️  Compound index MISSING!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyIndexes();
