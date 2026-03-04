const mongoose = require('mongoose');
const Department = require('./models/Department');

async function updateDept() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/cbms');
        const result = await Department.updateOne(
            { code: 'AIML' },
            { $set: { name: 'Artificial Intelligence and Machine Learning' } }
        );
        console.log('Update Result:', result);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateDept();
