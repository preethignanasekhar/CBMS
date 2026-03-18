const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const BudgetHead = require('./models/BudgetHead');
const User = require('./models/User');

async function updateBudgetHeads() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) throw new Error('MONGODB_URI not found');

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // 1. Get Admin user for createdBy field
        const admin = await User.findOne({ role: 'admin' });
        if (!admin) throw new Error('Admin user not found');

        // 2. Clear existing budget heads
        await BudgetHead.deleteMany({});
        console.log('Cleared existing budget heads');

        // 3. Define new budget heads from user image
        const newHeads = [
            { name: 'Software', code: 'SOFT', category: 'infrastructure' },
            { name: 'Laboratory Consumables', code: 'LAB-CONS', category: 'lab_equipment' },
            { name: 'Maintenance and Spares', code: 'MAINT-SP', category: 'maintenance' },
            { name: 'R&D', code: 'RD', category: 'academic' },
            { name: 'Placement & Training Expenses', code: 'PLACE-TRAIN', category: 'academic' },
            { name: 'Faculty Development & Training', code: 'FAC-DEV', category: 'academic' },
            { name: 'Seminar, Conference, Training', code: 'SEM-CONF', category: 'events' },
            { name: 'Association and Co Curricular Expenses', code: 'ASSOC-COCURR', category: 'academic' },
            { name: 'Staff Welfare Expenses', code: 'STAFF-WELF', category: 'operations' },
            { name: 'Printing & Stationery', code: 'PRINT-STAT', category: 'operations' },
            { name: 'Postage Expenses', code: 'POST', category: 'operations' },
            { name: 'Refreshment Expenses', code: 'REFR', category: 'operations' },
            { name: 'Functions', code: 'FUNC', category: 'events' },
            { name: 'Travelling Expenses', code: 'TRAVEL', category: 'operations' }
        ];

        // 4. Insert new heads
        for (const head of newHeads) {
            await BudgetHead.create({
                ...head,
                budgetType: 'recurring',
                createdBy: admin._id,
                isActive: true
            });
            console.log(`✅ Created: ${head.name}`);
        }

        console.log('\nAll budget heads updated successfully!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

updateBudgetHeads();
