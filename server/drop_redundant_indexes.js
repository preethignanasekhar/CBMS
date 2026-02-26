const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbOptions = {
    serverSelectionTimeoutMS: 30000,
    family: 4
};

async function cleanupIndexes() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri, dbOptions);
        const db = mongoose.connection.db;

        // Use actual names from MongoDB
        const collections = ['allocations', 'budget_overrides', 'allocation_amendments', 'incomes'];

        for (const collName of collections) {
            try {
                const coll = db.collection(collName);
                const indexes = await coll.indexes();
                console.log(`--- Checking ${collName} ---`);

                for (const index of indexes) {
                    if (index.name === '_id_') continue;

                    let shouldDrop = false;
                    if (collName === 'allocations' && index.name === 'financialYear_1') {
                        shouldDrop = true;
                    }

                    if (shouldDrop) {
                        console.log(`Dropping redundant index: ${index.name} from ${collName}`);
                        await coll.dropIndex(index.name);
                    }
                }
            } catch (err) {
                if (err.code === 26 || err.message.includes('ns does not exist')) {
                    console.log(`Collection ${collName} does not exist, skipping.`);
                } else {
                    console.error(`Error on ${collName}:`, err.message);
                }
            }
        }

        console.log('✅ Index cleanup complete.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

cleanupIndexes();
