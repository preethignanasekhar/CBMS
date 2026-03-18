const mongoose = require('mongoose');

async function drop() {
  try {
    const uri = 'mongodb://127.0.0.1:27017/cbms';
    await mongoose.connect(uri, { family: 4 });
    console.log('Connected to cbms DB. Dropping...');
    await mongoose.connection.db.dropDatabase();
    console.log('Successfully dropped cbms.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

drop();
