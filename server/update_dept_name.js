const mongoose = require('mongoose');
const Department = require('./models/Department');

async function updateDept() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/cbms');
        const result = await Department.updateOne(
            { name: 'Artificial Intelligence and Machine Learning' },
            { $set: { name: 'AIML' } }
        );
        console.log('Update Result:', result);

        // Also update Artificial Intelligence and Data Science if that was intended, 
        // but user only specifically mentioned AIML. 
        // Actually, let's keep it simple as per user request.

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateDept();
