const mongoose = require('mongoose');
require('./models/Department');
require('./models/BudgetHead');
require('dotenv').config();

async function listInfo() {
    await mongoose.connect(process.env.MONGODB_URI);

    const depts = await mongoose.model('Department').find({}, 'name code');
    console.log('Departments:', JSON.stringify(depts, null, 2));

    const heads = await mongoose.model('BudgetHead').find({}, 'name category');
    console.log('Budget Heads:', JSON.stringify(heads, null, 2));

    await mongoose.connection.close();
}

listInfo();
