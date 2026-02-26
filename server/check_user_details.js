const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dotenv.config({ path: path.join(__dirname, '../.env') });

require('./models/Department'); // Register Department model
const User = require('./models/User');

const dbOptions = {
    serverSelectionTimeoutMS: 30000,
    family: 4
};

async function checkUser() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri, dbOptions);

        const user = await User.findOne({ name: 'AIDS Budget Coordinator' }).populate('department');
        if (!user) {
            console.log('User not found');
            return;
        }

        console.log('User Details:');
        console.log(`- Name: ${user.name}`);
        console.log(`- Role: ${user.role}`);
        console.log(`- Department ID: ${user.department?._id}`);
        console.log(`- Department Name: ${user.department?.name}`);
        console.log(`- Department Code: ${user.department?.code}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkUser();
