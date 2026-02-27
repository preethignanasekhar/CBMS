const mongoose = require('mongoose');
require('dotenv').config();

// Load models
const Department = require('./server/models/Department');
const BudgetHead = require('./server/models/BudgetHead');
const User = require('./server/models/User');
const Allocation = require('./server/models/Allocation');

async function checkId() {
    const targetId = '699d5a929c8c2e7d974dfe14';
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to Database');

        // Check Department
        const dept = await Department.findById(targetId);
        if (dept) {
            console.log('Found in Departments:', dept.name);
            console.log('Full document:', JSON.stringify(dept, null, 2));
        }

        // Check BudgetHead
        const bh = await BudgetHead.findById(targetId);
        if (bh) {
            console.log('Found in BudgetHeads:', bh.name);
            console.log('Full document:', JSON.stringify(bh, null, 2));
        }

        // Check User
        const user = await User.findById(targetId);
        if (user) {
            console.log('Found in Users:', user.name);
            console.log('Full document:', JSON.stringify(user, null, 2));
        }

        // Check Allocation
        const alloc = await Allocation.findById(targetId);
        if (alloc) {
            console.log('Found in Allocations:', alloc._id);
            console.log('Full document:', JSON.stringify(alloc, null, 2));
        }

        if (!dept && !bh && !user && !alloc) {
            console.log('No document found with this ID in standard collections.');
        }

        await mongoose.connection.close();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkId();
