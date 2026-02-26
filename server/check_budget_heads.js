const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const BudgetHead = require('./models/BudgetHead');

const dbOptions = {
    serverSelectionTimeoutMS: 30000,
    family: 4
};

async function checkBudgetHeads() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri, dbOptions);

        const heads = await BudgetHead.find({});
        console.log(`Found ${heads.length} budget heads:`);
        heads.forEach(h => {
            console.log(`- ${h.name} (${h._id}) [Active: ${h.isActive}]`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkBudgetHeads();
