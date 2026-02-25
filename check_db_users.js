const mongoose = require('mongoose');
const User = require('./server/models/User');
require('dotenv').config({ path: './server/.env' });

async function checkUsers() {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({}, 'name email role');
    console.log(JSON.stringify(users, null, 2));
    await mongoose.connection.close();
}

checkUsers();
