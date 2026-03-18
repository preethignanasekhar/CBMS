const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/CBMS', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to DB. Dropping entire database...');
  await mongoose.connection.db.dropDatabase();
  console.log('Successfully dropped the entire database (all data deleted).');
  process.exit(0);
}).catch(err => {
  console.error('Error dropping database:', err);
  process.exit(1);
});
