const { MongoClient } = require('mongodb');
require('dotenv').config();

async function diagnose() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db();

        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        const proposalsColl = db.collection('budgetproposals');
        const expendituresColl = db.collection('expenditures');

        const proposals = await proposalsColl.find({}).toArray();
        console.log(`\nFound ${proposals.length} budget proposals:`);
        proposals.forEach(p => {
            console.log(` - ID: ${p._id}, Status: ${p.status}, Dept: ${p.department}, Year: ${p.financialYear}`);
        });

        const expenditures = await expendituresColl.find({}).toArray();
        console.log(`\nFound ${expenditures.length} expenditures:`);
        expenditures.forEach(e => {
            console.log(` - ID: ${e._id}, Event: ${e.eventName}, Status: ${e.status}, Dept: ${e.department}`);
        });

    } catch (err) {
        console.error('Diagnosis failed:', err);
    } finally {
        await client.close();
    }
}

diagnose();
