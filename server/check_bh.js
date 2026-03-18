const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/Admin/CBMS/.env' });

async function checkBH() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const bh = await db.collection('budgetheads').findOne({ _id: new mongoose.Types.ObjectId("69a68a18353cfc5a755d9185") });
    console.log('Budget Head:', JSON.stringify(bh, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkBH();
