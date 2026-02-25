const mongoose = require('mongoose');
const User = require('./models/User');
const Department = require('./models/Department');
const BudgetHead = require('./models/BudgetHead');
const Expenditure = require('./models/Expenditure');
const Allocation = require('./models/Allocation');
require('dotenv').config();

async function simulateSubmit() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const user = await User.findOne({ email: 'aids.coordinator@bms.edu.in' });
    const dept = await Department.findOne({ _id: user.department });
    const head = await BudgetHead.findOne({ name: 'Seminars & Conferences' });

    if (!user || !dept || !head) {
        console.log('User, Dept or Head not found');
        await mongoose.connection.close();
        return;
    }

    // Check if allocation exists
    const financialYear = '2026-2027'; // Based on screenshot date 2026-03-06
    const allocation = await Allocation.findOne({
        department: dept._id,
        budgetHead: head._id,
        financialYear
    });

    console.log('Allocation found:', !!allocation);
    if (allocation) {
        console.log('Remaining:', allocation.allocatedAmount - allocation.spentAmount);
    }

    const req = {
        user: user,
        body: {
            budgetHead: head._id.toString(),
            eventName: 'varanam',
            eventType: 'Research',
            eventDate: '2026-03-06',
            description: 'Test description',
            expenseItems: [
                {
                    category: 'MISCELLANEOUS',
                    billNumber: '12324354',
                    billDate: '2026-02-24',
                    vendorName: 'xyz',
                    amount: 500
                }
            ]
        },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'node-test' }
    };

    const res = {
        json: (data) => console.log('Response:', JSON.stringify(data, null, 2)),
        status: (code) => {
            console.log('Status Code:', code);
            return {
                json: (data) => console.log('Response:', JSON.stringify(data, null, 2))
            };
        }
    };

    const { submitExpenditure } = require('./controllers/expenditureController');

    try {
        console.log('Executing submitExpenditure...');
        await submitExpenditure(req, res);
    } catch (err) {
        console.error('Controller Crashed:', err);
    }

    await mongoose.connection.close();
}

simulateSubmit();
