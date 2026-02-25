const mongoose = require('mongoose');
const User = require('./models/User');
const BudgetProposal = require('./models/BudgetProposal');
require('./models/Department');
require('./models/BudgetHead');
require('dotenv').config();

async function simulatePrincipalVerification() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find Dr. Principal
    const principal = await User.findOne({ email: 'principal@bms.edu.in' });

    // Find the AI & DS proposal
    const Dept = mongoose.model('Department');
    const dept = await Dept.findOne({ name: /Artificial Intelligence/i });
    const proposal = await BudgetProposal.findOne({ department: dept._id, status: 'verified_by_hod' });

    if (!principal || !proposal) {
        console.log('User or Proposal not found');
        await mongoose.connection.close();
        return;
    }

    // Mock req.user and req.params
    const req = {
        user: principal,
        params: { id: proposal._id.toString() },
        body: { remarks: 'Looks good' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'node-test' }
    };

    // Mock res
    const res = {
        json: (data) => console.log('Response:', JSON.stringify(data, null, 2)),
        status: (code) => ({
            json: (data) => console.log(`Status ${code}:`, JSON.stringify(data, null, 2))
        })
    };

    // Import the controller function
    const { verifyBudgetProposal } = require('./controllers/budgetProposalController');

    try {
        console.log('Executing verifyBudgetProposal as Principal...');
        await verifyBudgetProposal(req, res);
    } catch (err) {
        console.error('Controller Crashed:', err);
    }

    await mongoose.connection.close();
}

simulatePrincipalVerification();
